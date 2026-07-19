import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const scriptUrl = new URL('./phase-3-vps.sh', import.meta.url);

test('phase-3 VPS gate is explicit, production-aware and secret-safe', async () => {
  const script = await readFile(scriptUrl, 'utf8');

  assert.match(script, /EXPECTED_CONFIRMATION="RUN_PHASE_3_CONTROLLED_GATE"/);
  assert.match(script, /PHASE3_VPS_CONFIRM.*EXPECTED_CONFIRMATION/);
  assert.match(script, /PHASE3_RUN_ISOLATED_DB_GATES.*:-false/);
  assert.match(script, /PHASE3_RUN_MUTATING_E2E.*:-false/);
  assert.match(script, /PHASE3_RUN_RESTART.*:-false/);
  assert.match(script, /EXPECTED_RESTART_CONFIRMATION="RUN_PHASE_3_RESTART_GATE"/);
  assert.match(script, /PHASE3_RESTART_CONFIRM.*EXPECTED_RESTART_CONFIRMATION/);
  assert.match(script, /\[E2E-PHASE3\]/);
  assert.match(script, /trap cleanup EXIT/);

  assert.match(script, /docker compose.*config --quiet/);
  assert.match(script, /'20260719013000'/);
  assert.match(script, /127\.0\.0\.1:8091\/health/);
  assert.match(script, /127\.0\.0\.1:8091\/ready/);
  assert.match(script, /20260718193003/);
  assert.match(script, /20260719012000/);
  assert.match(script, /marketing_ops_schedule_queries_total/);
  assert.match(script, /marketing_ops_notifications_produced_total/);
  assert.match(script, /supabase test db --local/);
  assert.match(script, /supabase db reset --local/);
  assert.match(script, /supabase stop --no-backup/);
  assert.match(script, /MARKETING_OPS_E2E_ENABLED=true/);
  assert.match(script, /chromium\.executablePath/);
  assert.match(script, /marketing_ops\.campaign_items/);
  assert.match(script, /marketing_ops\.content_versions/);
  assert.match(script, /logs --since/);
  assert.match(script, /sensitive log categories detected/);

  assert.doesNotMatch(script, /supabase db reset --linked/);
  assert.doesNotMatch(script, /supabase db push/);
  assert.doesNotMatch(script, /docker compose[^\n]*\bdown\b/);
  assert.doesNotMatch(script, /docker volume (rm|prune)/);
  assert.doesNotMatch(script, /git (reset|clean)/);
  assert.doesNotMatch(script, /\b(set -x|printenv|source \.env|eval )/);
});
