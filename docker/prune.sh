#!/bin/sh
# Runs in the image's prune stage on the built /opt/docleus: keeps only what
# the server runs and reinstalls production dependencies. Core keeps its
# TypeScript sources, which the server runs through a Vite module runner;
# a plugin keeps its manifest and built files.
#   prune.sh <plugin repository>...
set -eu
cd /opt/docleus
pnpm_install() {
  pnpm install --prod --frozen-lockfile --prefer-offline --store-dir /pnpm-store "$@"
}
keep_only() {
  for entry in * .[!.]*; do
    [ -e "$entry" ] || continue
    keep=false
    for name in "$@"; do [ "$entry" = "$name" ] && keep=true; done
    [ "$keep" = true ] || rm -rf "$entry"
  done
}

find . -name node_modules -type d -prune -exec rm -rf {} +

(
  cd docleus-core
  keep_only LICENSE package.json packages pnpm-lock.yaml pnpm-workspace.yaml scripts tsconfig.json
  # Test utilities only; nothing the server imports.
  rm -rf packages/conformance packages/testing
  find packages -type d -name tests -prune -exec rm -rf {} +
  find packages -type f \( -name '*.test.ts' -o -name '*.test.tsx' -o -name '*.tsbuildinfo' \) -delete
  pnpm_install
)

for plugin in "$@"; do
  (
    cd "$plugin"
    keep_only LICENSE dist docleus.plugin.json package.json pnpm-lock.yaml pnpm-workspace.yaml stubs
    if [ -n "$(node /opt/docleus/docleus/docker/server-deps.mjs .)" ]; then
      # Build scripts already ran in the build stage.
      pnpm_install --ignore-scripts
    fi
  )
done

(
  cd docleus
  keep_only LICENSE bundle.yaml docker package.json pnpm-lock.yaml
  rm -f docker/prune.sh docker/server-deps.mjs
  pnpm_install
)

# The bundled plugins import the host's SDK, which only their dev
# dependencies linked; every plugin directory resolves it from here.
mkdir -p node_modules/@docleus
ln -s ../../docleus-core/packages/sdk node_modules/@docleus/sdk
