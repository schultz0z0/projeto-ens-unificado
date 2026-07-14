#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

readonly EXPECTED_CONFIRMATION="RUN_PHASE_2_CONTROLLED_GATE"
readonly EXPECTED_RESTART_CONFIRMATION="RUN_PHASE_2_RESTART_GATE"
readonly E2E_FIXTURE_PREFIX="[E2E-PHASE2]"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOG_DIR="$ROOT/tmp/phase-2-vps"
LOG_FILE="$LOG_DIR/services.log"
SUPABASE_STARTED_BY_SCRIPT=false
ISOLATED_DB_TOUCHED=false

PHASE2_VPS_CONFIRM="${PHASE2_VPS_CONFIRM:-}"
PHASE2_RUN_NATIVE_GATES="${PHASE2_RUN_NATIVE_GATES:-true}"
PHASE2_RUN_ISOLATED_DB_GATES="${PHASE2_RUN_ISOLATED_DB_GATES:-false}"
PHASE2_RUN_MUTATING_E2E="${PHASE2_RUN_MUTATING_E2E:-false}"
PHASE2_RUN_RESTART="${PHASE2_RUN_RESTART:-false}"
PHASE2_RESTART_CONFIRM="${PHASE2_RESTART_CONFIRM:-}"
PHASE2_LOG_SINCE="${PHASE2_LOG_SINCE:-15m}"
PHASE2_PERSISTENCE_CAMPAIGN_ID="${PHASE2_PERSISTENCE_CAMPAIGN_ID:-}"
PHASE2_PERSISTENCE_ARTIFACT_ID="${PHASE2_PERSISTENCE_ARTIFACT_ID:-}"

COMPOSE=(docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml)

fail() {
  printf 'Phase 2 VPS gate: %s\n' "$1" >&2
  exit 1
}

on_error() {
  printf 'Phase 2 VPS gate failed at line %s; command output above is the sanitized evidence.\n' "$1" >&2
}

cleanup() {
  local status=$?
  trap - EXIT
  if [[ "$ISOLATED_DB_TOUCHED" == "true" ]]; then
    (cd "$ROOT/apps/chat-web" && npx supabase db reset --local >/dev/null) \
      || printf 'Warning: isolated database fixture cleanup requires manual verification.\n' >&2
  fi
  if [[ "$SUPABASE_STARTED_BY_SCRIPT" == "true" ]]; then
    (cd "$ROOT/apps/chat-web" && npx supabase stop --no-backup >/dev/null) \
      || printf 'Warning: isolated Supabase cleanup requires manual verification.\n' >&2
  fi
  if [[ -f "$LOG_FILE" ]]; then
    chmod 600 "$LOG_FILE" || true
  fi
  exit "$status"
}

trap 'on_error "$LINENO"' ERR
trap cleanup EXIT

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "required command is unavailable: $1"
}

require_boolean() {
  local name="$1"
  local value="$2"
  [[ "$value" == "true" || "$value" == "false" ]] || fail "$name must be true or false"
}

require_uuid() {
  local name="$1"
  local value="$2"
  [[ "$value" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$ ]] \
    || fail "$name must be a UUID"
}

assert_clean_main() {
  [[ "$(git branch --show-current)" == "main" ]] || fail "run this gate from branch main"
  [[ -z "$(git status --porcelain --untracked-files=normal)" ]] || fail "worktree must be clean before the VPS gate"
  git diff --check
}

validate_env_file() {
  [[ -f .env ]] || fail ".env is required at the repository root"
  local permissions
  permissions="$(stat -c '%a' .env)"
  [[ "${permissions: -1}" == "0" ]] || fail ".env must not be readable or writable by other users"

  node --input-type=module <<'NODE'
import { readFileSync } from 'node:fs';

const parsed = Object.create(null);
for (const rawLine of readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line || line.startsWith('#')) continue;
  const separator = line.indexOf('=');
  if (separator < 1) continue;
  const key = line.slice(0, separator).trim();
  let value = line.slice(separator + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  parsed[key] = value;
}

const required = [
  'NEXUS_SUPABASE_DATABASE_URL',
  'NEXUS_APP_SUPABASE_URL',
  'NEXUS_APP_SUPABASE_ANON_KEY',
  'NEXUS_RAG_SUPABASE_URL',
  'NEXUS_MARKETING_OPS_INTERNAL_KEY',
  'NEXUS_MARKETING_OPS_DELEGATION_ACTIVE_KEY',
  'NEXUS_ARTIFACT_INTERNAL_KEY',
  'NEXUS_ARTIFACT_ACCESS_TOKEN_SECRET',
  'NEXUS_MARKETING_OPS_RAG_URL',
  'NEXUS_PUBLIC_MARKETING_OPS_URL'
];
const placeholder = /change[_-]?me|example\.invalid|seu[-_]|placeholder/i;
for (const key of required) {
  const value = parsed[key];
  if (!value || placeholder.test(value)) throw new Error(`invalid or placeholder production value: ${key}`);
}
for (const key of [
  'NEXUS_MARKETING_OPS_FEATURE_READ',
  'NEXUS_MARKETING_OPS_FEATURE_WRITE',
  'NEXUS_MARKETING_OPS_FRONTEND_ENABLED',
  'NEXUS_MARKETING_OPS_FRONTEND_READ',
  'NEXUS_MARKETING_OPS_FRONTEND_WRITE',
  'NEXUS_MARKETING_OPS_FRONTEND_KILL_SWITCH'
]) {
  if (!['true', 'false'].includes(parsed[key])) throw new Error(`invalid boolean production value: ${key}`);
}
const appHost = new URL(parsed.NEXUS_APP_SUPABASE_URL).host;
const ragHost = new URL(parsed.NEXUS_RAG_SUPABASE_URL).host;
if (appHost === ragHost) throw new Error('app and RAG Supabase projects must be distinct');
if (new URL(parsed.NEXUS_PUBLIC_MARKETING_OPS_URL).protocol !== 'https:') {
  throw new Error('public Marketing Ops URL must use HTTPS');
}
console.log('environment contract: PASS (values withheld)');
NODE
}

assert_compose_running() {
  docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml config --quiet
  "${COMPOSE[@]}" ps

  local service container state health
  for service in marketing-ops artifact-server rag-mcp app-frontend; do
    container="$("${COMPOSE[@]}" ps -q "$service")"
    [[ -n "$container" ]] || fail "Compose service is missing: $service"
    state="$(docker inspect --format '{{.State.Status}}' "$container")"
    [[ "$state" == "running" ]] || fail "Compose service is not running: $service"
    health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container")"
    if [[ "$health" != "none" && "$health" != "healthy" ]]; then
      fail "Compose service is not healthy: $service"
    fi
    printf 'compose service %s: running/%s\n' "$service" "$health"
  done
}

probe_http_and_metrics() {
  curl -fsS --max-time 10 -o /dev/null http://127.0.0.1:8095/health
  curl -fsS --max-time 10 -o /dev/null http://127.0.0.1:8000/health
  curl -fsS --max-time 10 -o /dev/null http://127.0.0.1:8091/health
  curl -fsS --max-time 10 -o /dev/null http://127.0.0.1:8091/ready

  "${COMPOSE[@]}" exec -T marketing-ops node --input-type=module <<'NODE'
const response = await fetch('http://127.0.0.1:8091/metrics', {
  headers: { 'X-Internal-Key': process.env.MARKETING_OPS_INTERNAL_KEY }
});
if (!response.ok) throw new Error(`metrics probe returned ${response.status}`);
const body = await response.text();
for (const metric of [
  'marketing_ops_requests_total',
  'marketing_ops_campaigns_created_total',
  'marketing_ops_dependency_requests_total',
  'marketing_ops_outbox_unpublished'
]) {
  if (!body.includes(metric)) throw new Error(`required metric is absent: ${metric}`);
}
console.log('protected metrics probe: PASS');
NODE
}

probe_production_schema_read_only() {
  "${COMPOSE[@]}" exec -T marketing-ops node --input-type=module <<'NODE'
import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const migration = await client.query(`
    select exists (
      select 1 from supabase_migrations.schema_migrations where version = '20260714020344'
    ) as applied
  `);
  if (!migration.rows[0]?.applied) throw new Error('phase-2 migration 20260714020344 is not applied');

  const rls = await client.query(`
    select c.relname, c.relrowsecurity, c.relforcerowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'marketing_ops'
      and c.relname = any($1::text[])
  `, [['campaigns', 'campaign_members', 'campaign_items', 'campaign_materials']]);
  if (rls.rowCount !== 4 || rls.rows.some((row) => !row.relrowsecurity || !row.relforcerowsecurity)) {
    throw new Error('required phase-2 tables are not FORCE RLS protected');
  }

  const routines = await client.query(`
    select count(*)::int as count
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'marketing_ops_private'
      and p.proname = any($1::text[])
  `, [['lock_campaign_aggregate', 'list_campaign_participants', 'list_campaign_timeline']]);
  if ((routines.rows[0]?.count ?? 0) < 3) throw new Error('required phase-2 private routines are absent');
  console.log('production schema read-only probe: PASS');
} finally {
  await client.end();
}
NODE
}

scan_service_logs() {
  mkdir -p "$LOG_DIR"
  chmod 700 "$LOG_DIR"
  "${COMPOSE[@]}" logs --since "$PHASE2_LOG_SINCE" --no-color \
    marketing-ops artifact-server rag-mcp app-frontend > "$LOG_FILE"
  chmod 600 "$LOG_FILE"

  node --input-type=module - "$LOG_FILE" <<'NODE'
import { readFileSync } from 'node:fs';

const body = readFileSync(process.argv[2], 'utf8');
const checks = new Map([
  ['bearer credential', /bearer\s+(?!\[REDACTED\])[A-Za-z0-9._~-]{12,}/i],
  ['JWT', /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ['signed URL', /https?:\/\/\S+[?&](?:token|signature|sig)=[^\s&]+/i],
  ['secret assignment', /(?:api[_-]?key|password|secret)\s*[=:]\s*["']?(?!\[REDACTED\])[A-Za-z0-9._~-]{8,}/i],
  ['campaign content', /"(?:briefing|notes?|objective|audience|filename|signedUrl|accessUrl|payload|query|content)"\s*:\s*"(?!\[REDACTED\])[^"\r\n]+"/i]
]);
const matches = [...checks].filter(([, pattern]) => pattern.test(body)).map(([name]) => name);
if (matches.length > 0) {
  throw new Error(`sensitive log categories detected: ${matches.join(', ')}`);
}
console.log('service log redaction scan: PASS (content withheld)');
NODE
}

run_native_gates() {
  [[ "$PHASE2_RUN_NATIVE_GATES" == "true" ]] || return 0

  pushd services/marketing-ops >/dev/null
  npm ci
  npx vitest run \
    src/foundation.test.ts \
    src/delegation/refresher.test.ts \
    src/plans/token.test.ts \
    src/plans/executor.test.ts \
    src/domain/contracts.test.ts \
    src/domain/queries.test.ts \
    src/domain/campaignReferences.test.ts \
    src/domain/timeline.test.ts \
    src/integrations/artifactClient.test.ts \
    src/integrations/ragCourseClient.test.ts \
    src/http/routes/references.test.ts \
    src/http/middleware.test.ts
  npx vitest run src/rest.test.ts -t "keeps every public REST operation|parses the complete strict campaign REST contract|documents required mutation headers|keeps the Express router and OpenAPI operations|publishes capabilities and default-off flags|answers trusted CORS preflight without authentication"
  npx vitest run src/mcp.test.ts -t "registers versioned tools and serves public capabilities|normalizes a numeric string version before signing an update plan"
  npx vitest run src/domain/participants.test.ts -t "participant input contracts"
  npx vitest run src/domain/materials.test.ts -t "campaign material contracts"
  npx --yes @redocly/cli@2.18.1 lint openapi/marketing-ops.v1.yaml --extends=minimal
  npm run typecheck
  npm run build
  npm audit --audit-level=high
  popd >/dev/null

  pushd services/artifact-server >/dev/null
  npm ci
  npm test
  npm audit --audit-level=high
  popd >/dev/null

  pushd services/rag-mcp >/dev/null
  npm ci
  npm test
  npm run typecheck
  npm run build
  npm audit --audit-level=high
  popd >/dev/null

  pushd apps/chat-web >/dev/null
  npm ci
  npm test
  npm run typecheck
  npm run lint
  npm run build
  npm run e2e
  DOTENV_CONFIG_PATH='../../.env' node --input-type=module <<'NODE'
import 'dotenv/config';
process.env.SUPABASE_URL = process.env.NEXUS_APP_SUPABASE_URL;
process.env.SUPABASE_ANON_KEY = process.env.NEXUS_APP_SUPABASE_ANON_KEY;
await import('./scripts/security_gate.mjs');
NODE
  npm audit --audit-level=high
  popd >/dev/null
}

assert_transactional_pgtap() {
  node --input-type=module <<'NODE'
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const directory = 'apps/chat-web/supabase/tests';
const files = readdirSync(directory).filter((name) => name.endsWith('.sql'));
if (files.length === 0) throw new Error('no pgTAP files found');
for (const file of files) {
  const sql = readFileSync(join(directory, file), 'utf8').trim();
  if (!/^begin\s*;/i.test(sql) || !/rollback\s*;\s*$/i.test(sql)) {
    throw new Error(`pgTAP file is not transactionally isolated: ${file}`);
  }
}
console.log(`pgTAP transaction guard: PASS (${files.length} files)`);
NODE
}

run_isolated_database_gates() {
  [[ "$PHASE2_RUN_ISOLATED_DB_GATES" == "true" ]] || return 0
  assert_transactional_pgtap

  pushd apps/chat-web >/dev/null
  if ! npx supabase status >/dev/null 2>&1; then
    npx supabase start -x studio,imgproxy,edge-runtime,logflare,vector,realtime,storage-api,postgres-meta,mailpit,supavisor >/dev/null
    SUPABASE_STARTED_BY_SCRIPT=true
  fi
  ISOLATED_DB_TOUCHED=true
  npx supabase db reset --local >/dev/null
  npx supabase test db --local supabase/tests
  npx supabase db lint --local --schema marketing_ops,marketing_ops_private --level warning --fail-on error
  npx supabase db advisors --local --type security --fail-on error >/dev/null
  popd >/dev/null

  pushd services/marketing-ops >/dev/null
  MARKETING_OPS_TEST_DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55322/postgres' npm test
  MARKETING_OPS_TEST_DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55322/postgres' npm run typecheck
  popd >/dev/null

  MARKETING_OPS_TEST_DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55322/postgres' \
    node apps/chat-web/scripts/test_campaign_aggregate_concurrency.mjs
}

run_mutating_e2e() {
  [[ "$PHASE2_RUN_MUTATING_E2E" == "true" ]] || return 0

  pushd apps/chat-web >/dev/null
  # MARKETING_OPS_E2E_ENABLED=true is injected only into this controlled child process.
  node --input-type=module <<'NODE'
import { spawnSync } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import { chromium } from '@playwright/test';
import { config } from 'dotenv';

const parsed = config({ path: '../../.env' }).parsed ?? {};
const required = [
  'MARKETING_OPS_E2E_BASE_URL',
  'MARKETING_OPS_E2E_MEMBER_EMAIL',
  'MARKETING_OPS_E2E_MEMBER_PASSWORD',
  'MARKETING_OPS_E2E_MANAGER_EMAIL',
  'MARKETING_OPS_E2E_MANAGER_PASSWORD',
  'MARKETING_OPS_E2E_ADMIN_EMAIL',
  'MARKETING_OPS_E2E_ADMIN_PASSWORD',
  'MARKETING_OPS_E2E_VIEWER_CAMPAIGN_ID',
  'MARKETING_OPS_E2E_CANDIDATE_NAME',
  'MARKETING_OPS_E2E_EXISTING_ARTIFACT_ID',
  'MARKETING_OPS_E2E_COURSE_QUERY',
  'MARKETING_OPS_E2E_COURSE_TITLE'
];
const placeholder = /change[_-]?me|example\.invalid|placeholder/i;
for (const key of required) {
  if (!parsed[key] || placeholder.test(parsed[key])) throw new Error(`missing controlled E2E value: ${key}`);
}
if (new URL(parsed.MARKETING_OPS_E2E_BASE_URL).protocol !== 'https:') {
  throw new Error('controlled E2E base URL must use HTTPS');
}
try {
  accessSync(chromium.executablePath(), constants.X_OK);
} catch {
  throw new Error('Playwright Chromium is absent; run npx playwright install chromium before the gate');
}
const childEnv = { ...process.env, MARKETING_OPS_E2E_ENABLED: 'true' };
for (const key of required) childEnv[key] = parsed[key];
const result = spawnSync('npm', ['run', 'e2e'], { env: childEnv, stdio: 'inherit', shell: false });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
NODE
  popd >/dev/null

  "${COMPOSE[@]}" exec -T marketing-ops node --input-type=module <<'NODE'
import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const result = await client.query(`
    select
      count(*) filter (where c.status <> 'archived')::int as active_campaigns,
      count(*) filter (
        where c.status = 'archived' and m.unlinked_at is null
      )::int as active_material_links,
      count(*) filter (
        where c.status = 'archived' and cm.is_primary = false
      )::int as non_primary_participants
    from marketing_ops.campaigns c
    left join marketing_ops.campaign_materials m on m.campaign_id = c.id
    left join marketing_ops.campaign_members cm on cm.campaign_id = c.id
    where c.name like '[E2E-PHASE2]%'
  `);
  const row = result.rows[0];
  if (row.active_campaigns !== 0 || row.active_material_links !== 0 || row.non_primary_participants !== 0) {
    throw new Error('controlled E2E cleanup left active fixtures or links');
  }
  console.log('controlled E2E cleanup probe: PASS (archived audit records retained)');
} finally {
  await client.end();
}
NODE
}

database_persistence_probe() {
  "${COMPOSE[@]}" exec -T \
    -e PHASE2_PERSISTENCE_CAMPAIGN_ID="$PHASE2_PERSISTENCE_CAMPAIGN_ID" \
    -e PHASE2_PERSISTENCE_ARTIFACT_ID="$PHASE2_PERSISTENCE_ARTIFACT_ID" \
    marketing-ops node --input-type=module <<'NODE'
import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const result = await client.query(`
    select exists (
      select 1 from marketing_ops.campaigns where id = $1
    ) as campaign_exists,
    exists (
      select 1 from marketing_ops.campaign_materials
      where campaign_id = $1 and artifact_id = $2 and unlinked_at is null
    ) as material_exists
  `, [process.env.PHASE2_PERSISTENCE_CAMPAIGN_ID, process.env.PHASE2_PERSISTENCE_ARTIFACT_ID]);
  if (!result.rows[0]?.campaign_exists || !result.rows[0]?.material_exists) {
    throw new Error('persistence fixture is absent from the production database');
  }
  console.log('database persistence fixture: PASS');
} finally {
  await client.end();
}
NODE
}

artifact_fingerprint() {
  PHASE2_PERSISTENCE_ARTIFACT_ID="$PHASE2_PERSISTENCE_ARTIFACT_ID" node --input-type=module <<'NODE'
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const id = process.env.PHASE2_PERSISTENCE_ARTIFACT_ID;
const metadata = JSON.parse(readFileSync(join('data/artifacts/metadata', `${id}.json`), 'utf8'));
if (metadata.id !== id || !/^[0-9a-f]{64}$/.test(metadata.sha256)) throw new Error('invalid artifact metadata');
const object = join('data/artifacts/objects', metadata.sha256.slice(0, 2), metadata.sha256);
const size = statSync(object).size;
if (size !== metadata.size || size < 1) throw new Error('artifact object size differs from metadata');
process.stdout.write(`${metadata.sha256}:${size}`);
NODE
}

wait_for_readiness() {
  local attempt
  for attempt in $(seq 1 60); do
    if curl -fsS --max-time 3 -o /dev/null http://127.0.0.1:8091/ready; then
      return 0
    fi
    sleep 2
  done
  fail "Marketing Ops readiness did not recover after restart"
}

run_restart_gate() {
  [[ "$PHASE2_RUN_RESTART" == "true" ]] || return 0
  [[ "$PHASE2_RESTART_CONFIRM" == "$EXPECTED_RESTART_CONFIRMATION" ]] \
    || fail "PHASE2_RESTART_CONFIRM must equal $EXPECTED_RESTART_CONFIRMATION"
  require_uuid PHASE2_PERSISTENCE_CAMPAIGN_ID "$PHASE2_PERSISTENCE_CAMPAIGN_ID"
  require_uuid PHASE2_PERSISTENCE_ARTIFACT_ID "$PHASE2_PERSISTENCE_ARTIFACT_ID"

  database_persistence_probe
  local before after
  before="$(artifact_fingerprint)"
  "${COMPOSE[@]}" restart artifact-server rag-mcp marketing-ops app-frontend
  wait_for_readiness
  assert_compose_running
  database_persistence_probe
  after="$(artifact_fingerprint)"
  [[ "$before" == "$after" ]] || fail "artifact fingerprint changed after restart"
  printf 'restart and persistence gate: PASS\n'
}

main() {
  cd "$ROOT"
  [[ "$(uname -s)" == "Linux" ]] || fail "this gate only runs on the Linux VPS"
  [[ "$PHASE2_VPS_CONFIRM" == "$EXPECTED_CONFIRMATION" ]] \
    || fail "PHASE2_VPS_CONFIRM must equal $EXPECTED_CONFIRMATION"

  require_boolean PHASE2_RUN_NATIVE_GATES "$PHASE2_RUN_NATIVE_GATES"
  require_boolean PHASE2_RUN_ISOLATED_DB_GATES "$PHASE2_RUN_ISOLATED_DB_GATES"
  require_boolean PHASE2_RUN_MUTATING_E2E "$PHASE2_RUN_MUTATING_E2E"
  require_boolean PHASE2_RUN_RESTART "$PHASE2_RUN_RESTART"
  for command in docker curl node npm git stat; do require_command "$command"; done
  docker info >/dev/null

  printf '== Phase 2 controlled VPS gate ==\n'
  printf 'fixture prefix: %s\n' "$E2E_FIXTURE_PREFIX"
  assert_clean_main
  validate_env_file
  assert_compose_running
  probe_http_and_metrics
  probe_production_schema_read_only
  run_native_gates
  run_isolated_database_gates
  run_mutating_e2e
  run_restart_gate
  probe_http_and_metrics
  scan_service_logs
  printf 'Phase 2 controlled VPS gate: PASS\n'
}

main "$@"
