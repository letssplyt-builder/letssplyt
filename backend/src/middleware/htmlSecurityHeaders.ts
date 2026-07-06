import helmet from 'helmet';

/**
 * Security headers for server-rendered guest HTML (/join, /split, /s).
 * Templates use inline CSS/JS only — no third-party assets.
 */
export const htmlSecurityHeaders = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      imgSrc: ["'self'", 'data:'],
      styleSrc: ["'unsafe-inline'"],
      scriptSrc: ["'unsafe-inline'"],
      connectSrc: ["'self'"],
    },
  },
  referrerPolicy: { policy: 'no-referrer' },
  crossOriginEmbedderPolicy: false,
});
