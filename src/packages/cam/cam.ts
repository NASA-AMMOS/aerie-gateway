import { CamApi } from '@gov.nasa.jpl.aerie/cam';
import type { Express } from 'express';

export default (app: Express) => {
  const {
    CAM_API_URL: apiUrl = 'https://atb-ocio-12b.jpl.nasa.gov:8443/cam-api',
    CAM_ENABLED: enabled = 'true',
  } = process.env;
  const camOptions = { apiUrl, enabled: enabled === 'true' };

  app.post('/cam/login', async (req, res) => {
    const { body } = req;
    const { username, password } = body;
    const camApi = new CamApi(camOptions);
    const response = await camApi.login(username, password);
    res.json(response);
  });

  app.post('/cam/logout', async (req, res) => {
    const { headers } = req;
    const { authorization: ssoToken = '' } = headers;
    const camApi = new CamApi(camOptions);
    const response = await camApi.logout(ssoToken);
    res.json(response);
  });
};
