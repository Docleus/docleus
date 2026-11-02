// Prints, as JSON, the deployment settings that the environment sets, for
// `docleus configure --set`. The entrypoint applies them on every boot, so
// they win over the stored deployment config; settings the environment
// leaves unset keep their stored value.
const env = process.env;

function fail(message) {
  process.stderr.write(`docleus env: ${message}\n`);
  process.exit(1);
}

function flag(name) {
  const value = env[name];
  if (value === undefined || value === "") return undefined;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  fail(`${name} must be true or false`);
}

function text(name) {
  const value = env[name];
  return value === undefined || value === "" ? undefined : value;
}

function compact(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined),
  );
}

function oidcRow() {
  const issuer = text("DOCLEUS_OIDC_ISSUER");
  if (!issuer) return undefined;
  const clientId = text("DOCLEUS_OIDC_CLIENT_ID");
  if (!clientId)
    fail("DOCLEUS_OIDC_CLIENT_ID is required with DOCLEUS_OIDC_ISSUER");
  const scopes = text("DOCLEUS_OIDC_SCOPES");
  const source = compact({
    id: text("DOCLEUS_OIDC_ID") ?? "sso",
    label: text("DOCLEUS_OIDC_LABEL") ?? "Single sign-on",
    issuer,
    clientId,
    clientSecret: text("DOCLEUS_OIDC_CLIENT_SECRET"),
    scopes: scopes?.split(/[\s,]+/).filter(Boolean),
    signup: text("DOCLEUS_OIDC_SIGNUP"),
  });
  return {
    id: "oidc",
    disabled: false,
    config: compact({
      sources: [source],
      publicUrl: text("DOCLEUS_PUBLIC_URL"),
    }),
  };
}

// Credentials and the signing secret stay in the environment; the plugin
// reads DOCLEUS_S3_ACCESS_KEY_ID, DOCLEUS_S3_SECRET_ACCESS_KEY and
// DOCLEUS_S3_SIGNING_SECRET itself.
function blobsRow() {
  const bucket = text("DOCLEUS_S3_BUCKET");
  if (!bucket) return undefined;
  return {
    id: "blobs",
    disabled: false,
    config: compact({
      bucket,
      region: text("DOCLEUS_S3_REGION"),
      endpoint: text("DOCLEUS_S3_ENDPOINT"),
      forcePathStyle: flag("DOCLEUS_S3_FORCE_PATH_STYLE"),
      prefix: text("DOCLEUS_S3_PREFIX"),
    }),
  };
}

process.stdout.write(
  JSON.stringify(
    compact({
      publicUrl: text("DOCLEUS_PUBLIC_URL"),
      trustProxy: flag("DOCLEUS_TRUST_PROXY"),
      plugins: [oidcRow(), blobsRow()].filter(Boolean),
    }),
  ),
);
