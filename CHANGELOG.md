# Changelog

## 0.0.8 - Unreleased

### Patch fixes

- Recover partially completed change-request merges without a second main commit, preserve the original merge revision and retain later branch edits.

### Packages and source set

- Use core and all twenty core packages at 0.0.8, with the exact official plugin/template versions in `component-releases.json`.
- Pin actual component commits, Git trees, release URLs and verified metadata checksums.
- Record verified plugin platform/SDK ranges: `>=0.0.1 <0.0.9`.
- Update distribution metadata, Compose/image defaults, build examples and the generated compatibility matrix for 0.0.8.

Container source pins and native image acceptance/publication follow the frozen source archive. npm packages remain private and unpublished.

## 0.0.7 - 2026-11-09

### Patch fixes

- Back up SQLite before migrations when boot state is malformed, preserve invalid state bytes and record current versions only after successful startup.

### Packages and source set

- Use core and all twenty core packages at 0.0.8, with the exact official plugin/template versions in `component-releases.json`.
- Pin actual component commits, Git trees, release URLs and verified metadata checksums.
- Record verified plugin platform/SDK ranges: `>=0.0.1 <0.0.9`.
- Update distribution metadata, Compose/image defaults, build examples and the generated compatibility matrix for 0.0.7.

Container source pins and native image acceptance/publication follow the frozen source archive. npm packages remain private and unpublished.

## 0.0.6 - 2026-11-09

### Patch fixes

- Require explicit site publication revisions to belong to main, preserving historical main revisions and rejecting branch snapshots before rendering or storing publications.

### Packages and source set

- Use core and all twenty core packages at 0.0.7, with the exact official plugin/template versions in `component-releases.json`.
- Pin actual component commits, Git trees, release URLs and verified metadata checksums.
- Record verified plugin platform/SDK ranges: `>=0.0.1 <0.0.8`.
- Update distribution metadata, Compose/image defaults, build examples and the generated compatibility matrix for 0.0.6.

Container source pins and native image acceptance/publication follow the frozen source archive. npm packages remain private and unpublished.

## 0.0.5 - 2026-11-09

### Patch fixes

- Lease checks that stop stale plugin installation, replacement and uninstall mutations after ownership or renewal loss, while preserving same-database runtime storage handoffs.

### Packages and source set

- Use core and all twenty core packages at 0.0.6, with the exact official plugin/template versions in `component-releases.json`.
- Pin actual component commits, Git trees, release URLs and verified metadata checksums.
- Record verified plugin platform/SDK ranges: `>=0.0.1 <0.0.7`.
- Update distribution metadata, Compose/image defaults, build examples and the generated compatibility matrix for 0.0.5.

Container source pins and native image acceptance/publication follow the frozen source archive. npm packages remain private and unpublished.

## 0.0.4 - 2026-11-09

### Patch fixes

- Restore runtime plugins, deployment configuration and frontend state when installation, replacement or uninstall database writes fail.

### Packages and source set

- Use core and all twenty core packages at 0.0.4, with the exact official plugin/template versions in `component-releases.json`.
- Pin actual component commits, Git trees, release URLs and verified metadata checksums.
- Record verified plugin platform/SDK ranges: `>=0.0.1 <0.0.5`.
- Update distribution metadata, Compose/image defaults, build examples and the generated compatibility matrix for 0.0.4.

Container source pins and native image acceptance/publication follow the frozen source archive. npm packages remain private and unpublished.

## 0.0.3 - 2026-11-08

### Patch fixes

- Successful organization and space deletions revoke grants for the deleted scopes, including an organization's descendant spaces.
- Replay historical deletions before the API accepts requests, and reconcile later content-service deletions through a durable content-log projection.
- Retry failed grant cleanup through content-log catch-up or restart without losing the pending deletion event.

### Packages and source set

- Use core and all 20 monorepo packages at 0.0.3, with official plugin and template releases at 0.0.3.
- Pin the published component commits, Git trees, release links, and verified metadata checksums in `component-releases.json`.
- Declare and verify plugin platform/SDK compatibility as `>=0.0.1 <0.0.4`, covering core 0.0.1, 0.0.2, and 0.0.3.
- Update distribution metadata, deployment image defaults, build examples, and the generated compatibility matrix for 0.0.3.
- Adapt the theme asset snapshot and supported change-request browser fixture to the new versions.

Container source pins, image acceptance, and publication follow the frozen source archive in separately reviewed steps. npm packages remain private and unpublished.

## 0.0.2 - 2026-11-08

### Patch fixes

- Core closes accepted TCP connections that have not sent a request during shutdown, while active HTTP requests finish gracefully.
- Editor preserves pending local text selections when remote caret updates arrive before the browser selection event.
- Collaboration rechecks editing and snapshot authorization after grants, users, plugin state, or branch policy change.

### Packages and source set

- Use core and all 20 monorepo packages at 0.0.2, with official plugin and template releases at 0.0.2.
- Record exact component commits, Git trees, release links, and metadata checksums in `component-releases.json`.
- Declare and verify plugin platform/SDK compatibility as `>=0.0.1 <0.0.3`, covering core 0.0.1 and 0.0.2.
- Update distribution metadata, deployment image defaults, build examples, and the generated compatibility matrix for 0.0.2.
- Adapt theme asset assertions and the supported change-request browser fixture to the new versions.

Container source pins, image acceptance, and publication follow the frozen source archive in separately reviewed steps. npm packages remain private and unpublished.

## 0.0.1 - 2026-11-03

The first public preview provides a complete source archive and independently
versioned core and plugin releases. Container delivery follows the source
publication; availability, supported platforms, and the immutable image digest
are recorded in the release's `container-0.0.1.json` asset.

### Included scope

- Accounts, invitations, organization/space roles, and OIDC sign-in.
- Tiptap block editing, Yjs collaboration, and change requests with review, merge, and conflict resolution.
- CommonMark/GFM blocks, source-preserving Markdown import/export, Mermaid, and llms.txt.
- Immutable site publications, rollback, custom domains, static export, and the default theme.
- SQLite/Postgres storage, local/S3-compatible blobs, and database full-text search.
- In-process plugins, host-provided SDK/React modules, and runtime installation.
- Docker and small/standard Compose deployment templates.

### Preparation changes

- Align source-package metadata, compatibility checks, and side-by-side development instructions.
- Separate the distribution overview from deployment/upgrade operations.
- Correct deployment-config examples to use plugin rows with stable ids.
- Add shared CI callers and community contribution/reporting templates.
- Keep the current page visible in the navigation tree when it or an ancestor is moved.
- Add a manual container publication workflow using frozen source and base-image pins, with native AMD64/ARM64 acceptance before version tagging.
- Let Compose use the prebuilt GHCR image by default, with a local-image override.
- Verify published content and the admin session after a container restart in the Compose smoke test.

### Limitations

- Every SDK extension point is experimental before 1.0.
- Packages remain private and depend on sibling source checkouts; npm distribution is not part of this preparation.
- Container publication and external-service acceptance remain separate release gates.
- Static exports do not include server-backed search.
- Git Sync, stable SDK guarantees, and AI/MCP features are outside this release's scope.
