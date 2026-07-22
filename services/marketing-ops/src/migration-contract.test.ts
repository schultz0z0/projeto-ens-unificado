import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migration = new URL(
  '../../../apps/chat-web/supabase/migrations/20260722130000_phase_4_hermes_operator_audit.sql',
  import.meta.url
);

describe('Phase 4 audit migration contract', () => {
  it('adds every nullable correlation field and tenant-scoped index', async () => {
    const sql = (await readFile(migration, 'utf8')).toLowerCase();
    for (const column of [
      'operator_origin', 'chat_session_id', 'run_id', 'tool_name',
      'tool_call_id', 'plan_id', 'plan_action_index'
    ]) expect(sql).toContain(column);
    expect(sql).toContain('audit_events_chat_run_idx');
    expect(sql).toContain('audit_events_tool_call_idx');
    expect(sql).not.toContain('drop table');
  });
});
