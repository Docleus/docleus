import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(
  new URL("../node_modules/@docleus/server/package.json", import.meta.url),
);
const { parse } = require("yaml");
const workflow = parse(
  readFileSync(
    new URL("../.github/workflows/container.yml", import.meta.url),
    "utf8",
  ),
);
const PUBLICATION_GUARD = "${{ inputs.publish }}";

test("container validation does not publish by default", () => {
  const input = workflow.on.workflow_dispatch.inputs.publish;
  assert.equal(input.type, "boolean");
  assert.equal(input.default, false);
  assert.equal(workflow.env.DOCKER_BUILD_RECORD_UPLOAD, "false");
});

test("every container or artifact publication requires explicit opt-in", () => {
  let publications = 0;
  for (const [name, job] of Object.entries(workflow.jobs)) {
    for (const step of job.steps) {
      const writesPublicly =
        /^(?:docker\/login-action|actions\/upload-artifact)@/.test(
          step.uses ?? "",
        ) ||
        /docker push|docker buildx imagetools create|gh release (?:upload|edit|create)/.test(
          step.run ?? "",
        );
      if (!writesPublicly) continue;
      publications += 1;
      assert.ok(
        job.if === PUBLICATION_GUARD || step.if === PUBLICATION_GUARD,
        `${name}/${step.name ?? step.uses}: publication needs an approval gate`,
      );
    }
  }
  assert.ok(publications > 0);
  assert.equal(workflow.jobs.publish.if, PUBLICATION_GUARD);
});
