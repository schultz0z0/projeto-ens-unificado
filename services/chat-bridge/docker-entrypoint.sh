#!/usr/bin/env sh
set -eu

mkdir -p /app/data/runs /app/data/hermes-image-inputs
chown -R node:node /app/data

exec su-exec node "$@"
