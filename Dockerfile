# Build from a workspace root, which holds every repository side by side:
#   docker build -f docleus/Dockerfile -t docleus:0.0.1 .
# The plugins link to core's packages (link:../docleus-core/packages/*), so the image
# keeps the same layout under /opt/docleus. The build stage installs every
# dependency and builds; the runtime stage gets only what the server runs.
ARG NODE_IMAGE=node:24-alpine
ARG PLUGINS="docleus-plugin-blocks-commonmark docleus-plugin-editor docleus-plugin-theme-default docleus-plugin-change-requests docleus-plugin-collab docleus-plugin-search-db docleus-plugin-mermaid docleus-plugin-llms-txt docleus-plugin-auth-oidc docleus-plugin-blobs-s3"

FROM ${NODE_IMAGE} AS build
ARG NPM_REGISTRY=https://registry.npmjs.org
ENV CI=true
RUN printf 'registry=%s\n' "$NPM_REGISTRY" > /root/.npmrc \
  && npm install --global pnpm@11.21.0
WORKDIR /opt/docleus

COPY docleus-core docleus-core
RUN --mount=type=cache,id=docleus-pnpm,target=/pnpm-store \
  cd docleus-core && pnpm install --frozen-lockfile --store-dir /pnpm-store && pnpm build

ARG PLUGINS
COPY docleus-plugin-blocks-commonmark docleus-plugin-blocks-commonmark
COPY docleus-plugin-editor docleus-plugin-editor
COPY docleus-plugin-theme-default docleus-plugin-theme-default
COPY docleus-plugin-change-requests docleus-plugin-change-requests
COPY docleus-plugin-collab docleus-plugin-collab
COPY docleus-plugin-search-db docleus-plugin-search-db
COPY docleus-plugin-mermaid docleus-plugin-mermaid
COPY docleus-plugin-llms-txt docleus-plugin-llms-txt
COPY docleus-plugin-auth-oidc docleus-plugin-auth-oidc
COPY docleus-plugin-blobs-s3 docleus-plugin-blobs-s3
RUN --mount=type=cache,id=docleus-pnpm,target=/pnpm-store \
  for plugin in $PLUGINS; do \
    (cd "$plugin" && pnpm install --frozen-lockfile --store-dir /pnpm-store && pnpm build) || exit 1; \
  done

COPY docleus docleus
RUN --mount=type=cache,id=docleus-pnpm,target=/pnpm-store \
  cd docleus && pnpm install --frozen-lockfile --store-dir /pnpm-store

# Keeps what the server runs, with production dependencies only.
FROM build AS prune
ARG PLUGINS
RUN --mount=type=cache,id=docleus-pnpm,target=/pnpm-store \
  sh docleus/docker/prune.sh $PLUGINS

FROM ${NODE_IMAGE}
ARG NPM_REGISTRY=https://registry.npmjs.org
# git and pnpm serve plugin installs from a Git URL, which may need a build.
# npm itself is not needed once pnpm is installed.
RUN apk add --no-cache git \
  && npm install --global --registry="$NPM_REGISTRY" pnpm@11.21.0 \
  && npm cache clean --force \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /root/.npm \
  && mkdir /data && chown node:node /data
COPY --from=prune --chown=node:node /opt/docleus /opt/docleus
USER node
ENV NODE_ENV=production
VOLUME /data
EXPOSE 3000
ENTRYPOINT ["/opt/docleus/docleus/docker/entrypoint.sh"]
