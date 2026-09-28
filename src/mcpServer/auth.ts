import { IncomingMessage } from "http";
import { createRemoteJWKSet, jwtVerify, JWTPayload } from "jose";

/** Config for validating OAuth 2.1 bearer tokens on the HTTP transport (FR-020). specmesh is a resource
 * server only here -- it never issues or exchanges tokens, only verifies ones a consumer's own IdP issued. */
export interface OAuthConfig {
  issuer: string;
  jwksUrl: string;
  audience: string;
  /** Optional app-role claim (Entra ID "roles" convention) required to authorize a request. Unset/empty
   * means any token valid for `audience` is authorized. */
  requiredRole?: string;
}

export class UnauthorizedError extends Error {}
/** Distinct from `UnauthorizedError`: the token itself is valid, it just lacks the configured required role. */
export class ForbiddenError extends Error {}

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks(jwksUrl: string): ReturnType<typeof createRemoteJWKSet> {
  let jwks = jwksCache.get(jwksUrl);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(jwksUrl));
    jwksCache.set(jwksUrl, jwks);
  }
  return jwks;
}

function hasRequiredRole(payload: JWTPayload, requiredRole: string): boolean {
  const roles = payload["roles"];
  return Array.isArray(roles) && roles.includes(requiredRole);
}

/** Verifies the request's `Authorization: Bearer <token>` header against `config`. Throws
 * `UnauthorizedError` for a missing/invalid/expired token, `ForbiddenError` for a valid token missing
 * `config.requiredRole`. Returns the verified payload on success. */
export async function verifyBearerToken(req: IncomingMessage, config: OAuthConfig): Promise<JWTPayload> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing Bearer token");
  }
  const token = header.slice("Bearer ".length);

  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(token, getJwks(config.jwksUrl), {
      issuer: config.issuer,
      audience: config.audience,
    }));
  } catch (error) {
    throw new UnauthorizedError(error instanceof Error ? error.message : "Invalid token");
  }

  if (config.requiredRole && !hasRequiredRole(payload, config.requiredRole)) {
    throw new ForbiddenError(`Token is missing required role "${config.requiredRole}"`);
  }

  return payload;
}
