export type Env = {
  AUTH_TYPE: string;
  AUTH_URL: string;
  COMMANDING_SERVER_PORT: string;
  COMMANDING_SERVER_URL: string;
  GQL_API_URL: string;
  PORT: string;
  POSTGRES_AERIE_MERLIN_DB: string;
  POSTGRES_AERIE_UI_DB: string;
  POSTGRES_HOST: string;
  POSTGRES_PASSWORD: string;
  POSTGRES_PORT: string;
  POSTGRES_USER: string;
  RATE_LIMITER_FILES_MAX: number;
  RATE_LIMITER_LOGIN_MAX: number;
  RATE_LIMITER_UI_VIEWS_MAX: number;
  VERSION: string;
};

export const defaultEnv: Env = {
  AUTH_TYPE: 'cam',
  AUTH_URL: 'https://atb-ocio-12b.jpl.nasa.gov:8443/cam-api',
  COMMANDING_SERVER_PORT: '3000',
  COMMANDING_SERVER_URL: 'http://localhost',
  GQL_API_URL: 'http://localhost:8080/v1/graphql',
  PORT: '9000',
  POSTGRES_AERIE_MERLIN_DB: 'aerie_merlin',
  POSTGRES_AERIE_UI_DB: 'aerie_ui',
  POSTGRES_HOST: 'localhost',
  POSTGRES_PASSWORD: 'aerie',
  POSTGRES_PORT: '5432',
  POSTGRES_USER: 'aerie',
  RATE_LIMITER_FILES_MAX: 1000,
  RATE_LIMITER_LOGIN_MAX: 1000,
  RATE_LIMITER_UI_VIEWS_MAX: 1000,
  VERSION: '0.10.0',
};

/**
 * Parse string typed environment variable into a number.
 * Returns the default value if parse fails.
 */
function parseNumber(value: string | undefined, defaultValue: number): number {
  if (typeof value === 'string') {
    const parsedValue = parseFloat(value);
    if (!Number.isNaN(parsedValue)) {
      return parsedValue;
    }
  }
  return defaultValue;
}

export function getEnv(): Env {
  const { env } = process;

  const AUTH_TYPE = env['AUTH_TYPE'] ?? defaultEnv.AUTH_TYPE;
  const AUTH_URL = env['AUTH_URL'] ?? defaultEnv.AUTH_URL;
  const COMMANDING_SERVER_PORT =
    env['COMMANDING_SERVER_PORT'] ?? defaultEnv.COMMANDING_SERVER_PORT;
  const COMMANDING_SERVER_URL =
    env['COMMANDING_SERVER_URL'] ?? defaultEnv.COMMANDING_SERVER_URL;
  const GQL_API_URL = env['GQL_API_URL'] ?? defaultEnv.GQL_API_URL;
  const PORT = env['PORT'] ?? defaultEnv.PORT;
  const POSTGRES_AERIE_MERLIN_DB =
    env['POSTGRES_AERIE_MERLIN_DB'] ?? defaultEnv.POSTGRES_AERIE_MERLIN_DB;
  const POSTGRES_AERIE_UI_DB =
    env['POSTGRES_AERIE_UI_DB'] ?? defaultEnv.POSTGRES_AERIE_UI_DB;
  const POSTGRES_HOST = env['POSTGRES_HOST'] ?? defaultEnv.POSTGRES_HOST;
  const POSTGRES_PASSWORD =
    env['POSTGRES_PASSWORD'] ?? defaultEnv.POSTGRES_PASSWORD;
  const POSTGRES_PORT = env['POSTGRES_PORT'] ?? defaultEnv.POSTGRES_PORT;
  const POSTGRES_USER = env['POSTGRES_USER'] ?? defaultEnv.POSTGRES_USER;
  const RATE_LIMITER_FILES_MAX = parseNumber(
    env['RATE_LIMITER_FILES_MAX'],
    defaultEnv.RATE_LIMITER_FILES_MAX,
  );
  const RATE_LIMITER_LOGIN_MAX = parseNumber(
    env['RATE_LIMITER_LOGIN_MAX'],
    defaultEnv.RATE_LIMITER_LOGIN_MAX,
  );
  const RATE_LIMITER_UI_VIEWS_MAX = parseNumber(
    env['RATE_LIMITER_UI_VIEWS_MAX'],
    defaultEnv.RATE_LIMITER_UI_VIEWS_MAX,
  );
  const VERSION = env['npm_package_version'] ?? defaultEnv.VERSION;

  return {
    AUTH_TYPE,
    AUTH_URL,
    COMMANDING_SERVER_PORT,
    COMMANDING_SERVER_URL,
    GQL_API_URL,
    PORT,
    POSTGRES_AERIE_MERLIN_DB,
    POSTGRES_AERIE_UI_DB,
    POSTGRES_HOST,
    POSTGRES_PASSWORD,
    POSTGRES_PORT,
    POSTGRES_USER,
    RATE_LIMITER_FILES_MAX,
    RATE_LIMITER_LOGIN_MAX,
    RATE_LIMITER_UI_VIEWS_MAX,
    VERSION,
  };
}
