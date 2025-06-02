import type { Express } from 'express';
import rateLimit from 'express-rate-limit';
import { getEnv } from '../../env.js';
import { login, session } from './functions.js';
import { AuthAdapter } from '../../types/auth.js';

export default (app: Express, auth: AuthAdapter) => {
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
    const response = await login(username, password, res);
    res.json(response);
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
    const result = await auth.validate(req, res);
    if (result) {
      if (result.message.includes("FORWARD TO PLANS")) {
        // LOOPS BACK TO hooks.server.ts, BUT THEN IT'LL COME BACK HERE AND HIT CASE 4 AND _THEN_ GET IT; 
        //    NOTE THAT ANY INFO WE SEND HERE IS NECESSARILY IGNORED.
        res.redirect(302, 'http://localhost:3000/plans');
      }
      else {
        const { token, success, message, userId, redirectURL } = result;
        const resp = {
          message,
          redirectURL,
          success,
          token,
          userId,
        };
        res.json(resp);
      }
    }
    else {
      // TODO: CHECK THIS??? SHOULD NEVER HIT THIS. 
      //    login can return undefined technically, if there is a redirect, but that'll never go here.
      const resp = {
        message: 'validation failed',
        redirectURL: '',
        success: false,
        token: '',
        userId: ''
      }
      res.json(resp);
    }
  });

  /**
   * @swagger
   * /auth/logoutSSO:
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
   *        description: boolean
   *     summary: Invalidates a user's SSO token against external auth providers
   *     tags:
   *       - Auth
   */
  app.get('/auth/logoutSSO', async (req, res) => {
    const success = await auth.logout(req);
    if (success !== undefined) {
      res.json({ success });
    }
    else {
      // TODO: shouldn't happen
      res.json({ success: false });
    }
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
