/** Allowed deployment environments (APP_ENV). */
export const ALLOWED_APP_ENVS = ['development', 'test', 'staging', 'production'] as const;

export type AppEnv = (typeof ALLOWED_APP_ENVS)[number];

export class StartupEnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StartupEnvError';
  }
}

/**
 * Fail fast at boot if APP_ENV is missing or not a known value.
 * Prevents fail-open OTP bypass and other env-dependent misconfiguration.
 */
export function validateStartupEnv(env: NodeJS.ProcessEnv = process.env): AppEnv {
  const raw = env.APP_ENV?.trim();
  if (!raw) {
    throw new StartupEnvError(
      'APP_ENV is required (development | test | staging | production)',
    );
  }

  if (!ALLOWED_APP_ENVS.includes(raw as AppEnv)) {
    throw new StartupEnvError(
      `APP_ENV must be one of: ${ALLOWED_APP_ENVS.join(', ')} (got "${raw}")`,
    );
  }

  return raw as AppEnv;
}
