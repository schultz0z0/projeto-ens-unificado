#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT/scripts/env/load-root-env.sh"

export NODE_ENV=development
RAG_CONFIG="${NEXUS_RAG_MCP_CONFIG:-services/rag-mcp/config/ens-rag-mcp.yaml}"
if [[ "$RAG_CONFIG" == /app/* ]]; then
  RAG_CONFIG="services/rag-mcp/config/ens-rag-mcp.yaml"
fi
if [[ "$RAG_CONFIG" == /* ]]; then
  export ENS_RAG_MCP_CONFIG="$RAG_CONFIG"
else
  export ENS_RAG_MCP_CONFIG="$ROOT/$RAG_CONFIG"
fi
export SUPABASE_URL="${NEXUS_RAG_SUPABASE_URL:-}"
export SUPABASE_SERVICE_ROLE_KEY="${NEXUS_RAG_SUPABASE_SERVICE_ROLE_KEY:-}"
export ENS_API_URL="${NEXUS_ENS_API_URL:-}"
export ENS_API_KEY="${NEXUS_ENS_API_KEY:-}"
export ENS_API_KEY_HEADER="${NEXUS_ENS_API_KEY_HEADER:-x-api-key}"
export OPENAI_API_KEY="${NEXUS_OPENAI_API_KEY:-}"
export OPENAI_EMBEDDING_MODEL="${NEXUS_OPENAI_EMBEDDING_MODEL:-text-embedding-3-small}"
export OPENAI_EMBEDDING_BASE_URL="${NEXUS_OPENAI_EMBEDDING_BASE_URL:-}"
export OPENAI_CHAT_BASE_URL="${NEXUS_OPENAI_CHAT_BASE_URL:-}"
export ENS_RAG_RERANKER_MODE="${NEXUS_RAG_RERANKER_MODE:-local}"
export ENS_RAG_RERANKER_MODEL="${NEXUS_RAG_RERANKER_MODEL:-gpt-4o-mini}"

cd "$ROOT/services/rag-mcp"
if [ ! -x node_modules/.bin/tsx ]; then
  npm install
fi
npm run dev
