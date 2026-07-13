import { decodeProtectedHeader, jwtVerify } from 'jose';
import type { Pool } from 'pg';
import { AppError, appError } from '../errors.js';
import { resolveActor, type Actor } from '../auth/actor.js';
import { delegationClaimsSchema, type DelegationKeyring } from './claims.js';

export interface DelegatedActor extends Actor {
  scopes: string[]; jti: string; correlationId: string; chatSessionId: string; runId: string;
}
export interface MutationUse { name: string; idempotencyKey: string; requestHash: string }

export async function verifyDelegation(
  token: string,
  requiredScopes: string[],
  deps: { pool: Pool; keyring: DelegationKeyring; operation?: MutationUse }
): Promise<DelegatedActor> {
  try {
    const header = decodeProtectedHeader(token);
    if (header.alg !== 'HS256' || typeof header.kid !== 'string') throw appError('delegation_invalid', 401, 'Delegation header is invalid');
    let rawKey: string | undefined;
    if (header.kid === deps.keyring.activeKid) rawKey = deps.keyring.activeKey;
    else if (header.kid === deps.keyring.previousKid) rawKey = deps.keyring.previousKey;
    if (!rawKey) throw appError('delegation_invalid', 401, 'Delegation key id is unknown');
    const verified = await jwtVerify(token, new TextEncoder().encode(rawKey), {
      algorithms: ['HS256'], issuer: deps.keyring.issuer, audience: deps.keyring.audience,
      clockTolerance: 2, requiredClaims: ['sub', 'jti', 'iat', 'nbf', 'exp']
    });
    const claims = delegationClaimsSchema.parse(verified.payload);
    if (claims.exp - claims.iat > deps.keyring.maxTtlSeconds || claims.exp <= claims.iat) {
      throw appError('delegation_invalid', 401, 'Delegation lifetime is invalid');
    }
    if (!requiredScopes.every((scope) => claims.scopes.includes(scope))) {
      throw appError('delegation_scope_denied', 403, 'Delegation does not grant the required scope');
    }
    const actor = await resolveActor(deps.pool, claims.sub, claims.tenant_id);
    if (actor.role !== claims.actor_role) throw appError('delegation_stale', 403, 'Delegated role no longer matches current membership');

    if (deps.operation) {
      const used = await deps.pool.query(`
        insert into marketing_ops.delegation_uses
          (jti, tenant_id, actor_id, operation, idempotency_key, request_hash, expires_at)
        values ($1, $2, $3, $4, $5, $6, to_timestamp($7))
        on conflict do nothing returning jti
      `, [claims.jti, actor.tenantId, claims.sub, deps.operation.name, deps.operation.idempotencyKey, deps.operation.requestHash, claims.exp]);
      if (used.rowCount === 0) throw appError('delegation_replay', 409, 'Delegation was already consumed');
    }
    return {
      ...actor, scopes: claims.scopes, jti: claims.jti, correlationId: claims.correlation_id,
      chatSessionId: claims.chat_session_id, runId: claims.run_id
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw appError('delegation_invalid', 401, 'Delegation is invalid or expired');
  }
}
