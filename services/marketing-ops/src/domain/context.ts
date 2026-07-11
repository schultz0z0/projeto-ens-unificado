import type { Pool } from 'pg';
import type { Actor } from '../auth/actor.js';

export interface CommandContext {
  pool: Pool;
  actor: Actor;
  correlationId: string;
  origin: 'rest' | 'mcp' | 'internal';
  faultInjector?: (point: string) => Promise<void>;
}
