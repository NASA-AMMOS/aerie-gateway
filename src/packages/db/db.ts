import type { Pool, PoolConfig } from 'pg';
import pg from 'pg';

const { Pool: DbPool } = pg;

const {
  POSTGRES_DATABASE: database = 'aerie',
  POSTGRES_HOST: host = 'postgres',
  POSTGRES_PASSWORD: password = 'aerie',
  POSTGRES_PORT: port = '5432',
  POSTGRES_USER: user = 'aerie',
} = process.env;

export class Db {
  private static pool: Pool | null = null;

  static getDb(): Pool | null {
    if (!Db.pool) {
      Db.init();
    }
    return Db.pool;
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
      Db.pool = new DbPool(poolConfig);
    } catch (error) {
      console.error(error);
    }
  }
}
