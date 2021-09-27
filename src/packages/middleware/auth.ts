import { CamApi } from '@gov.nasa.jpl.aerie/cam';
import type { NextFunction, Request, Response } from 'express';

export const auth = async (req: Request, res: Response, next: NextFunction) => {
  const {
    CAM_API_URL: apiUrl = 'https://atb-ocio-12b.jpl.nasa.gov:8443/cam-api',
    CAM_ENABLED: enabled = 'true',
  } = process.env;
  const camOptions = { apiUrl, enabled: enabled === 'true' };
  const camApi = new CamApi(camOptions);

  if (!camOptions.enabled) {
    next();
  } else {
    const { headers } = req;
    const { 'x-cam-sso-token': ssoToken = '' } = headers;
    const response = await camApi.session(ssoToken as string);

    if (response?.success) {
      next();
    } else {
      res.status(500).send({ message: 'Unauthorized', success: false });
    }
  }
};
