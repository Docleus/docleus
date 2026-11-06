import { satisfies, valid } from "semver";

export function checkComponentCompatibility(
  distribution,
  server,
  sdk,
  plugins,
) {
  const errors = [];
  for (const [name, pkg] of [
    ["distribution", distribution],
    ["server", server],
    ["SDK", sdk],
  ]) {
    if (!valid(pkg.version)) errors.push(`${name}: invalid release version`);
  }
  if (errors.length > 0) return errors;
  if (server.version !== sdk.version) {
    errors.push("server and SDK versions differ");
  }
  for (const { pkg, manifest } of plugins) {
    if (!valid(pkg.version)) {
      errors.push(`${pkg.name}: invalid plugin version`);
    }
    if (manifest.name !== pkg.name) {
      errors.push(`${pkg.name}: manifest name differs from package`);
    }
    if (manifest.version !== pkg.version) {
      errors.push(`${pkg.name}: manifest version differs from package`);
    }
    if (
      !manifest.engines?.docleus ||
      !satisfies(server.version, manifest.engines.docleus)
    ) {
      errors.push(
        `${pkg.name}: platform version is outside the declared range`,
      );
    }
    const peer = pkg.peerDependencies?.["@docleus/sdk"];
    if (!peer || !satisfies(sdk.version, peer)) {
      errors.push(`${pkg.name}: SDK version is outside the peer range`);
    }
  }
  return errors;
}
