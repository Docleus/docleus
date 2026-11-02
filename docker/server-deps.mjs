// Prints the dependencies a built plugin's server side imports, one per
// line. Browser entries bundle their libraries or take them from the host's
// import map, so a plugin whose server side imports none needs no
// node_modules (mermaid's alone is about 190 MB).
//   node server-deps.mjs <plugin dir>
import { existsSync, readFileSync } from "node:fs";
import { builtinModules } from "node:module";
import { dirname, join, resolve } from "node:path";

const SPECIFIER =
  /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)["']([^"'\s]+)["']/g;

function packageName(specifier) {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

const dir = resolve(process.argv[2] ?? ".");
const manifest = JSON.parse(
  readFileSync(join(dir, "docleus.plugin.json"), "utf8"),
);
const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
const declared = new Set(Object.keys(pkg.dependencies ?? {}));
const builtins = new Set(builtinModules);

const pending = [manifest.entries?.server, manifest.entries?.shared]
  .filter((entry) => typeof entry === "string")
  .map((entry) => resolve(dir, entry));
const seen = new Set();
const needed = new Set();
while (pending.length > 0) {
  const file = pending.pop();
  if (seen.has(file) || !existsSync(file)) continue;
  seen.add(file);
  for (const [, specifier] of readFileSync(file, "utf8").matchAll(SPECIFIER)) {
    if (specifier.startsWith(".")) {
      pending.push(resolve(dirname(file), specifier));
    } else if (!specifier.startsWith("node:") && !builtins.has(specifier)) {
      const name = packageName(specifier);
      if (declared.has(name)) needed.add(name);
    }
  }
}
for (const name of [...needed].sort()) process.stdout.write(`${name}\n`);
