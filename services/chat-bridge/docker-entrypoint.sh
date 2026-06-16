#!/usr/bin/env sh
set -eu

mkdir -p /app/data/runs
chown -R node:node /app/data

exec su-exec node "$@"
