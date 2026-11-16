import "../database/environment";

export const AUTH_CONFIG = Symbol("AUTH_CONFIG");
export interface AuthConfig {
  secret: string;
  issuer: string;
  audience: string;
  accessTtlSeconds: number;
  sessionTtlSeconds: number;
}

export function loadAuthConfig(): AuthConfig {
  const secret = process.env.JWT_SECRET;
  if (
    !secret ||
    Buffer.byteLength(secret, "utf8") < 32 ||
    secret === secret[0]?.repeat(secret.length)
  ) {
    throw new Error("JWT_SECRET must be a random secret of at least 32 bytes");
  }
  return {
    secret,
    issuer: "local-fantasy-api",
    audience: "local-fantasy-clients",
    accessTtlSeconds: 15 * 60,
    sessionTtlSeconds: 7 * 24 * 60 * 60,
  };
}
