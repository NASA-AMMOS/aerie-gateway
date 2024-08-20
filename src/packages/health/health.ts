import type { Express } from 'express';
import { getEnv } from '../../env.js';

export default (app: Express) => {
  /**
   * @swagger
   * /health:
   *   get:
   *     produces:
   *       - application/json
   *     responses:
   *       200:
   *         description: Health metrics
   *         content:
   *           application/json:
   *             schema:
   *                properties:
   *                  timestamp:
   *                    description: Returns a date as a string value in ISO format
   *                    type: string
   *                  uptimeMinutes:
   *                    description: Number of minutes the server has been running
   *                    type: number
   *     summary: Get the current time and uptime minutes for this server
   *     tags:
   *       - Health
   */
  app.get('/health', (_, res) => {
    const timestamp = new Date().toISOString();
    const uptimeMinutes = process.uptime() / 60;
    res.json({ timestamp, uptimeMinutes });
  });

  /**
   * @swagger
   * /version:
   *   get:
   *     produces:
   *       - application/json
   *     responses:
   *       200:
   *         description: Version metrics
   *         content:
   *           application/json:
   *             schema:
   *                properties:
   *                  gateway_version:
   *                    description: The current version of the Aerie Gateway.
   *                    type: string
   *     summary: Get the current version of the Gateway and Database Schema
   *     tags:
   *       - Version
   */
  app.get('/version', async (_, res) => {
    res.json({
      version: getEnv().VERSION,
    });
  });
};
