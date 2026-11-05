import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { byteFixture, researchFixture } from "./research-selection-fixture.mjs";

test("static research reader escapes records, exports original bytes and preserves native Context", async () => {
  const server = spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "preview",
      "--config",
      "vite.showcase.config.mjs",
      "--host",
      "127.0.0.1",
      "--port",
      "4331",
      "--strictPort",
    ],
    { stdio: "pipe" },
  );
  let browser,
    output = "";
  server.stdout.on("data", (chunk) => {
    output += chunk;
  });
  server.stderr.on("data", (chunk) => {
    output += chunk;
  });
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (server.exitCode !== null) throw new Error(output);
      try {
        if ((await fetch("http://127.0.0.1:4331")).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal(ready, true, output);
    browser = await chromium.launch({
      executablePath: process.env.TACITUS_TEST_BROWSER,
      headless: true,
      args: ["--no-sandbox"],
    });
    const native = await readFile("public/examples/peace.context.json");
    const value = researchFixture(),
      raw = byteFixture(value);
    await mkdir("output/showcase", { recursive: true });
    for (const width of [1440, 390]) {
      const page = await browser.newPage({
        viewport: { width, height: 1000 },
        reducedMotion: "reduce",
      });
      const errors = [],
        requests = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("request", (request) => requests.push(request.url()));
      await page.goto("http://127.0.0.1:4331");
      await page
        .getByRole("status")
        .filter({ hasText: "Recorded context loaded" })
        .waitFor();
      await page
        .getByRole("button", { name: "Research selection", exact: true })
        .click();
      assert.equal(
        await page
          .getByRole("button", { name: "Export unchanged selection JSON" })
          .isDisabled(),
        true,
      );
      const input = page.getByLabel("Research selection JSON");
      await input.setInputFiles({
        name: "selection.json",
        mimeType: "application/json",
        buffer: raw,
      });
      await page
        .getByRole("status")
        .filter({ hasText: "Research selection imported" })
        .waitFor();
      const inspector = page.getByRole("region", {
        name: "Research record inspector",
        exact: true,
      });
      await inspector
        .getByRole("heading", { name: value.records[0].label, exact: true })
        .waitFor();
      await inspector
        .getByText(value.records[0].attributes.markup, { exact: true })
        .waitFor();
      assert.equal(
        await inspector.locator("img, script, a").count(),
        0,
        "provider fields must remain text",
      );
      assert.equal(
        await page.locator('a[href="https://example.org/data"]').count(),
        2,
        "dataset URLs are explicit links",
      );
      await page
        .getByRole("button", { name: value.records[1].label, exact: true })
        .click();
      await inspector
        .getByRole("heading", { name: value.records[1].label, exact: true })
        .waitFor();
      for (const [key, expected] of [
        ["value", "0"],
        ["verified", "false"],
        ["missing", "null"],
        ["empty", '\"\" (empty string)'],
      ]) {
        const pair = inspector
          .locator(".rs-attributes > div")
          .filter({ has: page.getByText(key, { exact: true }) });
        assert.equal(await pair.locator("dd").textContent(), expected);
      }
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.screenshot({
        path: `output/showcase/research-selection-${width === 1440 ? "desktop" : "mobile"}.png`,
        fullPage: true,
      });
      const download = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Export unchanged selection JSON" })
        .click();
      assert.deepEqual(await readFile(await (await download).path()), raw);

      await input.setInputFiles({
        name: "bad.json",
        mimeType: "application/json",
        buffer: Buffer.from('{"format":"wrong"}'),
      });
      await page
        .getByRole("status")
        .filter({ hasText: "Import refused:" })
        .waitFor();
      assert.equal(
        await page
          .getByRole("region", { name: "Research records table", exact: true })
          .count(),
        0,
      );
      assert.equal(
        await page
          .getByRole("button", { name: "Export unchanged selection JSON" })
          .isDisabled(),
        true,
      );
      await input.setInputFiles({
        name: "native.json",
        mimeType: "application/json",
        buffer: native,
      });
      await page
        .getByRole("status")
        .filter({ hasText: "Native Context mode" })
        .waitFor();
      await input.setInputFiles({
        name: "oversized.json",
        mimeType: "application/json",
        buffer: Buffer.alloc(1024 * 1024 + 1, 0x20),
      });
      await page
        .getByRole("status")
        .filter({ hasText: "1 MiB file limit" })
        .waitFor();

      await page
        .getByRole("button", { name: "Native Context", exact: true })
        .click();
      await page
        .getByRole("heading", { name: "Accessible results", exact: true })
        .waitFor();
      const nativeDownload = page.waitForEvent("download");
      await page.getByRole("button", { name: "Export unchanged JSON" }).click();
      assert.deepEqual(
        await readFile(await (await nativeDownload).path()),
        native,
      );
      await page
        .getByRole("button", { name: "Context layers", exact: true })
        .click();
      await page
        .getByRole("region", { name: "Seven context layers" })
        .waitFor();
      await page
        .getByRole("button", { name: "Research selection", exact: true })
        .click();
      assert.equal(
        await page
          .getByRole("button", { name: "Export unchanged selection JSON" })
          .isDisabled(),
        true,
      );
      assert.equal(
        requests.some(
          (url) => url.includes("/api/") || url.includes("untrusted.invalid"),
        ),
        false,
      );
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally {
    await browser?.close();
    server.kill();
    await new Promise((resolve) =>
      server.exitCode !== null ? resolve() : server.once("exit", resolve),
    );
  }
});
