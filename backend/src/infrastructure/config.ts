import { validateStartupEnv, type AppEnv } from './startup-env';

export interface AppConfig {
  appEnv: AppEnv;
  /** Normalized Origin header values for CORS (from comma-separated APP_DOMAIN). */
  corsOrigins: string[];
  /** Public web origin for join/breakdown/static links (first normalized APP_DOMAIN entry). */
  appBaseUrl: string;
  /** Full backend URL for webhooks and server-side absolute links (APP_URL). */
  appUrl: string;
}

let cachedConfig: AppConfig | null = null;

/** Normalize domain-only or full URL to an origin without trailing slash. */
export function normalizeWebOrigin(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error('Web origin value cannot be empty');
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed.replace(/\/$/, '');
  }
  return `https://${trimmed.replace(/\/$/, '')}`;
}

export function resolveAppDomainConfig(
  raw: string | undefined,
  appEnv: AppEnv,
): Pick<AppConfig, 'corsOrigins' | 'appBaseUrl'> {
  if (!raw?.trim()) {
    if (appEnv === 'production' || appEnv === 'staging') {
      throw new Error('APP_DOMAIN is required in production/staging');
    }
    const local = 'http://localhost:3000';
    return { corsOrigins: [local], appBaseUrl: local };
  }

  const corsOrigins = raw
    .split(',')
    .map((part) => normalizeWebOrigin(part))
    .filter(Boolean);

  return { corsOrigins, appBaseUrl: corsOrigins[0]! };
}

export function resolveAppUrl(
  raw: string | undefined,
  appEnv: AppEnv,
  appBaseUrl: string,
): string {
  if (raw?.trim()) {
    return raw.trim().replace(/\/$/, '');
  }
  if (appEnv === 'production' || appEnv === 'staging') {
    throw new Error('APP_URL is required in production/staging');
  }
  return appBaseUrl;
}

/** Validate and cache typed config from process.env. Call at server boot. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const appEnv = validateStartupEnv(env);
  const { corsOrigins, appBaseUrl } = resolveAppDomainConfig(env.APP_DOMAIN, appEnv);
  const appUrl = resolveAppUrl(env.APP_URL, appEnv, appBaseUrl);
  cachedConfig = { appEnv, corsOrigins, appBaseUrl, appUrl };
  return cachedConfig;
}

export function getConfig(): AppConfig {
  if (!cachedConfig) {
    return loadConfig();
  }
  return cachedConfig;
}

/** Clear cached config — integration/unit tests that mutate process.env. */
export function resetConfigForTests(): void {
  cachedConfig = null;
}
