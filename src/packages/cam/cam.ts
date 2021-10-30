import type { Express } from 'express';
import * as https from 'https';
import fetch, { Response } from 'node-fetch';

const agent = new https.Agent({ rejectUnauthorized: false });

export async function login(username: string, password: string) {
  const { CAM_API_URL, CAM_ENABLED } = process.env;

  if (CAM_ENABLED === 'true') {
    let response: Response | undefined;
    let json: any;

    try {
      const body = JSON.stringify({ username, password });
      const url = `${CAM_API_URL}/ssoToken?loginMethod=ldap`;
      response = await fetch(url, { agent, body, method: 'POST' });
      json = await response.json();
      const { errorCode = false } = json;

      if (errorCode) {
        const { errorMessage } = json;
        return { message: errorMessage, ssoToken: null, success: false };
      } else {
        const { ssoCookieValue: ssoToken } = json;
        return { message: 'Login successful', ssoToken, success: true };
      }
    } catch (error) {
      console.log(error);
      console.log(response);
      console.log(json);
      return {
        message: 'An unexpected error occurred',
        ssoToken: null,
        success: false,
      };
    }
  } else {
    return {
      message: 'Authentication is disabled',
      ssoToken: 'AUTHENTICATION-DISABLED',
      success: true,
    };
  }
}

export async function logout(ssoToken: string) {
  const { CAM_API_URL, CAM_ENABLED } = process.env;

  if (CAM_ENABLED === 'true') {
    let response: Response | undefined;
    let json: any;

    try {
      const body = JSON.stringify({ ssoToken });
      const url = `${CAM_API_URL}/ssoToken?action=invalidate`;
      response = await fetch(url, { agent, body, method: 'DELETE' });
      json = await response.json();
      const { errorCode = false } = json;

      if (errorCode) {
        const { errorMessage } = json;
        return { message: errorMessage, success: false };
      } else {
        return { message: 'Logout successful', success: true };
      }
    } catch (error) {
      console.log(error);
      console.log(response);
      console.log(json);
      return { message: 'An unexpected error occurred', success: false };
    }
  } else {
    return { message: 'Authentication is disabled', success: true };
  }
}

export async function session(ssoToken: string) {
  const { CAM_API_URL, CAM_ENABLED } = process.env;

  if (CAM_ENABLED === 'true') {
    let response: Response | undefined;
    let json: any;

    try {
      const body = JSON.stringify({ ssoToken });
      const url = `${CAM_API_URL}/ssoToken?action=validate`;
      response = await fetch(url, { agent, body, method: 'POST' });
      json = await response.json();
      const { errorCode = false } = json;

      if (errorCode) {
        const { errorMessage } = json;
        return { message: errorMessage, success: false };
      } else {
        const { validated } = json;
        const valid = validated ? 'valid' : 'invalid';
        const message = `Token is ${valid}`;
        return { message, success: validated };
      }
    } catch (error) {
      console.log(error);
      console.log(response);
      console.log(json);
      return { message: 'An unexpected error occurred', success: false };
    }
  } else {
    return { message: `Authentication is disabled`, success: true };
  }
}

export default (app: Express) => {
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
    const response = await login(username, password);
    res.json(response);
  });

  /**
   * @swagger
   * /cam/logout:
   *   delete:
   *     parameters:
   *       - description: Authorization header with CAM SSO token
   *         in: header
   *         name: x-cam-sso-token
   *         required: true
   *         schema:
   *           type: string
   *     produces:
   *       - application/json
   *     responses:
   *       200:
   *         description: LogoutResponse
   *     summary: Logout of CAM to terminate a session
   *     tags:
   *       - CAM
   */
  app.delete('/cam/logout', async (req, res) => {
    const { headers } = req;
    const { 'x-cam-sso-token': ssoToken = '' } = headers;
    const response = await logout(ssoToken as string);
    res.json(response);
  });

  /**
   * @swagger
   * /cam/session:
   *   get:
   *     parameters:
   *       - description: Authorization header with CAM SSO token
   *         in: header
   *         name: x-cam-sso-token
   *         required: true
   *         schema:
   *           type: string
   *     produces:
   *       - application/json
   *     responses:
   *       200:
   *         description: SessionResponse
   *     summary: Checks if a CAM session token is valid or invalid
   *     tags:
   *       - CAM
   */
  app.get('/cam/session', async (req, res) => {
    const { headers } = req;
    const { 'x-cam-sso-token': ssoToken = '' } = headers;
    const response = await session(ssoToken as string);
    res.json(response);
  });
};
