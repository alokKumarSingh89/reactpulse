export interface AccessTokenPayload {
  sub: string;
  sid: string;
}

export interface AuthenticatedUser {
  userId: string;
  sessionId: string;
}
