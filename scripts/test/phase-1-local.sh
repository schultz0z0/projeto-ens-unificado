#!/usr/bin/env bash
set -euo pipefail
trap 'echo "Phase 1 gate failed at line ${LINENO}: ${BASH_COMMAND}" >&2' ERR

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

echo "== Phase 1 local gate (Windows/Docker Desktop compatible) =="
bash scripts/validate.sh

pushd apps/chat-web >/dev/null
npx supabase start -x studio,imgproxy,edge-runtime,logflare,vector,realtime,storage-api,postgres-meta,mailpit,supavisor >/dev/null
npx supabase db reset --local >/dev/null
eval "$(npx supabase status -o env 2>/dev/null)"
npx supabase test db --local supabase/tests
npx supabase db lint --local --level error --fail-on error
npx supabase db advisors --local --type security --fail-on error >/dev/null
popd >/dev/null

export NEXUS_SUPABASE_DATABASE_URL="postgresql://postgres:postgres@host.docker.internal:55322/postgres"
export NEXUS_APP_SUPABASE_URL="http://host.docker.internal:55321"
export NEXUS_APP_SUPABASE_ANON_KEY="$ANON_KEY"
export NEXUS_MARKETING_OPS_INTERNAL_KEY="local-internal-key-at-least-32-bytes"
export NEXUS_MARKETING_OPS_DELEGATION_ACTIVE_KID="local-v1"
export NEXUS_MARKETING_OPS_DELEGATION_ACTIVE_KEY="local-delegation-key-at-least-32-bytes"
export NEXUS_MARKETING_OPS_FEATURE_READ="true"
export NEXUS_MARKETING_OPS_FEATURE_WRITE="true"

docker compose --env-file .env.example build marketing-ops
docker compose --env-file .env.example up -d --no-deps marketing-ops

pushd services/marketing-ops >/dev/null
export MARKETING_OPS_TEST_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:55322/postgres"
npm test
if command -v powershell.exe >/dev/null 2>&1; then
  powershell.exe -NoProfile -Command "\$env:MARKETING_OPS_E2E='true'; npm test -- --run test/integration/e2e.test.ts"
else
  MARKETING_OPS_E2E=true npm test -- --run test/integration/e2e.test.ts
fi
npm run typecheck
npm run build
npm audit --audit-level=moderate
popd >/dev/null

if [ -n "${PYTHON_BIN:-}" ]; then
  "$PYTHON_BIN" -m pytest services/hermes-runtime/docker/tests -q
elif command -v python3 >/dev/null 2>&1; then
  python3 -m pytest services/hermes-runtime/docker/tests -q
else
  echo "AVISO: pytest Hermes requer PYTHON_BIN no Windows; gate executado separadamente pelo PowerShell"
fi

pushd services/chat-bridge >/dev/null
npm test
npm audit --audit-level=moderate
popd >/dev/null

for service in services/rag-mcp services/graph-mcp; do
  pushd "$service" >/dev/null
  npm test
  npm run typecheck
  npm run build
  popd >/dev/null
done

pushd services/artifact-server >/dev/null
npm test
popd >/dev/null

pushd apps/chat-web >/dev/null
npm test
npm run typecheck
npm run lint
npm run build
popd >/dev/null

docker compose --env-file .env.example config --quiet
docker compose --env-file .env.example -f docker-compose.yml -f docker-compose.prod.yml config --quiet
if command -v git.exe >/dev/null 2>&1 && command -v wslpath >/dev/null 2>&1; then
  git.exe -C "$(wslpath -w "$ROOT")" diff --check
else
  git diff --check
fi

echo "Phase 1 local gate: PASS"
