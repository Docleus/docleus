import { expect, test, type Page } from "@playwright/test";
import { SETUP_TOKEN_ENV } from "./global-setup.ts";
import {
  bar,
  editorBody,
  packInstallableFixture,
  paragraph,
  renameCurrentPage,
  save,
  settingsTab,
  shownBranch,
} from "./helpers.ts";

const ADMIN = { name: "Alice Admin", email: "alice@example.com" };
const EDITOR = { name: "Bob Editor", email: "bob@example.com" };
const PASSWORD = "e2e-test-password";
const ORG_SLUG = "acme";
const SITE_SLUG = "handbook";
const PAGE_TITLE = "Deployment";
const ALICE_TEXT = "Run the container behind a reverse proxy.";
const BOB_TEXT = "Bob checked the TLS settings.";
const INSTALLABLE = "@test/installable";
/** The bundled plugins the flow uses in the organization. */
const FLOW_PLUGINS = [
  "@docleus/plugin-editor",
  "@docleus/plugin-blocks-commonmark",
  "@docleus/plugin-change-requests",
  "@docleus/plugin-collab",
  "@docleus/plugin-theme-default",
  "@docleus/plugin-search-db",
];

// One product flow: each step builds on the state the previous one left.
test.describe.configure({ mode: "serial" });

let alice: Page;
let bob: Page;
let orgId = "";
let spacePath = "";
let pagePath = "";

test.beforeAll(async ({ browser }) => {
  alice = await (await browser.newContext()).newPage();
  bob = await (await browser.newContext()).newPage();
});

test.afterAll(async () => {
  await alice.context().close();
  await bob.context().close();
});

/** Opens the account menu and goes to instance settings. */
async function openInstanceSettings(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Account" }).click();
  await page
    .getByRole("menu", { name: "Account" })
    .getByRole("menuitem", { name: "Instance settings" })
    .click();
}

async function openOrgSettings(page: Page, tab: string): Promise<void> {
  await page.goto(`/orgs/${orgId}`);
  await page.getByRole("link", { name: "Organization settings" }).click();
  await settingsTab(page, tab).click();
}

test("first boot sets up the instance admin", async () => {
  const token = process.env[SETUP_TOKEN_ENV];
  expect(token).toBeTruthy();
  await alice.goto("/");
  await expect(alice).toHaveURL(/\/setup$/);
  const form = alice.getByRole("form", { name: "Set up" });
  await form.getByLabel("Setup token").fill(token ?? "");
  await form.getByLabel("Name").fill(ADMIN.name);
  await form.getByLabel("Email").fill(ADMIN.email);
  await form.getByLabel("Password").fill(PASSWORD);
  await form.getByRole("button", { name: "Create administrator" }).click();
  await expect(
    alice.getByRole("heading", { name: "Organizations" }),
  ).toBeVisible();
  await alice.getByRole("button", { name: "Account" }).click();
  await expect(
    alice.getByRole("menuitem", { name: "Instance settings" }),
  ).toBeVisible();
  await alice.keyboard.press("Escape");
});

test("the admin creates an organization and a space with the plugins on", async () => {
  const org = alice.getByRole("form", { name: "Create organization" });
  await org.getByLabel("Name").fill("Acme");
  await org.getByLabel("Slug").fill(ORG_SLUG);
  await org.getByRole("button", { name: "Create organization" }).click();
  await expect(alice).toHaveURL(/\/orgs\/[^/?]+$/);
  orgId = new URL(alice.url()).pathname.split("/")[2] ?? "";

  await alice
    .getByRole("main")
    .getByRole("button", { name: "New space" })
    .click();
  const space = alice.getByRole("form", { name: "Create space" });
  await space.getByLabel("Name").fill("Handbook");
  await space.getByLabel("Slug").fill("handbook");
  await space.getByRole("button", { name: "Create space" }).click();
  await expect(alice).toHaveURL(/\/orgs\/[^/]+\/spaces\/[^/]+$/);
  spacePath = new URL(alice.url()).pathname;

  // Creating an organization in the app enables every installed plugin
  // (orgs.tsx); the settings page shows the server's state for each.
  await openOrgSettings(alice, "Plugins");
  for (const plugin of FLOW_PLUGINS) {
    await expect(
      alice
        .getByRole("group", { name: `Enable ${plugin}` })
        .getByRole("button", { name: "On" }),
    ).toHaveAttribute("aria-pressed", "true");
  }
});
test("a second user joins by invitation and becomes a space editor", async () => {
  await openOrgSettings(alice, "Members");
  const invite = alice.getByRole("form", { name: "Invite" });
  await invite.getByRole("button", { name: "Invite" }).click();
  const link = alice.getByLabel("Invitation link");
  await expect(link).toHaveValue(/\/invitations\//);
  const invitationUrl = await link.inputValue();

  await bob.goto(invitationUrl);
  const signup = bob.getByRole("form", { name: "Create account" });
  await signup.getByLabel("Name").fill(EDITOR.name);
  await signup.getByLabel("Email").fill(EDITOR.email);
  await signup.getByLabel("Password").fill(PASSWORD);
  await signup.getByRole("button", { name: "Create account" }).click();
  await expect(bob).toHaveURL(new RegExp(`/orgs/${orgId}$`));
  await expect(
    bob.getByRole("link", { name: "Handbook" }).first(),
  ).toBeVisible();

  await alice.goto(`${spacePath}/settings`);
  const add = alice.getByRole("form", { name: "Add member" });
  await add
    .getByLabel("Member")
    .selectOption({ label: `${EDITOR.name} (${EDITOR.email})` });
  await add.getByLabel("Role").selectOption({ label: "Editor" });
  await add.getByRole("button", { name: "Add" }).click();
  await expect(
    alice.getByRole("table", { name: "Space members" }).getByRole("row", {
      name: new RegExp(EDITOR.email),
    }),
  ).toBeVisible();
});

test("both users edit one page together on a change request", async () => {
  await alice.goto(spacePath);
  await alice
    .getByRole("button", { name: /^\+? ?New page$/ })
    .first()
    .click();
  await expect(alice).toHaveURL(/\/pages\/[^/?]+(\?.*)?$/);
  // The default workflow moves an edit at main to a new change request.
  expect(shownBranch(alice)).toBe("cr/1");
  await expect(editorBody(alice)).toBeVisible();
  await renameCurrentPage(alice, PAGE_TITLE);
  pagePath = new URL(alice.url()).pathname;

  await bob.goto(alice.url());
  await expect(bob.getByRole("heading", { level: 1 })).toHaveText(PAGE_TITLE);
  await expect(editorBody(bob)).toBeVisible();

  await editorBody(alice).click();
  await alice.keyboard.type(ALICE_TEXT);
  await expect(paragraph(bob, ALICE_TEXT)).toBeVisible();

  await paragraph(bob, ALICE_TEXT).click();
  await bob.keyboard.press("End");
  await bob.keyboard.press("Enter");
  await bob.keyboard.type(BOB_TEXT);
  await expect(paragraph(alice, BOB_TEXT)).toBeVisible();
  await expect(paragraph(alice, ALICE_TEXT)).toBeVisible();

  await save(alice);
});

test("the admin merges the change request", async () => {
  const merge = bar(alice).getByRole("button", { name: "Merge" });
  await expect(merge).toBeEnabled();
  await merge.click();
  await expect(bar(alice).getByRole("button", { name: "Done" })).toHaveCount(0);
  expect(shownBranch(alice)).toBe("main");

  await alice.goto(pagePath);
  await expect(paragraph(alice, ALICE_TEXT)).toBeVisible();
  await expect(paragraph(alice, BOB_TEXT)).toBeVisible();
});

const siteUrl = `/sites/${ORG_SLUG}/${SITE_SLUG}/`;

test("the space is published to a site that shows the merged page", async () => {
  // Publishing starts from the space's top bar; the first publish names the address.
  await alice.goto(spacePath);
  await bar(alice).getByRole("button", { name: /^Publish/ }).click();
  const publish = alice.getByRole("dialog", { name: "Publish this space" });
  await publish.getByLabel("Site address").fill(SITE_SLUG);
  await publish.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(
    alice.getByRole("status").filter({ hasText: /^Published / }).first(),
  ).toBeVisible();
  await expect(bar(alice).getByRole("button", { name: "Live" })).toBeVisible();

  // Organization settings list it, with a way to manage it in the space.
  await openOrgSettings(alice, "Sites");
  const row = alice
    .getByRole("table", { name: "Sites of spaces" })
    .getByRole("row", { name: /Handbook/ });
  await expect(row).toContainText(siteUrl);
  await expect(row).toContainText("Live");

  // The first top-level page is the site's home page.
  await alice.goto(siteUrl);
  const main = alice.getByRole("main");
  await expect(main.getByRole("heading", { level: 1 })).toHaveText(PAGE_TITLE);
  await expect(main).toContainText(ALICE_TEXT);
  await expect(main).toContainText(BOB_TEXT);
});

test("the site search finds the page", async () => {
  await alice.goto(siteUrl);
  const search = alice.getByRole("search");
  await search.getByRole("searchbox", { name: "Search" }).fill("proxy");
  const hit = search.getByRole("link", { name: new RegExp(PAGE_TITLE) });
  await expect(hit).toBeVisible();
  await expect(hit).toContainText("reverse proxy");
  await expect(search.getByRole("link")).toHaveCount(1);

  await hit.click();
  await expect(alice).toHaveURL(new RegExp(`${siteUrl}$`));
  await expect(
    alice.getByRole("main").getByRole("heading", { level: 1 }),
  ).toHaveText(PAGE_TITLE);
});

test("the admin installs a plugin at runtime and uninstalls it", async () => {
  await alice.goto("/");
  await openInstanceSettings(alice);
  await settingsTab(alice, "Installed plugins").click();
  await expect(alice).toHaveURL("/settings/installed");
  const installed = alice.getByRole("table", { name: "Installed plugins" });
  const row = installed.getByRole("row", { name: INSTALLABLE });

  await alice.getByRole("button", { name: "Install a plugin…" }).click();
  const upload = alice.getByRole("form", { name: "Upload plugin" });
  await upload
    .getByLabel("Tarball (.tgz)")
    .setInputFiles(packInstallableFixture());
  await upload.getByRole("button", { name: "Install", exact: true }).click();
  await expect(alice.getByRole("status")).toHaveText(
    `Installed ${INSTALLABLE} 1.0.0. Enable it in an organization's plugin settings.`,
  );
  await expect(row).toContainText("Upload stamp.tgz");

  await openOrgSettings(alice, "Plugins");
  await expect(alice.getByLabel(`Enable ${INSTALLABLE}`)).toBeVisible();

  await alice.goto("/settings/installed");
  alice.once("dialog", (dialog) => void dialog.accept());
  await row.getByRole("button", { name: `Uninstall ${INSTALLABLE}` }).click();
  await expect(alice.getByRole("status")).toHaveText(
    `Uninstalled ${INSTALLABLE}.`,
  );
  await expect(row).toHaveCount(0);

  await openOrgSettings(alice, "Plugins");
  await expect(
    alice.getByLabel(`Enable ${FLOW_PLUGINS[0] ?? ""}`),
  ).toBeVisible();
  await expect(alice.getByLabel(`Enable ${INSTALLABLE}`)).toHaveCount(0);
});
