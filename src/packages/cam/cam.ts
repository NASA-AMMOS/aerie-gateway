import { CamApi } from '@gov.nasa.jpl.aerie/cam';
import type { Express } from 'express';

export default (app: Express) => {
  const {
    CAM_API_URL: apiUrl = 'https://atb-ocio-12b.jpl.nasa.gov:8443/cam-api',
    CAM_ENABLED: enabled = 'true',
  } = process.env;
  const camOptions = { apiUrl, enabled: enabled === 'true' };

  /**
   * @swagger
   * /cam/login:
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
   *     summary: Login to CAM to initiate a session
   *     tags:
   *       - CAM
   */
  app.post('/cam/login', async (req, res) => {
    const { body } = req;
    const { username, password } = body;
    const camApi = new CamApi(camOptions);
    const response = await camApi.login(username, password);
    res.json(response);
  });

  /**
   * @swagger
   * /cam/logout:
   *   post:
   *     parameters:
   *       - description: Authorization header with CAM SSO token
   *         in: header
   *         name: x-cam-authorization
   *         required: true
   *         schema:
   *           type: string
   *     produces:
   *       - application/json
   *     responses:
   *       200:
   *         description: LogoutResponse
   *     summary: Logout of CAM to destroy a session
   *     tags:
   *       - CAM
   */
  app.post('/cam/logout', async (req, res) => {
    const { headers } = req;
    const { authorization: ssoToken = '' } = headers;
    const camApi = new CamApi(camOptions);
    const response = await camApi.logout(ssoToken);
    res.json(response);
  });
};
