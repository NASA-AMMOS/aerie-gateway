import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import initCamRoutes from './packages/cam/cam.js';
import initFileRoutes from './packages/files/files.js';
import initHealthRoutes from './packages/health/health.js';
import initPlaygroundRoutes from './packages/playground/playground.js';
import initSwaggerRoutes from './packages/swagger/swagger.js';
import initUiViewRoutes from './packages/ui/views.js';

async function main(): Promise<void> {
  const { PORT = '9000' } = process.env;
  const app = express();

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(express.json());

  initCamRoutes(app);
  await initFileRoutes(app);
  initHealthRoutes(app);
  initPlaygroundRoutes(app);
  initSwaggerRoutes(app);
  await initUiViewRoutes(app);

  app.listen(PORT, () => {
    console.log(`🚀 AERIE-GATEWAY listening on ${PORT}`);
  });
}

main();
