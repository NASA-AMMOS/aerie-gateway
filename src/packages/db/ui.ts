import fastGlob from 'fast-glob';
import { readFileSync } from 'fs';
import type { Pool } from 'pg';

/**
 * Insert default views from file system into the database.
 */
export async function insertViews(pool: Pool): Promise<void> {
  if (pool) {
    const filePaths = await fastGlob('views/*.json');

    for (const filePath of filePaths) {
      const view = readFileSync(filePath).toString();
      const { id } = JSON.parse(view);

      await pool.query(`
        insert into view (id, view)
        values ('${id}', '${view}')
        on conflict (id) do update set view='${view}';
      `);
    }
  } else {
    console.error(
      'Error: Cannot insert default UI views. No database pool exists.',
    );
  }
}
