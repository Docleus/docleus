import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { checkComponentCompatibility } from "../scripts/component-compatibility.mjs";

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

test("the distribution contains compatible core and plugin releases", () => {
  const server = JSON.parse(
    readFileSync(
      join(root, "node_modules/@docleus/server/package.json"),
      "utf8",
    ),
  );
  const sdk = JSON.parse(
    readFileSync(
      join(root, "../docleus-core/packages/sdk/package.json"),
      "utf8",
    ),
  );
  const plugins = [];
  for (const name of rows) {
    const pluginRoot = join(root, "node_modules", name);
    const plugin = JSON.parse(
      readFileSync(join(pluginRoot, "package.json"), "utf8"),
    );
    const manifest = JSON.parse(
      readFileSync(join(pluginRoot, "docleus.plugin.json"), "utf8"),
    );
    plugins.push({ pkg: plugin, manifest });
  }
  assert.deepEqual(checkComponentCompatibility(pkg, server, sdk, plugins), []);
});

test("published deployment defaults and build commands use the distribution version", () => {
  const image = `docleus:${pkg.version}`;
  for (const file of [
    "compose.small.yaml",
    "compose.yaml",
    ".env.example",
    "Dockerfile",
    "README.md",
    "DEPLOYMENT.md",
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

test("Compose can start from a registry image without sibling sources", () => {
  const image = `ghcr.io/docleus/docleus:${pkg.version}`;
  for (const file of ["compose.small.yaml", "compose.yaml"]) {
    const source = readFileSync(join(root, file), "utf8");
    const defaults = [
      ...source.matchAll(/^\s+image: \$\{DOCLEUS_IMAGE:-(.+)\}$/gm),
    ];
    assert.equal(defaults.length, file === "compose.yaml" ? 2 : 1);
    for (const reference of defaults) assert.equal(reference[1], image);
    assert.doesNotMatch(source, /^\s+build:/m);
  }
  assert.ok(
    readFileSync(join(root, ".env.example"), "utf8")
      .split("\n")
      .includes(`DOCLEUS_IMAGE=${image}`),
  );
});

test("standard storage images have immutable defaults and explicit overrides", () => {
  const source = readFileSync(join(root, "compose.yaml"), "utf8");
  for (const name of ["POSTGRES_IMAGE", "S3_IMAGE"]) {
    const image = new RegExp(`image: \\$\\{${name}:-(.+)\\}`).exec(source)?.[1];
    assert.match(image ?? "", /@sha256:[a-f0-9]{64}$/);
    assert.doesNotMatch(image, /:latest(?:@|$)/);
    assert.ok(
      readFileSync(join(root, ".env.example"), "utf8").includes(
        `# ${name}=${image}`,
      ),
    );
  }
});
