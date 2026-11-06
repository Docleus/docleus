import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

async function loadSdk() {
  const root = fileURLToPath(new URL("../../docleus-core/", import.meta.url));
  const coreRequire = createRequire(new URL("package.json", pathToFileURL(root)));
  const sdkRequire = createRequire(
    new URL("../node_modules/@docleus/server/package.json", import.meta.url),
  );
  const { createServer, createServerModuleRunner } = await import(
    pathToFileURL(coreRequire.resolve("vite")).href
  );
  const server = await createServer({
    configFile: false,
    root,
    appType: "custom",
    logLevel: "warn",
    server: { middlewareMode: true, hmr: false, ws: false },
  });
  const runner = createServerModuleRunner(server.environments.ssr, {
    hmr: false,
  });
  try {
    return await runner.import(sdkRequire.resolve("@docleus/sdk"));
  } finally {
    await runner.close();
    await server.close();
  }
}

const { ManifestSchema, satisfiesRange } = await loadSdk();

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
    if (!ManifestSchema.shape.version.safeParse(pkg.version).success) {
      errors.push(`${name}: invalid release version`);
    }
  }
  if (errors.length > 0) return errors;
  if (server.version !== sdk.version) {
    errors.push("server and SDK versions differ");
  }
  for (const { pkg, manifest } of plugins) {
    if (!ManifestSchema.shape.version.safeParse(pkg.version).success) {
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
      !satisfiesRange(server.version, manifest.engines.docleus)
    ) {
      errors.push(
        `${pkg.name}: platform version is outside the declared range`,
      );
    }
    const peer = pkg.peerDependencies?.["@docleus/sdk"];
    if (!peer || !satisfiesRange(sdk.version, peer)) {
      errors.push(`${pkg.name}: SDK version is outside the peer range`);
    }
  }
  return errors;
}
