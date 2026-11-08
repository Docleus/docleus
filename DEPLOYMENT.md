# Deployment and operations

The Docleus distribution: the default plugin set, the Docker image and compose templates.

The image runs the CLI from source through a Vite module runner. A prune stage
removes development-only dependencies. Image size depends on the base image,
architecture, and exact source revisions; measure the release image rather than
relying on a development build's size.

## Contents

| File                                    | Purpose                                                                             |
| --------------------------------------- | ----------------------------------------------------------------------------------- |
| `package.json`                          | The platform and default plugin packages linked from the side-by-side checkout      |
| `bundle.yaml`                           | The default plugin rows                                                             |
| `Dockerfile`, `Dockerfile.dockerignore` | The image, built from a side-by-side workspace root                                 |
| `compose.small.yaml`                    | One container: SQLite and local files in a volume                                   |
| `compose.yaml`                          | Postgres and an S3-compatible store (`docleus-plugin-blobs-s3`)                     |
| `Caddyfile.example`                     | TLS reverse proxy                                                                   |
| `.env.example`                          | Settings for the compose files                                                      |
| `scripts/smoke.mjs`                     | End-to-end smoke test of a compose file                                             |
| `tests/e2e/`, `playwright.config.ts`    | Browser test of the whole product against the default bundle                        |
| `COMPATIBILITY.md`                      | The plugins checked against this core, written by the maintainers' `scripts/compat` |
| `component-releases.json`               | Exact component release commits, Git trees, and metadata checksums for this source set |

## Default plugins

`docleus-plugin-blocks-commonmark`, `docleus-plugin-editor`, `docleus-plugin-theme-default`, `docleus-plugin-change-requests`, `docleus-plugin-collab`, `docleus-plugin-search-db`, `docleus-plugin-mermaid` and `docleus-plugin-llms-txt` are on. `docleus-plugin-auth-oidc` and `docleus-plugin-blobs-s3` are in the bundle but disabled until configured (see below).

Every plugin is installed for the instance. Organizations created in the browser start with every
installed plugin enabled; an organization admin can turn off the ones the
organization does not use under Settings, Plugins.

## Build the image

The prebuilt image needs no source checkout. Once the release includes
`container-0.0.5.json`, download `compose.small.yaml` from the same release and
run `docker compose -f compose.small.yaml pull`. The default image is
`ghcr.io/docleus/docleus:0.0.5`; the container record's `reference` pins its digest.

To build locally, download the complete `docleus-0.0.5-sources.tar.gz` release
asset and verify it against `SHA256SUMS`. GitHub's automatic source archives
contain only this repository and cannot build the image. Extract the complete
asset, then run from its root, where every repository sits side by side:

```sh
docker build -f docleus/Dockerfile -t docleus:0.0.5 .
# behind a registry mirror:
docker build -f docleus/Dockerfile --build-arg NPM_REGISTRY=https://registry.npmmirror.com -t docleus:0.0.5 .
export DOCLEUS_IMAGE=docleus:0.0.5
cd docleus
```

The explicit `DOCLEUS_IMAGE` selects your local build instead of the registry
default in the Compose files.

## Container release workflow

Maintainers run **Validate or publish container** manually in GitHub Actions from
the reviewed `main` commit. The default `publish: false` builds and tests both
architectures without logging in to the registry, pushing images, uploading
workflow artifacts, or changing a release. Set `publish: true` only after the
publication has been explicitly approved; that run rebuilds and tests before
publishing. `container-release.json` pins the approved source archive
checksum, distribution source commit, and Node base image digest. The workflow
downloads that archive from the matching release, so current sibling branches
cannot change the release's product sources.

`container-release.json` still pins the published `0.0.4` complete source archive
and its exact distribution source commit. Its `0.0.5` replacement requires
the merged distribution preparation commit and the final complete source-archive
checksum in a separately reviewed change. Until then, the workflow targets
`0.0.4`. The pinned Node base image is unchanged. Image validation and publication
use separate workflow runs after review of the source and publication scope.

With matching `0.0.5` source pins, native Linux AMD64 and ARM64 runners each build
an image, run the small Compose smoke including restart persistence, and push the
tested image under a candidate tag. Only after both pass does the workflow assemble
`ghcr.io/docleus/docleus:0.0.5`.
It uploads `container-0.0.5.json`, Compose files, `default.env.example`, and
`container-SHA256SUMS` to the release. The original source assets stay unchanged.
The workflow refuses to replace an existing container record. Release metadata
records the source commit and the separate workflow commit.

The workflow uses GitHub's job token with `packages: write`; maintainers do not
need a personal registry token. On the first publication, check the GHCR package
visibility and set it to public if necessary. The workflow logs out and pulls
both platforms anonymously before uploading the container record; a private
package stops this final step. There is no
`latest` tag, and a public source preview alone does not promise a container.

## Small deployment

```sh
docker compose -f compose.small.yaml pull
docker compose -f compose.small.yaml up -d
docker compose -f compose.small.yaml logs docleus   # prints the setup token
```

Open `http://localhost:3000/setup`, enter the token and create the first admin. Everything lives in the `docleus-data` volume at `/data`:

| Path                        | Contents                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------- |
| `docleus.yaml`              | The deployment config                                                                 |
| `docleus.db`                | SQLite database                                                                       |
| `blobs/`                    | Uploaded files and published sites                                                    |
| `plugins/<name>@<version>/` | Plugins installed at runtime                                                          |
| `backups/`                  | `docleus-<timestamp>.db`, taken before migrations of a new platform or plugin version |
| `blob-secret`               | Signs blob URLs, unless `DOCLEUS_BLOB_SECRET` is set                                  |

## Standard deployment

Download `compose.yaml` and `default.env.example` from the release. Copy the
downloaded environment template to `.env`. From a source checkout, the same
template is named `.env.example`:

```sh
cp .env.example .env    # set POSTGRES_PASSWORD, S3_ACCESS_KEY, S3_SECRET_KEY, S3_SIGNING_SECRET
docker compose up -d
```

Docleus connects to Postgres through `DOCLEUS_DATABASE_URL` and stores blobs in the bucket `S3_BUCKET`, which the `s3-bucket` service creates. The bundled S3 server is a placeholder; to use AWS S3, R2 or another store, remove the `s3` and `s3-bucket` services and set `S3_ENDPOINT`, `S3_REGION` and the credentials. Postgres is not backed up automatically; use `pg_dump`.

## Configuration

On every boot, the image writes the settings the environment sets into `/data/docleus.yaml`, creating the file on the first boot:

| Variable                                                                                     | Effect                                             |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `DOCLEUS_PUBLIC_URL`, `DOCLEUS_TRUST_PROXY`                                                  | `publicUrl` and `trustProxy`                       |
| `DOCLEUS_OIDC_ISSUER`, `_CLIENT_ID`, `_CLIENT_SECRET`, `_LABEL`, `_ID`, `_SCOPES`, `_SIGNUP` | enables `docleus-plugin-auth-oidc` with one source |
| `DOCLEUS_S3_BUCKET`, `_ENDPOINT`, `_REGION`, `_FORCE_PATH_STYLE`, `_PREFIX`                  | enables `docleus-plugin-blobs-s3`                  |

A variable that is set wins over the stored value, so changing it and restarting changes the setting; a variable that is empty or unset leaves the stored value alone. Everything else in the file stays as it is: other keys, comments, plugins installed from the admin UI, and the keys of a plugin row's `config` that no variable sets. `DOCLEUS_OIDC_ISSUER` sets the whole `sources` list of the `oidc` row; leave it unset to configure several sources in the file, as below. The image runs `docleus configure` for this (see `docker/entrypoint.sh`).

Secrets stay in the environment and are read at every boot: `DOCLEUS_DATABASE_URL`, `DOCLEUS_SMTP_URL` / `DOCLEUS_SMTP_FROM`, `DOCLEUS_S3_ACCESS_KEY_ID` / `DOCLEUS_S3_SECRET_ACCESS_KEY` / `DOCLEUS_S3_SIGNING_SECRET`, and `DOCLEUS_BLOB_SECRET`, which signs the URLs of local blobs (at least 32 characters; when unset, one is generated once into `/data/blob-secret`, so processes sharing `/data` agree on it).

The deployment config patches `bundle.yaml` by row id. For example, to configure two OIDC sources and turn off mermaid:

```yaml
publicUrl: https://docs.example.com
trustProxy: true
plugins:
  - id: oidc
    disabled: false
    config:
      sources:
        - {
            id: corp,
            label: Corp SSO,
            issuer: https://idp.example.com,
            clientId: docleus,
            clientSecret: "...",
          }
        - {
            id: google,
            label: Google,
            issuer: https://accounts.google.com,
            clientId: "...",
            clientSecret: "...",
          }
  - id: mermaid
    disabled: true
```

Arguments after the image name go to `docleus serve`; `migrate` as the first one runs `docleus migrate` instead. To run jobs in a separate container, start a second service from the same image with `command: ["--role", "worker"]` and the first with `["--role", "web"]`; both need the same database and blob store, so this needs the standard deployment.

## Reverse proxy

Terminate TLS in front of Docleus; `Caddyfile.example` shows Caddy for the editor domain and for sites bound to their own domains. Set `DOCLEUS_PUBLIC_URL` and `DOCLEUS_TRUST_PROXY=true` behind a proxy.

## Installing plugins

An instance admin installs plugins under Instance settings, Plugins, without a restart: upload an `npm pack` tarball, give a path on the server, or a Git URL and ref (cloned shallowly; built with `pnpm install --frozen-lockfile && pnpm build` when `dist/` is missing). Installs go to `/data/plugins` and are recorded in `docleus.yaml` with their version, source and sha256, so they are mounted again on the next boot. A plugin whose `engines.docleus` range excludes this platform version is refused (`plugin/engines-mismatch`), at install and at boot.

### For plugin authors

A tarball must be self-contained:

- It holds `docleus.plugin.json` and every entry it names, built (`dist/`).
- Server entries bundle their runtime dependencies, or the tarball ships them in `node_modules/`. Nothing is installed after unpacking.
- `@docleus/sdk` is provided by the host; a copy shipped in `node_modules/` is removed. Editor and site entries keep React and the SDK external (the host provides them through the import map).
- Paths must stay inside the archive; links, devices and absolute or `..` paths are refused.

## Upgrading

The source distribution uses local `link:` dependencies, not immutable source
pins. [COMPATIBILITY.md](COMPATIBILITY.md) records the checked package versions.
A release must also record every repository commit and the built image digest
in the release metadata. Before upgrading, back up the database, blob
store, configuration, and installed plugins. Build the reviewed source set or
set `DOCLEUS_IMAGE` to the approved image reference, then recreate the container:

```sh
docker compose -f compose.small.yaml up -d --force-recreate
```

Migrations run at boot. To run them without serving, for example before starting several containers, run `docker compose -f compose.small.yaml run --rm docleus migrate`, which migrates the database and the content of every space, then exits. When the platform version or the set of plugin versions changed since the last boot, a SQLite database is first copied to `/data/backups/docleus-<timestamp>.db`; to go back, stop the container, put that copy in place of `docleus.db` and start the previous image. Postgres is not backed up automatically: run `pg_dump` before upgrading.

Plugins installed at runtime stay installed across upgrades. If one's `engines.docleus` range excludes the new platform version, the instance refuses to start (`plugin/engines-mismatch`): upgrade or uninstall that plugin first, or remove its row from `docleus.yaml`.

## Smoke test

```sh
node scripts/smoke.mjs                       # compose.small.yaml on port 3900
node scripts/smoke.mjs --file compose.yaml   # needs the variables of .env.example
```

It starts the compose file under its own project name, creates the admin with the setup token, an organization, a space and a page (through a change request), publishes a site, checks the page is served, restarts the container, checks that the publication and admin session survive, and removes the project with its volumes (`--keep` leaves it running).

## End-to-end test

```sh
pnpm exec playwright install chromium   # once
pnpm e2e
```

It builds core and every enabled plugin of `bundle.yaml` in the sibling repositories, serves the bundle on port 4345 from a temporary data directory (SQLite and local files), and drives the product in Chromium: the admin is created with the setup token, then an organization and a space; a second user joins by invitation; both edit one page together over collab on a change request that is merged; the space is published to a site, which shows the page and finds it through search; and a plugin tarball is installed and uninstalled at runtime.

## License

[MIT](LICENSE)
