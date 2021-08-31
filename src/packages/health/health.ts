import type { Express } from 'express';

export default (app: Express) => {
  app.get('/health', (_, res) => {
    const timestamp = new Date().toISOString();
    const uptimeMinutes = process.uptime() / 60;
    res.json({ timestamp, uptimeMinutes });
  });
};
