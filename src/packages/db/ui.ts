import fastGlob from 'fast-glob';
import { readFileSync } from 'fs';
import type { Pool, PoolConfig } from 'pg';
import pg from 'pg';

const { Pool: DbPool } = pg;

const {
  POSTGRES_DATABASE_UI: database = 'aerie',
  POSTGRES_HOST_UI: host = 'postgres',
  POSTGRES_PASSWORD_UI: password = 'aerie',
  POSTGRES_PORT_UI: port = '5432',
  POSTGRES_USER_UI: user = 'aerie',
} = process.env;

export class DbUi {
  private static pool: Pool | null = null;

  static async getDb(): Promise<Pool> {
    if (!DbUi.pool) {
      await DbUi.init();
    }
    return DbUi.pool as Pool;
  }

  static async init(): Promise<void> {
    try {
      const poolConfig: PoolConfig = {
        database,
        host,
        password,
        port: parseInt(port, 10),
        user,
      };

      DbUi.pool = new DbPool(poolConfig);
      await DbUi.createSchemas();
      await DbUi.createTables();
      await DbUi.insertDefaultViews();
    } catch (error) {
      console.error(error);
    }
  }

  static async createSchemas(): Promise<void> {
    if (DbUi.pool) {
      await DbUi.pool.query(`
        CREATE SCHEMA IF NOT EXISTS ui
        AUTHORIZATION ${user};
      `);
    } else {
      console.error('Error: Cannot create schemas. No database pool exists.');
    }
  }

  static async createTables(): Promise<void> {
    if (DbUi.pool) {
      await DbUi.pool.query(`
        CREATE TABLE IF NOT EXISTS ui.views (
          id text NOT NULL PRIMARY KEY,
          view jsonb NOT NULL
        );
      `);
    } else {
      console.error('Error: Cannot create tables. No database pool exists.');
    }
  }

  /**
   * Insert default views from file system into the database.
   */
  static async insertDefaultViews(): Promise<void> {
    if (DbUi.pool) {
      const filePaths = await fastGlob('views/*.json');

      for (const filePath of filePaths) {
        const view = readFileSync(filePath).toString();
        const { id } = JSON.parse(view);

        await DbUi.pool.query(`
          INSERT INTO ui.views (id, view)
          VALUES ('${id}', '${view}')
          ON CONFLICT (id) DO UPDATE SET view='${view}';
        `);
      }
    } else {
      console.error(
        'Error: Cannot insert default views. No database pool exists.',
      );
    }
  }
}
