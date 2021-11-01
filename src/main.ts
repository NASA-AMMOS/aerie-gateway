import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { getEnv } from './env.js';
import initAuthRoutes from './packages/auth/routes.js';
import { Db } from './packages/db/db.js';
import initFileRoutes from './packages/files/files.js';
import initHealthRoutes from './packages/health/health.js';
import initPlaygroundRoutes from './packages/playground/playground.js';
import initSwaggerRoutes from './packages/swagger/swagger.js';
import initUiViewRoutes from './packages/ui/views.js';

async function main(): Promise<void> {
  const { PORT } = getEnv();
  const app = express();

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(express.json());

  await Db.init();

  initAuthRoutes(app);
  initFileRoutes(app);
  initHealthRoutes(app);
  initPlaygroundRoutes(app);
  initSwaggerRoutes(app);
  initUiViewRoutes(app);

  app.listen(PORT, () => {
    console.log(`🚀 AERIE-GATEWAY listening on ${PORT}`);
  });
}

main();
