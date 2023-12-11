import type { Express } from 'express';
import rateLimit from 'express-rate-limit';
import { getEnv } from '../../env.js';
import { login, loginSSO, session, validateSSOToken } from './functions.js';

export default (app: Express) => {
  const { RATE_LIMITER_LOGIN_MAX } = getEnv();

  const loginLimiter = rateLimit({
    legacyHeaders: false,
    max: RATE_LIMITER_LOGIN_MAX,
    standardHeaders: true,
    windowMs: 15 * 60 * 1000, // 15 minutes
  });

  /**
   * @swagger
   * /auth/login:
   *   post:
   *     consumes:
   *       - application/json
   *     produces:
   *       - application/json
   *     requestBody:
   *       description: User's credentials
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               username:
   *                 type: string
   *               password:
   *                 type: string
   *     responses:
   *       200:
   *         description: AuthResponse
   *     summary: Login to initiate a session
   *     tags:
   *       - Auth
   */
  app.post('/auth/login', loginLimiter, async (req, res) => {
    const { body } = req;
    const { username, password } = body;
    const response = await login(username, password);
    res.json(response);
  });

  /**
   * @swagger
   * /auth/loginSSO:
   *   get:
   *     parameters:
   *       - in: cookie
   *         name: AUTH_SSO_TOKEN_NAME
   *         schema:
   *           type: string
   *         description: SSO token cookie that is named according to the gateway environment variable
   *     produces:
   *       - application/json
   *     responses:
   *       200:
   *         description: AuthResponse
   *     summary: Login to initiate a session
   *     tags:
   *       - Auth
   */
  app.get('/auth/loginSSO', loginLimiter, async (req, res) => {
    const { AUTH_SSO_TOKEN_NAME } = getEnv();
    const ssoToken = req.cookies[AUTH_SSO_TOKEN_NAME];
    // TODO, switch based on AUTH_TYPE to call different SSO provider adapters
    const { token, success, message } = await loginSSO(ssoToken);
    const resp = {
      message,
      success,
      token,
    };
    res.json(resp);
  });

  /**
   * @swagger
   * /auth/validateSSO:
   *   get:
   *     parameters:
   *       - in: cookie
   *         name: AUTH_SSO_TOKEN_NAME
   *         schema:
   *           type: string
   *         description: SSO token cookie that is named according to the gateway environment variable
   *     produces:
   *       - application/json
   *     responses:
   *       200:
   *         description: AuthResponse
   *     summary: Validates a user's SSO token against external auth providers
   *     tags:
   *       - Auth
   */
  app.get('/auth/validateSSO', loginLimiter, async (req, res) => {
    const { AUTH_SSO_TOKEN_NAME } = getEnv();
    const ssoToken = req.cookies[AUTH_SSO_TOKEN_NAME];
    // TODO, switch based on AUTH_TYPE to call different SSO provider adapters
    const response = await validateSSOToken(ssoToken);
    res.json(response);
  });

  /**
   * @swagger
   * /auth/session:
   *   get:
   *     security:
   *       - bearerAuth: []
   *     produces:
   *       - application/json
   *     responses:
   *       200:
   *         description: SessionResponse
   *     summary: Checks if a session token is valid or invalid
   *     tags:
   *       - Auth
   */
  app.get('/auth/session', async (req, res) => {
    const authorizationHeader = req.get('authorization');
    const response = await session(authorizationHeader);
    res.json(response);
  });
};
