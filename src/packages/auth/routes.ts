import type { Express } from 'express';
import rateLimit from 'express-rate-limit';
import { login, logout, session, user } from './functions.js';

export default (app: Express) => {
  const loginLimiter = rateLimit({
    legacyHeaders: false,
    max: 100,
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
   *         description: LoginResponse
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
   *     parameters:
   *       - description: Session token used for authorization
   *         in: header
   *         name: x-auth-sso-token
   *         required: true
   *         schema:
   *           type: string
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
    const { headers } = req;
    const { 'x-auth-sso-token': ssoToken = '' } = headers;
    const response = await logout(ssoToken as string);
    res.json(response);
  });

  /**
   * @swagger
   * /auth/session:
   *   get:
   *     parameters:
   *       - description: Session token used for authorization
   *         in: header
   *         name: x-auth-sso-token
   *         required: true
   *         schema:
   *           type: string
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
    const { headers } = req;
    const { 'x-auth-sso-token': ssoToken = '' } = headers;
    const response = await session(ssoToken as string);
    res.json(response);
  });

  /**
   * @swagger
   * /auth/user:
   *   get:
   *     parameters:
   *       - description: Session token used for authorization
   *         in: header
   *         name: x-auth-sso-token
   *         required: true
   *         schema:
   *           type: string
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
    const { headers } = req;
    const { 'x-auth-sso-token': ssoToken = '' } = headers;
    const response = await user(ssoToken as string);
    res.json(response);
  });
};
