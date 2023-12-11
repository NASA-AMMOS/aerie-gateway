export type JsonWebToken = string;

export type JwtDecode = {
  jwtErrorMessage: string;
  jwtPayload: JwtPayload | null;
};

export type JwtPayload = {
  'https://hasura.io/jwt/claims': Record<string, string | string[]>;
  username: string;
};

export type JwtSecret = {
  key: string;
  type: string;
};

export type AuthResponse = {
  message: string;
  success: boolean;
  token: JsonWebToken | null;
};

export type SessionResponse = {
  message: string;
  success: boolean;
};

export type UserResponse = {
  message: string;
  success: boolean;
  user: User | null;
};

export type User = {
  id: string;
};

export type CAMValidateResponse = {
  validated?: boolean;
  errorCode?: string;
};

export type CAMLoginResponse = {
  userId?: string;
  errorCode?: string;
  errorMessage?: string;
};
