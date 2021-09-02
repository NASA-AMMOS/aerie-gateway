import type { Pool, PoolConfig } from 'pg';
import pg from 'pg';

const { Pool: DbPool } = pg;

const {
  POSTGRES_DATABASE_MERLIN: database = 'merlin',
  POSTGRES_HOST_MERLIN: host = 'postgres',
  POSTGRES_PASSWORD_MERLIN: password = 'aerie',
  POSTGRES_PORT_MERLIN: port = '5432',
  POSTGRES_USER_MERLIN: user = 'aerie',
} = process.env;

export class DbMerlin {
  private static pool: Pool | null = null;

  static getDb(): Pool {
    if (!DbMerlin.pool) {
      DbMerlin.init();
    }
    return DbMerlin.pool as Pool;
  }

  static init(): void {
    try {
      const poolConfig: PoolConfig = {
        database,
        host,
        password,
        port: parseInt(port, 10),
        user,
      };

      DbMerlin.pool = new DbPool(poolConfig);
    } catch (error) {
      console.error(error);
    }
  }
}
