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

test('non-mutating native gate never runs database-backed Marketing Ops tests', async () => {
  const script = await readFile(scriptUrl, 'utf8');
  const nativeGate = script.match(
    /run_native_gates\(\) \{(?<body>[\s\S]*?)\n\}\n\nassert_transactional_pgtap/
  )?.groups?.body;
  const isolatedGate = script.match(
    /run_isolated_database_gates\(\) \{(?<body>[\s\S]*?)\n\}\n\nrun_mutating_e2e/
  )?.groups?.body;

  assert.ok(nativeGate, 'run_native_gates body must be discoverable');
  assert.ok(isolatedGate, 'run_isolated_database_gates body must be discoverable');

  const nativeMarketingOps = nativeGate.match(
    /pushd services\/marketing-ops[\s\S]*?popd >\/dev\/null/
  )?.[0];
  const nativeChatWeb = nativeGate.match(
    /pushd apps\/chat-web[\s\S]*?popd >\/dev\/null/
  )?.[0];

  assert.ok(nativeMarketingOps, 'native Marketing Ops gate must be discoverable');
  assert.ok(nativeChatWeb, 'native chat-web gate must be discoverable');
  assert.doesNotMatch(nativeMarketingOps, /^\s*npm test\s*$/m);
  assert.doesNotMatch(nativeMarketingOps, /test:campaign-list-performance/);
  assert.doesNotMatch(nativeMarketingOps, /test:schedule-performance/);

  assert.match(
    nativeChatWeb,
    /MARKETING_OPS_E2E_ENABLED=false MARKETING_OPS_CALENDAR_E2E_ENABLED=false npm run e2e/
  );
  assert.doesNotMatch(nativeChatWeb, /^\s*npm run e2e\s*$/m);

  const localDatabaseUrl = "'postgresql://postgres:postgres@127.0.0.1:55322/postgres'";
  for (const command of [
    'npm test',
    'npm run test:campaign-list-performance',
    'npm run test:schedule-performance'
  ]) {
    assert.ok(
      isolatedGate.includes(`MARKETING_OPS_TEST_DATABASE_URL=${localDatabaseUrl} ${command}`),
      `${command} must use the literal local test database`
    );
  }
  assert.doesNotMatch(isolatedGate, /NEXUS_SUPABASE_DATABASE_URL/);
});
