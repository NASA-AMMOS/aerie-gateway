import type { Pool, PoolConfig } from 'pg';
import pg from 'pg';
import { getEnv } from '../../env.js';
import { insertViews } from './ui.js';

const { Pool: DbPool } = pg;

const {
  POSTGRES_AERIE_MERLIN_DB,
  POSTGRES_AERIE_UI_DB,
  POSTGRES_HOST: host,
  POSTGRES_PASSWORD: password,
  POSTGRES_PORT: port,
  POSTGRES_USER: user,
} = getEnv();

export class DbMerlin {
  private static pool: Pool;

  static getDb(): Pool {
    return DbMerlin.pool;
  }

  static async init(): Promise<void> {
    try {
      const config: PoolConfig = {
        database: POSTGRES_AERIE_MERLIN_DB,
        host,
        password,
        port: parseInt(port, 10),
        user,
      };
      DbMerlin.pool = new DbPool(config);
    } catch (error) {
      console.log(error);
    }
  }
}

export class DbUi {
  private static pool: Pool;

  static getDb(): Pool {
    return DbUi.pool;
  }

  static async init(): Promise<void> {
    try {
      const config: PoolConfig = {
        database: POSTGRES_AERIE_UI_DB,
        host,
        password,
        port: parseInt(port, 10),
        user,
      };
      DbUi.pool = new DbPool(config);
      await insertViews(DbUi.pool);
    } catch (error) {
      console.log(error);
    }
  }
}
