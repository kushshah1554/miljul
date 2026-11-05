export type AuthUser = {
  id: string;
  email: string;
  name: string;
  // Not in the access token, so absent on req.user
  profileUrl?: string | null;
};

export type AccessTokenPayload = {
  sub: string;
  email: string;
  name: string;
};

export type RefreshTokenPayload = {
  sub: string;
  jti: string;
};
