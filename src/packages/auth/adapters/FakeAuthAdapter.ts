import { getEnv } from '../../../env.js';
import type { AuthAdapter, ValidateResponse } from '../types.js';

export const FakeAuthAdapter: AuthAdapter = {
  logout: async (): Promise<boolean> => true,
  validate: async (): Promise<ValidateResponse> => {
    const { AUTH_UI_URL } = getEnv();
    return {
      message: 'SSO token auth is disabled',
      redirectURL: AUTH_UI_URL,
      success: false,
    };
  },
};
