import type { Express } from 'express';
import { customAlphabet } from 'nanoid';
import type { Pool } from 'pg';
import { DbUi } from '../db/ui.js';

async function latestView(db: Pool, user: string = '') {
  const { rows } = await db.query(`
    SELECT view
    FROM ui.views
    WHERE view->'meta'->>'owner' = '${user}'
    OR view->'meta'->>'owner' = 'system'
    ORDER BY view->'meta'->>'timeUpdated' DESC;
  `);

  const userViews = [];
  const systemViews = [];
  for (const row of rows) {
    const { view } = row;
    const { owner } = view.meta;
    if (owner === user) {
      userViews.push(view);
    }
    if (owner === 'system') {
      systemViews.push(view);
    }
  }

  if (userViews.length) {
    const [userView] = userViews;
    return userView;
  } else if (systemViews.length) {
    const [systemView] = systemViews;
    return systemView;
  } else {
    return null;
  }
}

function uniqueId(): string {
  const alphabet =
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const size = 15;
  const nanoid = customAlphabet(alphabet, size);
  return nanoid();
}

export default async (app: Express) => {
  const db = await DbUi.getDb();

  app.get('/ui/views', async (_, res) => {
    const { rows } = await db.query(`
      SELECT view
      FROM ui.views
      ORDER BY view->'meta'->>'timeUpdated' DESC;
    `);
    const views = rows.map(({ view }) => ({
      id: view.id,
      meta: view.meta,
      name: view.name,
    }));

    res.json(views);
  });

  app.get('/ui/views/latest', async (req, res) => {
    const user = req.get('x-user');
    const view = await latestView(db, user);

    if (view) {
      res.json(view);
    } else {
      res.json({
        message: `No views found`,
        success: false,
      });
    }
  });

  app.post('/ui/views', async (req, res) => {
    const { body } = req;
    const id = uniqueId();
    const now = Date.now();
    const owner = req.get('x-user');
    const meta = { owner, timeCreated: now, timeUpdated: now };
    const view = { ...body, id, meta };
    const viewStr = JSON.stringify({ ...body, id, meta });

    const { rowCount } = await db.query(`
      INSERT INTO ui.views (id, view)
      VALUES ('${id}', '${viewStr}');
    `);

    if (rowCount > 0) {
      res.json({
        message: `${id} created`,
        view,
      });
    } else {
      res.json({
        message: `${id} not created`,
      });
    }
  });

  app.put('/ui/views/:id', async (req, res) => {
    const { body, params } = req;
    const { id = '' } = params;
    const owner = req.get('x-user');

    const { rows } = await db.query(`
      SELECT view
      FROM ui.views
      WHERE id='${id}'
      AND view->'meta'->>'owner' = '${owner}';
    `);

    const [{ view: currentView }] = rows;
    const now = Date.now();
    const view = JSON.stringify({
      ...body,
      meta: {
        ...currentView.meta,
        timeUpdated: now,
      },
    });

    const { rowCount } = await db.query(`
      UPDATE ui.views
      SET view='${view}'
      WHERE id='${id}'
      AND view->'meta'->>'owner' = '${owner}';
    `);

    if (rowCount > 0) {
      res.json({
        message: `${id} updated`,
      });
    } else {
      res.status(404).json({
        message: `${id} not updated`,
      });
    }
  });

  app.get('/ui/views/:id', async (req, res) => {
    const { params } = req;
    const { id = '' } = params;

    const { rows = [], rowCount } = await db.query(`
      SELECT view
      FROM ui.views
      WHERE id = '${id}';
    `);

    if (rowCount > 0) {
      const [{ view = {} }] = rows;
      res.json(view);
    } else {
      res.status(404).json({
        message: `${id} not found`,
      });
    }
  });

  app.delete('/ui/views/:id', async (req, res) => {
    const { params } = req;
    const { id = '' } = params;
    const owner = req.get('x-user');

    const { rowCount } = await db.query(`
      DELETE FROM ui.views
      WHERE id = '${id}'
      AND view->'meta'->>'owner' = '${owner}';
    `);

    if (rowCount > 0) {
      const nextView = await latestView(db, owner);
      res.json({
        deletedViewId: id,
        message: `${id} successfully deleted`,
        nextView,
      });
    } else {
      res.status(404).json({
        message: `${id} not found`,
      });
    }
  });
};
