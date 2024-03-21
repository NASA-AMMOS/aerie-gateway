import type { Pool, PoolConfig } from 'pg';
import pg from 'pg';
import { getEnv } from '../../env.js';
import getLogger from '../../logger.js';

const { Pool: DbPool } = pg;

const { AERIE_DB_HOST: host, AERIE_DB_PORT: port, GATEWAY_DB_USER: user, GATEWAY_DB_PASSWORD: password } = getEnv();

const logger = getLogger('packages/db/db');

export class DbMerlin {
  private static pool: Pool;

  static getDb(): Pool {
    return DbMerlin.pool;
  }

  static async init(): Promise<void> {
    try {
      const config: PoolConfig = {
        database: 'aerie',
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
