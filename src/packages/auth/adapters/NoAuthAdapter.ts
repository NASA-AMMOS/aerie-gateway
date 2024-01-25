import type { AuthAdapter, ValidateResponse } from '../types.js';

export const NoAuthAdapter: AuthAdapter = {
  logout: async (): Promise<boolean> => true,
  validate: async (): Promise<ValidateResponse> => {
    throw new Error(`
      The UI is configured to use SSO auth, but the Gateway has AUTH_TYPE=none set, which is not a supported configuration.
      Disable SSO auth on the UI if JWT-only auth is desired.
    `);
  },
};
