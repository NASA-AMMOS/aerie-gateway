import type { Express } from 'express';
import rateLimit from 'express-rate-limit';
import { getEnv } from '../../env.js';
import { changeRole, login, logout, session, user } from './functions.js';

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
   * /auth/logout:
   *   delete:
   *     security:
   *       - bearerAuth: []
   *     produces:
   *       - application/json
   *     responses:
   *       200:
   *         description: LogoutResponse
   *     summary: Logout to terminate a session
   *     tags:
   *       - Auth
   */
  app.delete('/auth/logout', async (req, res) => {
    const authorizationHeader = req.get('authorization');
    const response = await logout(authorizationHeader);
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

  /**
   * @swagger
   * /auth/user:
   *   get:
   *     security:
   *       - bearerAuth: []
   *     produces:
   *       - application/json
   *     responses:
   *       200:
   *         description: UserResponse
   *     summary: Returns a session's user information
   *     tags:
   *       - Auth
   */
  app.get('/auth/user', async (req, res) => {
    const authorizationHeader = req.get('authorization');
    const response = await user(authorizationHeader);
    res.json(response);
  });

  /**
   * @swagger
   * /auth/changeRole:
   *   post:
   *     security:
   *       - bearerAuth: []
   *     consumes:
   *       - application/json
   *     produces:
   *       - application/json
   *     requestBody:
   *       description: User's desired role
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               role:
   *                 type: string
   *     responses:
   *       200:
   *         description: AuthResponse
   *     summary: Changes a user's role in the session
   *     tags:
   *       - Auth
   */
  app.post('/auth/changeRole', async (req, res) => {
    const authorizationHeader = req.get('authorization');
    const { body } = req;
    const { role: requestedRole } = body;
    const response = await changeRole(authorizationHeader, requestedRole);
    res.json(response);
  });
};
