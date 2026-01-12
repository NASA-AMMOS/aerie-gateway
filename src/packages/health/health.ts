import type { Express } from 'express';
import { getEnv } from '../../env.js';

interface ServiceHealthResult {
  errorMessage: string | null;
  latencyMs: number;
  status: 'healthy' | 'unhealthy';
  url: string;
}

interface ServicesHealthResponse {
  services: Record<string, ServiceHealthResult>;
  timestamp: string;
}

async function checkServiceHealth(_name: string, url: string, healthEndpoint: string): Promise<ServiceHealthResult> {
  const fullUrl = `${url}${healthEndpoint}`;
  const startTime = performance.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(fullUrl, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latencyMs = Math.round(performance.now() - startTime);

    if (response.ok) {
      return {
        errorMessage: null,
        latencyMs,
        status: 'healthy',
        url,
      };
    }

    return {
      errorMessage: `HTTP ${response.status}: ${response.statusText}`,
      latencyMs,
      status: 'unhealthy',
      url,
    };
  } catch (error) {
    const latencyMs = Math.round(performance.now() - startTime);
    let errorMessage = 'Unknown error';

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorMessage = 'Request timed out';
      } else {
        errorMessage = error.message;
      }
    }

    return {
      errorMessage,
      latencyMs,
      status: 'unhealthy',
      url,
    };
  }
}

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
   * /health/services:
   *   get:
   *     produces:
   *       - application/json
   *     responses:
   *       200:
   *         description: Aggregated health status of all Aerie services
   *         content:
   *           application/json:
   *             schema:
   *                properties:
   *                  timestamp:
   *                    description: Returns a date as a string value in ISO format
   *                    type: string
   *                  services:
   *                    description: Health status of each service
   *                    type: object
   *     summary: Get the health status of all Aerie backend services
   *     tags:
   *       - Health
   */
  app.get('/health/services', async (req, res) => {
    const env = getEnv();

    // Support ?simulateFail=action,hasura to simulate failures for testing
    const simulateFailParam = req.query.simulateFail as string | undefined;
    const simulateFailServices = simulateFailParam ? simulateFailParam.split(',').map(s => s.trim().toLowerCase()) : [];

    const serviceChecks = [
      { healthEndpoint: '/health', name: 'action', url: env.ACTION_SERVER_URL },
      { healthEndpoint: '/healthz', name: 'hasura', url: env.HASURA_API_URL },
      { healthEndpoint: '/health', name: 'merlin', url: env.MERLIN_SERVER_URL },
      { healthEndpoint: '/health', name: 'scheduler', url: env.SCHEDULER_SERVER_URL },
      { healthEndpoint: '/health', name: 'sequencing', url: env.SEQUENCING_SERVER_URL },
      { healthEndpoint: '/health', name: 'workspace', url: env.WORKSPACE_SERVER_URL },
    ];

    const results = await Promise.all(
      serviceChecks.map(async ({ healthEndpoint, name, url }) => {
        // Simulate failure if requested
        if (simulateFailServices.includes(name.toLowerCase())) {
          return {
            name,
            result: {
              errorMessage: 'Simulated failure for testing',
              latencyMs: 0,
              status: 'unhealthy' as const,
              url,
            },
          };
        }
        const result = await checkServiceHealth(name, url, healthEndpoint);
        return { name, result };
      }),
    );

    const services: Record<string, ServiceHealthResult> = {};
    for (const { name, result } of results) {
      services[name] = result;
    }

    const response: ServicesHealthResponse = {
      services,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
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
