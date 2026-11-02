// Smoke test of a compose deployment: starts it under its own project name,
// sets the instance up over the API, publishes a page and reads it back
// from the published site, then removes the project and its volumes.
//   node scripts/smoke.mjs [--file compose.small.yaml] [--port 3900] [--keep]
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    file: { type: "string", default: "compose.small.yaml" },
    port: { type: "string", default: "3900" },
    project: { type: "string", default: `docleus-smoke-${process.pid}` },
    keep: { type: "boolean", default: false },
    timeout: { type: "string", default: "120" },
  },
});
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const file = resolve(root, values.file);
const origin = `http://127.0.0.1:${values.port}`;
const env = { ...process.env, DOCLEUS_PORT: values.port };
const compose = (...args) =>
  execFileSync(
    "docker",
    ["compose", "-p", values.project, "-f", file, ...args],
    { cwd: root, env, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  );

const log = (message) => process.stdout.write(`smoke: ${message}\n`);
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function waitFor(what, probe) {
  const deadline = Date.now() + Number(values.timeout) * 1000;
  for (;;) {
    const result = await probe().catch(() => undefined);
    if (result !== undefined) return result;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await sleep(1000);
  }
}

let cookie = "";
async function api(method, path, body) {
  const response = await fetch(`${origin}${path}`, {
    method,
    headers: {
      ...(cookie && { cookie }),
      ...(body !== undefined && { "content-type": "application/json" }),
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  if (!response.ok) {
    throw new Error(
      `${method} ${path}: ${response.status} ${await response.text()}`,
    );
  }
  return response.status === 204 ? undefined : response.json();
}

async function run() {
  log(`starting ${values.file} as project ${values.project} on ${origin}`);
  compose("up", "-d", "--wait");
  await waitFor("the instance", async () => {
    const response = await fetch(`${origin}/api/auth/methods`);
    return response.ok ? true : undefined;
  });
  const token = await waitFor("the setup token", async () => {
    const match = /setup token (\S+)/.exec(compose("logs", "docleus"));
    return match?.[1];
  });

  await api("POST", "/api/setup", {
    token,
    email: "admin@example.com",
    name: "Admin",
    password: "smoke-test-password",
  });
  log("set up the instance admin");
  const { org } = await api("POST", "/api/orgs", {
    slug: "smoke",
    name: "Smoke",
  });
  const { plugins } = await api("GET", `/api/orgs/${org.id}/plugins`);
  for (const plugin of plugins) {
    await api("PUT", `/api/orgs/${org.id}/plugins`, {
      plugin: plugin.name,
      enabled: true,
    });
  }
  log(`enabled ${plugins.map((plugin) => plugin.name).join(", ")}`);
  const { space } = await api("POST", `/api/orgs/${org.id}/spaces`, {
    slug: "docs",
    name: "Docs",
  });
  const spacePath = `/api/orgs/${org.id}/spaces/${space.id}`;
  // The default workflow is change requests: edit on a branch, then merge.
  const { changeRequest } = await api("POST", `${spacePath}/change-requests`, {
    title: "Welcome page",
  });
  const branch = `?branch=${encodeURIComponent(changeRequest.branch)}`;
  const { page, head } = await api("POST", `${spacePath}/pages${branch}`, {
    title: "Welcome",
  });
  const text = `Published by the smoke test ${values.project}`;
  await api("PUT", `${spacePath}/pages/${page.id}/body${branch}`, {
    base: head,
    document: {
      type: "doc",
      attrs: { blockId: "root", blockVersion: 1 },
      content: [
        {
          type: "paragraph",
          attrs: { blockId: "p1", blockVersion: 1 },
          content: [{ type: "text", text }],
        },
      ],
    },
  });
  await api(
    "POST",
    `${spacePath}/change-requests/${changeRequest.number}/merge`,
  );
  log("created org, space and page through a change request");

  const sites = `/api/orgs/${org.id}/sites`;
  const { site } = await api("POST", sites, {
    slug: "docs",
    name: "Docs",
    spaces: [{ spaceId: space.id, path: "" }],
  });
  await api("POST", `${sites}/${site.id}/publications`);
  log(`published ${site.url}`);

  const html = await waitFor("the published page", async () => {
    const response = await fetch(`${origin}${site.url}`);
    return response.ok ? response.text() : undefined;
  });
  if (!html.includes(text)) {
    throw new Error(
      `the site page does not contain "${text}":\n${html.slice(0, 2000)}`,
    );
  }
  log(`GET ${site.url} returned the page`);
}

let failed = false;
try {
  await run();
  log("passed");
} catch (error) {
  failed = true;
  process.stderr.write(
    `smoke: failed: ${error instanceof Error ? error.message : error}\n`,
  );
  try {
    process.stderr.write(compose("logs", "--tail", "50"));
  } catch {
    // The logs are only a diagnostic; the failure is already reported.
  }
} finally {
  if (values.keep) log(`kept project ${values.project}`);
  else compose("down", "--volumes", "--remove-orphans");
}
process.exit(failed ? 1 : 0);
