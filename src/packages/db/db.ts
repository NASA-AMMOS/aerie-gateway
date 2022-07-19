import type { Pool, PoolConfig } from 'pg';
import pg from 'pg';
import { getEnv } from '../../env.js';
import getLogger from '../../logger.js';

const { Pool: DbPool } = pg;

const {
  POSTGRES_AERIE_MERLIN_DB,
  POSTGRES_HOST: host,
  POSTGRES_PASSWORD: password,
  POSTGRES_PORT: port,
  POSTGRES_USER: user,
} = getEnv();

const logger = getLogger('packages/db/db');

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
      logger.error(error);
    }
  }
}
