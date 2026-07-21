#!/bin/sh
set -eu

test -d "${PICTURE_TEMP_ROOT:-/tmp/picture-work}"
test -w "${PICTURE_TEMP_ROOT:-/tmp/picture-work}"

exec /usr/bin/tini -- "$@"
