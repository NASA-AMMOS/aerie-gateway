import { getEnv } from '../../../env.js';
import type { AuthAdapter, ValidateResponse } from '../types.js';

export const NoAuthAdapter: AuthAdapter = {
  logout: async (): Promise<boolean> => true,
  validate: async (): Promise<ValidateResponse> => {
    const { AUTH_UI_URL } = getEnv();
    return {
      message: 'No auth enabled',
      redirectURL: AUTH_UI_URL,
      success: false,
    };
  },
};
