import type { Express } from 'express';
import { customAlphabet } from 'nanoid';
import type { Pool } from 'pg';
import { Db } from '../db/db.js';

async function latestView(db: Pool, user: string = '') {
  const { rows } = await db.query(`
    select view
    from ui.view
    where view->'meta'->>'owner' = '${user}'
    or view->'meta'->>'owner' = 'system'
    order by view->'meta'->>'timeUpdated' desc;
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
  const db = await Db.getDb();

  app.get('/ui/views', async (_, res) => {
    const { rows } = await db.query(`
      select view
      from ui.view
      order BY view->'meta'->>'timeUpdated' desc;
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
      insert into ui.view (id, view)
      values ('${id}', '${viewStr}');
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
      select view
      from ui.view
      where id='${id}'
      and view->'meta'->>'owner' = '${owner}';
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
      update ui.view
      set view='${view}'
      where id='${id}'
      and view->'meta'->>'owner' = '${owner}';
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
      select view
      from ui.view
      where id = '${id}';
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
      delete from ui.view
      where id = '${id}'
      and view->'meta'->>'owner' = '${owner}';
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
