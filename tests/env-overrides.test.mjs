import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const root = join(import.meta.dirname, "..");
const DEV = join(root, "../docleus-core/scripts/dev.ts");

// The two steps docker/entrypoint.sh runs before it serves.
function boot(data, env) {
  const overrides = execFileSync(
    process.execPath,
    [join(root, "docker/env-overrides.mjs")],
    { env: { PATH: process.env.PATH, ...env }, encoding: "utf8" },
  );
  execFileSync(
    process.execPath,
    [DEV, "configure", "--data", data, "--set", overrides],
    { encoding: "utf8" },
  );
  return readFileSync(join(data, "docleus.yaml"), "utf8");
}

test("the environment overrides the stored config on every boot", (t) => {
  const data = mkdtempSync(join(tmpdir(), "docleus-env-"));
  t.after(() => rmSync(data, { recursive: true, force: true }));

  const first = boot(data, {
    DOCLEUS_PUBLIC_URL: "https://old.example",
    DOCLEUS_OIDC_ISSUER: "https://id.example",
    DOCLEUS_OIDC_CLIENT_ID: "docs",
  });
  assert.match(first, /publicUrl: https:\/\/old\.example/);

  // A plugin installed from the admin UI and a hand edit, between boots.
  writeFileSync(
    join(data, "docleus.yaml"),
    `${first}port: 8080 # edited by hand\n`.replace(
      "plugins:\n",
      "plugins:\n  - id: '@acme/stamp'\n    plugin: ./plugins/@acme+stamp@1.0.0\n",
    ),
  );

  const second = boot(data, {
    DOCLEUS_PUBLIC_URL: "https://docs.example",
    DOCLEUS_TRUST_PROXY: "true",
    DOCLEUS_OIDC_ISSUER: "https://id.example",
    DOCLEUS_OIDC_CLIENT_ID: "docs-2",
  });
  assert.doesNotMatch(second, /old\.example/);
  assert.match(second, /^publicUrl: https:\/\/docs\.example$/m);
  assert.match(second, /^trustProxy: true$/m);
  assert.match(second, /clientId: docs-2/);
  assert.doesNotMatch(second, /clientId: docs$/m);
  assert.match(second, /port: 8080 # edited by hand/);
  assert.match(second, /plugin: \.\/plugins\/@acme\+stamp@1\.0\.0/);

  // Unset variables leave the stored values alone.
  const third = boot(data, {});
  assert.equal(third, second);
});

test("an invalid variable stops the boot", () => {
  assert.throws(
    () =>
      execFileSync(process.execPath, [join(root, "docker/env-overrides.mjs")], {
        env: { PATH: process.env.PATH, DOCLEUS_TRUST_PROXY: "maybe" },
        stdio: "pipe",
      }),
    /DOCLEUS_TRUST_PROXY must be true or false/,
  );
});
