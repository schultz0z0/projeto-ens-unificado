#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT/scripts/env/load-root-env.sh"

export VITE_SUPABASE_URL="${NEXUS_APP_SUPABASE_URL:-}"
export VITE_SUPABASE_ANON_KEY="${NEXUS_APP_SUPABASE_ANON_KEY:-}"
export VITE_CHATBOT_PROXY_URL="${NEXUS_PUBLIC_CHATBOT_PROXY_URL:-http://127.0.0.1:8081}"
export NEXT_PUBLIC_CHATBOT_PROXY_URL="$VITE_CHATBOT_PROXY_URL"
export VITE_CHAT_STREAM_FILE_HOSTS="${NEXUS_PUBLIC_CHAT_STREAM_FILE_HOSTS:-127.0.0.1,localhost}"
export VITE_CHAT_ATTACHMENTS_BUCKET="${NEXUS_CHAT_ATTACHMENTS_BUCKET:-chat-attachments}"
export NEXT_PUBLIC_CHAT_ATTACHMENTS_BUCKET="$VITE_CHAT_ATTACHMENTS_BUCKET"
cd "$ROOT/apps/chat-web"
if [ ! -x node_modules/.bin/vite ]; then
  npm install
fi
npm run dev -- --host 0.0.0.0 --port "${NEXUS_CHAT_WEB_PORT:-8088}"
