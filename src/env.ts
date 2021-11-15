export type Env = {
  AUTH_TYPE: string;
  AUTH_URL: string;
  GQL_API_URL: string;
  PORT: string;
  POSTGRES_AERIE_MERLIN_DB: string;
  POSTGRES_AERIE_UI_DB: string;
  POSTGRES_HOST: string;
  POSTGRES_PASSWORD: string;
  POSTGRES_PORT: string;
  POSTGRES_USER: string;
  VERSION: string;
};

export const defaultEnv: Env = {
  AUTH_TYPE: 'cam',
  AUTH_URL: 'https://atb-ocio-12b.jpl.nasa.gov:8443/cam-api',
  GQL_API_URL: 'http://localhost:8080/v1/graphql',
  PORT: '9000',
  POSTGRES_AERIE_MERLIN_DB: 'aerie_merlin',
  POSTGRES_AERIE_UI_DB: 'aerie_ui',
  POSTGRES_HOST: 'localhost',
  POSTGRES_PASSWORD: 'aerie',
  POSTGRES_PORT: '5432',
  POSTGRES_USER: 'aerie',
  VERSION: '0.9.1',
};

export function getEnv(): Env {
  const { env } = process;

  const AUTH_TYPE = env['AUTH_TYPE'] ?? defaultEnv.AUTH_TYPE;
  const AUTH_URL = env['AUTH_URL'] ?? defaultEnv.AUTH_URL;
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
  const VERSION = env['npm_package_version'] ?? defaultEnv.VERSION;

  return {
    AUTH_TYPE,
    AUTH_URL,
    GQL_API_URL,
    PORT,
    POSTGRES_AERIE_MERLIN_DB,
    POSTGRES_AERIE_UI_DB,
    POSTGRES_HOST,
    POSTGRES_PASSWORD,
    POSTGRES_PORT,
    POSTGRES_USER,
    VERSION,
  };
}
