export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly isOperational: boolean;
  readonly details?: unknown;

  constructor(
    code: string,
    message: string,
    statusCode = 400,
    details?: unknown,
    isOperational = true,
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;
  }
}

export class OptOutError extends AppError {
  constructor(message = 'Phone is opted out') {
    super('OPT_OUT', message, 403);
    this.name = 'OptOutError';
  }
}

export class RateLimitError extends AppError {
  readonly retryAfterSeconds: number;

  constructor(message = 'Too many requests', retryAfterSeconds = 60) {
    super('TOO_MANY_REQUESTS', message, 429);
    this.name = 'RateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super('VALIDATION_ERROR', message, 400, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super('NOT_FOUND', message, 404);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super('AUTH_REQUIRED', message, 401);
    this.name = 'UnauthorizedError';
  }
}

export const Errors = {
  notFound: (message: string): AppError => new NotFoundError(message),
  forbidden: (message: string): AppError => new AppError('FORBIDDEN', message, 403),
  conflict: (message: string, code = 'CONFLICT'): AppError =>
    new AppError(code, message, 409),
  validation: (message: string, details?: unknown): AppError =>
    new ValidationError(message, details),
  internal: (message: string): AppError =>
    new AppError('INTERNAL_ERROR', message, 500, undefined, false),
};
