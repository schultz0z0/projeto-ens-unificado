#!/bin/bash
set -euo pipefail

# ============================================================
# sync-config.sh - Hermes Configuration Watcher
# Monitora mudanças portáveis do Hermes e reinicia os serviços ativos.
# Não usa git e não toca em sessões/memórias.
# ============================================================

CONFIG_DIR="./data/hermes"
SERVICES="hermes-api hermes-kanban"
CHECK_INTERVAL="${CHECK_INTERVAL:-5}"

get_config_hash() {
    find "$CONFIG_DIR" -maxdepth 2 -type f \
      \( -name "config.yaml" -o -name ".env" -o -name "*.json" -o -path "*/skills/*" \) \
      -exec md5sum {} + 2>/dev/null | md5sum | awk '{print $1}'
}

if [ ! -d "$CONFIG_DIR" ]; then
    echo "❌ Erro: diretório $CONFIG_DIR não encontrado."
    echo "Crie com: mkdir -p data/hermes/skills data/hermes/cron data/hermes/plugins"
    exit 1
fi

LAST_HASH=$(get_config_hash)

echo "🔄 [$(date '+%H:%M:%S')] Hermes watcher iniciado"
echo "📁 Monitorando: $CONFIG_DIR"
echo "🐳 Serviços alvo: $SERVICES"

while true; do
    CURRENT_HASH=$(get_config_hash)

    if [ "$CURRENT_HASH" != "$LAST_HASH" ]; then
        echo "------------------------------------------------------------"
        echo "⚠️  [$(date '+%H:%M:%S')] Mudança de configuração detectada"
        echo "🔄 Reiniciando serviços: $SERVICES"

        if docker compose restart $SERVICES; then
            echo "✅ Serviços reiniciados com sucesso."
            LAST_HASH="$CURRENT_HASH"
        else
            echo "❌ Erro ao reiniciar serviços. Verifique se você está na pasta do projeto."
        fi
        echo "------------------------------------------------------------"
    fi

    sleep "$CHECK_INTERVAL"
done
