import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = join(import.meta.dirname, "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const rows = [
  ...readFileSync(join(root, "bundle.yaml"), "utf8").matchAll(
    /^\s+plugin: \.\/node_modules\/(\S+)$/gm,
  ),
].map((match) => match[1]);

test("the bundle lists every plugin dependency once", () => {
  const plugins = Object.keys(pkg.dependencies).filter((name) =>
    name.startsWith("@docleus/plugin-"),
  );
  assert.deepEqual([...rows].sort(), plugins.sort());
});

test("every bundle row points at an installed plugin with a manifest", () => {
  for (const name of rows) {
    assert.ok(
      existsSync(join(root, "node_modules", name, "docleus.plugin.json")),
      `${name} has no docleus.plugin.json`,
    );
  }
});

test("the distribution and bundled plugins form one preview release", () => {
  const server = JSON.parse(
    readFileSync(
      join(root, "node_modules/@docleus/server/package.json"),
      "utf8",
    ),
  );
  assert.equal(pkg.version, server.version);
  for (const name of rows) {
    const pluginRoot = join(root, "node_modules", name);
    const plugin = JSON.parse(
      readFileSync(join(pluginRoot, "package.json"), "utf8"),
    );
    const manifest = JSON.parse(
      readFileSync(join(pluginRoot, "docleus.plugin.json"), "utf8"),
    );
    assert.equal(plugin.version, pkg.version, `${name}: package version`);
    assert.equal(manifest.version, pkg.version, `${name}: manifest version`);
    assert.equal(
      manifest.engines.docleus,
      `^${pkg.version}`,
      `${name}: platform range`,
    );
    assert.equal(
      plugin.peerDependencies["@docleus/sdk"],
      `^${pkg.version}`,
      `${name}: SDK range`,
    );
  }
});

test("deployment defaults and build commands use the distribution version", () => {
  const image = `docleus:${pkg.version}`;
  for (const file of [
    "compose.small.yaml",
    "compose.yaml",
    ".env.example",
    "Dockerfile",
    "README.md",
    "DEPLOYMENT.md",
    "RELEASING.md",
  ]) {
    const images = [
      ...readFileSync(join(root, file), "utf8").matchAll(
        /docleus:\d+\.\d+\.\d+/g,
      ),
    ].map((match) => match[0]);
    assert.ok(images.length > 0, `${file}: missing image reference`);
    assert.ok(
      images.every((reference) => reference === image),
      `${file}: stale image reference`,
    );
  }
  assert.ok(pkg.scripts.image.includes(`-t ${image} `));
});
