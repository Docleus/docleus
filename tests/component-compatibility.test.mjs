import assert from "node:assert/strict";
import { test } from "node:test";
import { checkComponentCompatibility } from "../scripts/component-compatibility.mjs";

const DISTRIBUTION = { version: "0.0.2" };
const SERVER = { version: "0.0.6" };
const SDK = { version: "0.0.6" };
const PLUGIN = {
  pkg: {
    name: "@docleus/plugin-example",
    version: "0.0.2",
    peerDependencies: { "@docleus/sdk": ">=0.0.1 <0.0.7" },
  },
  manifest: {
    name: "@docleus/plugin-example",
    version: "0.0.2",
    engines: { docleus: ">=0.0.1 <0.0.7" },
  },
};

function check(plugin = PLUGIN, server = SERVER, sdk = SDK) {
  return checkComponentCompatibility(DISTRIBUTION, server, sdk, [plugin]);
}

test("accepts independently versioned compatible components", () => {
  assert.deepEqual(check(), []);
});

test("rejects mismatched plugin package and manifest identities", () => {
  for (const manifest of [
    { ...PLUGIN.manifest, name: "@docleus/plugin-other" },
    { ...PLUGIN.manifest, version: "0.0.1" },
  ]) {
    assert.equal(check({ ...PLUGIN, manifest }).length, 1);
  }
});

test("rejects a core release whose server and SDK versions differ", () => {
  assert.equal(check(PLUGIN, SERVER, { version: "0.0.5" }).length, 1);
});

test("rejects a platform outside the plugin's declared range", () => {
  const plugin = {
    ...PLUGIN,
    manifest: { ...PLUGIN.manifest, engines: { docleus: "^0.0.1" } },
  };
  assert.equal(check(plugin).length, 1);
});

test("rejects an SDK outside the plugin's peer range", () => {
  const plugin = {
    ...PLUGIN,
    pkg: {
      ...PLUGIN.pkg,
      peerDependencies: { "@docleus/sdk": "^0.0.1" },
    },
  };
  assert.equal(check(plugin).length, 1);
});

test("refuses missing compatibility declarations", () => {
  assert.equal(
    check({
      pkg: { ...PLUGIN.pkg, peerDependencies: {} },
      manifest: { ...PLUGIN.manifest, engines: {} },
    }).length,
    2,
  );
});

for (const range of ["0.0.1 - 0.0.6", "~>0.0.1", "||"]) {
  test(`rejects range syntax unsupported by the platform: ${range}`, () => {
    assert.equal(
      check({
        pkg: {
          ...PLUGIN.pkg,
          peerDependencies: { "@docleus/sdk": range },
        },
        manifest: { ...PLUGIN.manifest, engines: { docleus: range } },
      }).length,
      2,
    );
  });
}

test("does not infer compatibility from matching component versions", () => {
  assert.equal(
    check(PLUGIN, { version: "0.0.7" }, { version: "0.0.7" }).length,
    2,
  );
});

test("rejects invalid component release versions", () => {
  assert.equal(check(PLUGIN, { version: "latest" }).length, 1);
  assert.equal(check(PLUGIN, SERVER, { version: "main" }).length, 1);
  assert.equal(
    check({ ...PLUGIN, pkg: { ...PLUGIN.pkg, version: "main" } }).length,
    2,
  );
});
