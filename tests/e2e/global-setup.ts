import { execSync, spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const E2E_PORT = 4345;
export const E2E_RESULTS = join(tmpdir(), "docleus-dist-e2e-results");
/** The variable the global setup hands the setup token to the tests in. */
export const SETUP_TOKEN_ENV = "DOCLEUS_E2E_SETUP_TOKEN";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const CORE = join(ROOT, "../docleus-core");
const BUNDLE = join(ROOT, "bundle.yaml");
const READY_URL = `http://127.0.0.1:${String(E2E_PORT)}/api/auth/methods`;
const START_TIMEOUT_MS = 60_000;

/**
 * The repositories of the bundle rows the server loads. Disabled rows are
 * not mounted, so their plugins need no build.
 */
function enabledPluginRepos(): string[] {
  const rows = readFileSync(BUNDLE, "utf8").split(/^- /m).slice(1);
  return rows
    .filter((row) => !/^\s+disabled: true$/m.test(row))
    .map((row) => {
      const match = /plugin: \.\/node_modules\/@docleus\/(\S+)/.exec(row);
      if (!match?.[1]) throw new Error(`unexpected bundle row: ${row}`);
      return `docleus-${match[1]}`;
    });
}

async function waitForToken(child: ChildProcess): Promise<string> {
  let output = "";
  let token: string | undefined;
  child.stdout?.on("data", (chunk: Buffer) => {
    process.stdout.write(chunk);
    output += chunk.toString("utf8");
    token ??= /setup token (\S+)/.exec(output)?.[1];
  });
  const deadline = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`the server exited with ${String(child.exitCode)}`);
    }
    try {
      const response = await fetch(READY_URL);
      if (response.ok && token !== undefined) return token;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("the server did not start, or printed no setup token");
}

/**
 * Builds core and every plugin the bundle mounts, then serves the bundle
 * from an empty data directory. Not in development mode: the first boot
 * prints a setup token, which the tests use to create the admin. The CLI
 * runs with Node directly so that SIGTERM reaches it.
 */
// oxlint-disable-next-line import/no-default-export -- Playwright loads the global setup as a default export.
export default async function globalSetup(): Promise<() => Promise<void>> {
  execSync("pnpm build", { cwd: CORE, stdio: "inherit" });
  for (const repo of enabledPluginRepos()) {
    execSync("pnpm build", { cwd: join(ROOT, "..", repo), stdio: "inherit" });
  }

  const data = mkdtempSync(join(tmpdir(), "docleus-dist-e2e-"));
  const child = spawn(
    process.execPath,
    [
      "scripts/dev.ts",
      "serve",
      "--bundle",
      BUNDLE,
      "--data",
      data,
      "--port",
      String(E2E_PORT),
    ],
    { cwd: CORE, stdio: ["ignore", "pipe", "inherit"] },
  );
  try {
    process.env[SETUP_TOKEN_ENV] = await waitForToken(child);
  } catch (error) {
    child.kill("SIGKILL");
    throw error;
  }
  return async () => {
    if (child.exitCode === null) {
      const exited = once(child, "exit");
      child.kill("SIGTERM");
      await exited;
    }
    rmSync(data, { recursive: true, force: true });
  };
}
