# Changelog

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
