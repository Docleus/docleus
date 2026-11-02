import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Locator, type Page } from "@playwright/test";

const FIXTURES = fileURLToPath(
  new URL(
    "../../../docleus-core/packages/server/tests/fixtures/",
    import.meta.url,
  ),
);

/** Packs core's installable test plugin with the system `tar`, as an author would. */
export function packInstallableFixture(): string {
  const out = join(mkdtempSync(join(tmpdir(), "docleus-tgz-")), "stamp.tgz");
  execFileSync("tar", ["-czf", out, "-C", FIXTURES, "installable"], {
    env: { ...process.env, COPYFILE_DISABLE: "1" },
  });
  return out;
}

export function editorBody(page: Page): Locator {
  return page.getByRole("textbox", { name: "Page body" });
}

export function paragraph(page: Page, text: string): Locator {
  return editorBody(page).locator("p").filter({ hasText: text });
}

export function pageTree(page: Page): Locator {
  return page.getByRole("navigation", { name: "Pages", exact: true });
}

export function settingsTab(page: Page, name: string): Locator {
  return page
    .getByRole("navigation", { name: "Settings" })
    .getByRole("link", { name, exact: true });
}

/** The space top bar. */
export function bar(page: Page): Locator {
  return page.locator("header.bar");
}

/** The branch the space view shows, from `?branch=`. */
export function shownBranch(page: Page): string {
  return new URL(page.url()).searchParams.get("branch") ?? "main";
}

/** Renames the current page from the tree's ⋯ menu. */
export async function renameCurrentPage(
  page: Page,
  title: string,
): Promise<void> {
  const tree = pageTree(page);
  await tree.getByRole("link", { name: "Untitled", exact: true }).hover();
  await tree.getByRole("button", { name: "Actions for Untitled" }).click();
  await page
    .getByRole("menu", { name: "Actions for Untitled" })
    .getByRole("menuitem", { name: "Rename" })
    .click();
  await page.getByLabel("Rename page").fill(title);
  await page.getByLabel("Rename page").press("Enter");
  await expect(pageTree(page).getByRole("link", { name: title })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  await expect(editorBody(page)).toBeVisible();
}

export async function save(page: Page): Promise<void> {
  await page.getByRole("textbox", { name: "Page body" }).focus();
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.locator(".bar .save-state")).toHaveText("Saved");
}
