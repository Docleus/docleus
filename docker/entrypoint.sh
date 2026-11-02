#!/bin/sh
# Writes the settings the environment sets into <data>/docleus.yaml, on every
# boot, then serves. Extra arguments go to `docleus serve`, for example
# `--role worker`; `migrate` as the first argument runs `docleus migrate`
# instead and exits.
set -eu
data="${DOCLEUS_DATA:-/data}"
command=serve
if [ "${1:-}" = migrate ]; then
  command=migrate
  shift
fi
overrides="$(node /opt/docleus/docleus/docker/env-overrides.mjs)"
node /opt/docleus/docleus-core/scripts/dev.ts configure \
  --data "$data" \
  --header "DOCLEUS_* settings from the environment are written here on every boot and win over edits." \
  --set "$overrides"
if [ "$command" = migrate ]; then
  exec node /opt/docleus/docleus-core/scripts/dev.ts migrate \
    --bundle /opt/docleus/docleus/bundle.yaml \
    --data "$data" \
    "$@"
fi
exec node /opt/docleus/docleus-core/scripts/dev.ts serve \
  --bundle /opt/docleus/docleus/bundle.yaml \
  --data "$data" \
  --host 0.0.0.0 \
  --port "${PORT:-3000}" \
  "$@"
