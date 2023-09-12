export type JsonWebToken = string;

export type JwtDecode = {
  jwtErrorMessage: string;
  jwtPayload: JwtPayload | null;
};

export type JwtPayload = {
  activeRole: string;
  camToken: string;
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

export type LogoutResponse = {
  message: string;
  success: boolean;
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
  filteredGroupList: string[];
  fullName: string;
  groupList: string[];
  userId: string;
};
