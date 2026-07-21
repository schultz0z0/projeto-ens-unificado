import { decodeProtectedHeader, jwtVerify, type JWTPayload } from "jose";
import { z } from "zod";
import { PictureError } from "../errors.ts";

const uuid = z.string().uuid();
const claimsSchema = z.object({
  sub: uuid,
  tenant_id: z.string().regex(/^[a-z0-9-]{2,64}$/i),
  actor_role: z.enum(["member", "manager", "admin"]),
  chat_session_id: uuid,
  workspace_id: uuid,
  run_id: uuid,
  scopes: z.array(z.string().min(1).max(120)).min(1).max(30),
  jti: z.string().min(8).max(180),
  iat: z.number().int(),
  nbf: z.number().int(),
  exp: z.number().int(),
  contract_version: z.literal(1),
}).passthrough();

export interface PictureDelegationKeyring {
  activeKid: string;
  activeKey: string;
  previousKid?: string;
  previousKey?: string;
  issuer: string;
  audience: string;
  maxTtlSeconds?: number;
}

export interface PictureActor {
  userId: string;
  tenantId: string;
  role: "member" | "manager" | "admin";
  chatSessionId: string;
  workspaceId: string;
  runId: string;
  scopes: string[];
  jti: string;
}

const invalid = (cause?: unknown) => new PictureError(
  "picture_delegation_invalid",
  "Picture delegation is invalid or expired.",
  401,
  cause ? { cause } : undefined,
);

export const verifyPictureDelegation = async (
  token: string,
  requiredScopes: string[],
  options: { keyring: PictureDelegationKeyring; workspaceId?: string },
): Promise<PictureActor> => {
  try {
    const header = decodeProtectedHeader(token);
    if (header.alg !== "HS256" || typeof header.kid !== "string") throw invalid();
    const key = header.kid === options.keyring.activeKid
      ? options.keyring.activeKey
      : header.kid === options.keyring.previousKid
        ? options.keyring.previousKey
        : "";
    if (!key || key.length < 32) throw invalid();
    const verified = await jwtVerify(token, new TextEncoder().encode(key), {
      algorithms: ["HS256"],
      issuer: options.keyring.issuer,
      audience: options.keyring.audience,
      requiredClaims: ["sub", "jti", "iat", "nbf", "exp"],
      clockTolerance: 2,
    });
    const claims = claimsSchema.parse(verified.payload as JWTPayload);
    const maxTtl = Math.min(300, Math.max(15, options.keyring.maxTtlSeconds ?? 120));
    if (claims.exp <= claims.iat || claims.exp - claims.iat > maxTtl || claims.nbf > claims.iat + 2) throw invalid();
    if (options.workspaceId && options.workspaceId !== claims.workspace_id) {
      throw new PictureError("picture_delegation_workspace_denied", "Delegation does not grant this workspace.", 403);
    }
    if (!requiredScopes.every((scope) => claims.scopes.includes(scope))) {
      throw new PictureError("picture_delegation_scope_denied", "Delegation does not grant the required Picture scope.", 403);
    }
    return {
      userId: claims.sub,
      tenantId: claims.tenant_id,
      role: claims.actor_role,
      chatSessionId: claims.chat_session_id,
      workspaceId: claims.workspace_id,
      runId: claims.run_id,
      scopes: [...new Set(claims.scopes)],
      jti: claims.jti,
    };
  } catch (error) {
    if (error instanceof PictureError) throw error;
    throw invalid(error);
  }
};
