import type { Request, Response } from 'express';
import { AppError } from '../../infrastructure/errors';
import {
  createCsrfToken,
  createJoinSessionId,
  readJoinSessionFromCookies,
  setJoinCookies,
  validateCsrf,
} from './join-cookies';
import {
  JoinServiceError,
  loadJoinEventContext,
  submitJoinPhone,
  verifyJoinOtp,
  writeFunnelCheckpoint,
} from './join-web.service';
import { renderAppUserRedirectPage } from './templates/app-user-redirect.html';
import { renderExpiredPage } from './templates/expired.html';
import { renderJoinFormPage } from './templates/join-form.html';
import { renderJoinSuccessPage } from './templates/join-success.html';
import { renderLockedPage } from './templates/locked.html';
import { renderOtpEntryPage } from './templates/otp-entry.html';

function sendHtml(res: Response, html: string, status = 200): void {
  res.status(status).type('html').send(html);
}

function ensureCsrf(req: Request, res: Response): boolean {
  const submitted = typeof req.body?.csrf_token === 'string' ? req.body.csrf_token : undefined;
  if (!validateCsrf(req.headers.cookie, submitted)) {
    sendHtml(res, renderJoinFormPage({
      token: req.params.token ?? '',
      eventTitle: 'Event',
      payerName: 'Someone',
      csrfToken: createCsrfToken(),
      errorMessage: 'Session expired. Please try again.',
    }), 403);
    return false;
  }
  return true;
}

function sessionIdFromRequest(req: Request): string {
  return readJoinSessionFromCookies(req.headers.cookie) ?? createJoinSessionId();
}

export async function getJoinPage(req: Request, res: Response): Promise<void> {
  const token = req.params.token ?? '';
  const { pageKind, context } = await loadJoinEventContext(token);

  if (pageKind === 'not_found') {
    sendHtml(res, renderExpiredPage(), 404);
    return;
  }

  if (pageKind === 'expired') {
    sendHtml(res, renderExpiredPage(context?.eventTitle));
    return;
  }

  if (pageKind === 'locked') {
    sendHtml(res, renderLockedPage(context?.eventTitle));
    return;
  }

  const csrfToken = createCsrfToken();
  const sessionId = createJoinSessionId();
  setJoinCookies(res, csrfToken, sessionId);

  if (context) {
    await writeFunnelCheckpoint({
      sessionId,
      eventId: context.eventId,
      checkpoint: 'join_page_loaded',
    });
  }

  sendHtml(
    res,
    renderJoinFormPage({
      token,
      eventTitle: context!.eventTitle,
      payerName: context!.payerName,
      csrfToken,
    }),
  );
}

export async function postJoinOtpRequest(req: Request, res: Response): Promise<void> {
  const token = req.params.token ?? '';
  if (!ensureCsrf(req, res)) return;

  const sessionId = sessionIdFromRequest(req);
  const displayName = String(req.body?.display_name ?? '');
  const countryDial = String(req.body?.country_dial ?? '+1');
  const phoneNational = String(req.body?.phone_national ?? '');

  try {
    const result = await submitJoinPhone({
      token,
      displayName,
      countryDial,
      phoneNational,
      sessionId,
    });

    if (result.alreadyJoined) {
      const { context } = await loadJoinEventContext(token);
      sendHtml(
        res,
        renderJoinSuccessPage({
          eventTitle: context?.eventTitle ?? 'Event',
          payerName: context?.payerName ?? 'Someone',
        }),
      );
      return;
    }

    const csrfToken = createCsrfToken();
    setJoinCookies(res, csrfToken, sessionId);

    const { context } = await loadJoinEventContext(token);
    sendHtml(
      res,
      renderOtpEntryPage({
        token,
        eventTitle: context?.eventTitle ?? 'Event',
        phoneE164: result.phoneE164,
        displayName: result.displayName,
        csrfToken,
      }),
    );
  } catch (err) {
    await handleJoinFormError(req, res, err, { displayName, countryDial, phoneNational });
  }
}

export async function postJoinOtpVerify(req: Request, res: Response): Promise<void> {
  const token = req.params.token ?? '';
  if (!ensureCsrf(req, res)) return;

  const sessionId = sessionIdFromRequest(req);
  const displayName = String(req.body?.display_name ?? '');
  const phoneE164 = String(req.body?.phone_e164 ?? '');
  const code = String(req.body?.code ?? '');

  try {
    const result = await verifyJoinOtp({
      token,
      displayName,
      phoneE164,
      code,
      sessionId,
    });

    sendHtml(
      res,
      renderJoinSuccessPage({
        eventTitle: result.eventTitle,
        payerName: result.payerName,
      }),
    );
  } catch (err) {
    await handleOtpVerifyError(req, res, err, { displayName, phoneE164 });
  }
}

async function handleJoinFormError(
  req: Request,
  res: Response,
  err: unknown,
  form: { displayName: string; countryDial: string; phoneNational: string },
): Promise<void> {
  const token = req.params.token ?? '';
  const { context } = await loadJoinEventContext(token);
  const csrfToken = createCsrfToken();
  setJoinCookies(res, csrfToken, sessionIdFromRequest(req));

  if (err instanceof JoinServiceError) {
    if (err.code === 'EVENT_LOCKED') {
      sendHtml(res, renderLockedPage(context?.eventTitle), err.status);
      return;
    }

    sendHtml(
      res,
      renderJoinFormPage({
        token,
        eventTitle: context?.eventTitle ?? 'Event',
        payerName: context?.payerName ?? 'Someone',
        csrfToken,
        errorMessage: err.message,
        displayName: form.displayName,
        countryDial: form.countryDial,
        phoneNational: form.phoneNational,
      }),
      err.status,
    );
    return;
  }

  throw err;
}

async function handleOtpVerifyError(
  req: Request,
  res: Response,
  err: unknown,
  form: { displayName: string; phoneE164: string },
): Promise<void> {
  const token = req.params.token ?? '';
  const { context } = await loadJoinEventContext(token);
  const csrfToken = createCsrfToken();
  setJoinCookies(res, csrfToken, sessionIdFromRequest(req));

  if (err instanceof JoinServiceError) {
    if (err.code === 'EVENT_LOCKED') {
      sendHtml(
        res,
        renderOtpEntryPage({
          token,
          eventTitle: context?.eventTitle ?? 'Event',
          phoneE164: form.phoneE164,
          displayName: form.displayName,
          csrfToken,
          lockedMessage: err.message,
        }),
        err.status,
      );
      return;
    }

    sendHtml(
      res,
      renderOtpEntryPage({
        token,
        eventTitle: context?.eventTitle ?? 'Event',
        phoneE164: form.phoneE164,
        displayName: form.displayName,
        csrfToken,
        errorMessage: err.message,
      }),
      err.status,
    );
    return;
  }

  if (err instanceof AppError) {
    sendHtml(
      res,
      renderOtpEntryPage({
        token,
        eventTitle: context?.eventTitle ?? 'Event',
        phoneE164: form.phoneE164,
        displayName: form.displayName,
        csrfToken,
        errorMessage:
          err.code === 'PARTICIPANT_CREATE_FAILED' || err.code === 'GUEST_PII_CREATE_FAILED'
            ? 'We could not add you to the event. Please try again or ask the bill payer for help.'
            : err.message,
      }),
      err.statusCode,
    );
    return;
  }

  throw err;
}

export async function getJoinSuccessPage(req: Request, res: Response): Promise<void> {
  const token = req.params.token ?? '';
  const { context } = await loadJoinEventContext(token);
  sendHtml(
    res,
    renderJoinSuccessPage({
      eventTitle: context?.eventTitle ?? 'Event',
      payerName: context?.payerName ?? 'Someone',
    }),
  );
}
