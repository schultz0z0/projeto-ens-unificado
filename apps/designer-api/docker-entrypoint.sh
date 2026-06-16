#!/usr/bin/env sh
set -eu

mkdir -p /app/outputs /app/tmp /app/temp/uploads
chown -R appuser:appuser /app/outputs /app/tmp /app/temp

exec gosu appuser "$@"
