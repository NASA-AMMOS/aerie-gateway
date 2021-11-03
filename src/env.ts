export type Env = {
  AUTH_TYPE: string;
  AUTH_URL: string;
  FILE_STORE_PATH: string;
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

export function getEnv(): Env {
  const { env } = process;

  const AUTH_TYPE = env['AUTH_TYPE'] ?? 'cam';
  const AUTH_URL = env['AUTH_URL'] ?? '';
  const FILE_STORE_PATH = env['FILE_STORE_PATH'] ?? '/app/files';
  const GQL_API_URL = env['GQL_API_URL'] ?? '';
  const PORT = env['PORT'] ?? '9000';
  const POSTGRES_AERIE_MERLIN_DB = env['POSTGRES_AERIE_MERLIN_DB'] ?? '';
  const POSTGRES_AERIE_UI_DB = env['POSTGRES_AERIE_UI_DB'] ?? '';
  const POSTGRES_HOST = env['POSTGRES_HOST'] ?? '';
  const POSTGRES_PASSWORD = env['POSTGRES_PASSWORD'] ?? '';
  const POSTGRES_PORT = env['POSTGRES_PORT'] ?? '';
  const POSTGRES_USER = env['POSTGRES_USER'] ?? '';
  const VERSION = env['npm_package_version'] ?? '';

  return {
    AUTH_TYPE,
    AUTH_URL,
    FILE_STORE_PATH,
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
