import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

test("static explorer inspects layers, retains exact exports and refuses invalid imports", async () => {
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
      "4322",
      "--strictPort",
    ],
    { stdio: "pipe" },
  );
  let browser,
    output = "";
  server.stdout.on("data", (d) => (output += d));
  server.stderr.on("data", (d) => (output += d));
  try {
    for (let i = 0; i < 100; i++) {
      if (server.exitCode !== null) throw new Error(output);
      try {
        if ((await fetch("http://127.0.0.1:4322")).ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    browser = await chromium.launch({
      executablePath: process.env.TACITUS_TEST_BROWSER,
      headless: true,
      args: ["--no-sandbox"],
    });
    const expected = await readFile(
      "public/examples/peace.context.json",
      "utf8",
    );
    const sample = JSON.parse(expected),
      first = Object.values(sample.context.claims)[0];
    const snapshots = process.env.TACITUS_CAPTURE_SCREENSHOTS === "1" ? "docs/images" : "output/showcase";
    await mkdir(snapshots, { recursive: true });
    for (const width of [1440, 390]) {
      const page = await browser.newPage({
          viewport: { width, height: 1000 },
          reducedMotion: "reduce",
        }),
        errors = [],
        requests = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("request", (r) => requests.push(r.url()));
      await page.goto("http://127.0.0.1:4322");
      await page
        .getByRole("status")
        .filter({ hasText: "Recorded context loaded" })
        .waitFor();
      await page
        .getByRole("heading", { name: "Accessible results", exact: true })
        .waitFor();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page
        .locator("[class*=workspace]")
        .filter({ has: page.locator("canvas") })
        .first()
        .screenshot({
          path: `${snapshots}/context-${width === 1440 ? "desktop" : "mobile"}.png`,
        });
      const download = page.waitForEvent("download");
      await page.getByRole("button", { name: "Export unchanged JSON" }).click();
      assert.equal(
        await readFile(await (await download).path(), "utf8"),
        expected,
      );
      await page
        .getByRole("button", { name: "Context layers", exact: true })
        .click();
      await page.getByText(first.citations[0].text, { exact: true }).waitFor();
      await page.getByRole("button", { name: /Assertions/ }).click();
      await page
        .getByText(first.assertion.conditions[0], { exact: true })
        .waitFor();
      await page.getByRole("button", { name: /Time/ }).click();
      await page
        .getByText("Unknown / not supplied", { exact: true })
        .first()
        .waitFor({ state: "attached" });
      await page.getByRole("button", { name: /Omissions/ }).click();
      await page
        .getByText(Object.keys(sample.context.omissions)[0], { exact: true })
        .waitFor();
      if (width === 1440) {
        await page.locator('.cl-inspector').focus();
        await page.keyboard.press('PageDown');
        await page.waitForFunction(() => document.querySelector('.cl-inspector').scrollTop > 0);
      }
      await page
        .getByRole("navigation", { name: "Context layer", exact: true })
        .getByRole("button", { name: /Evidence/ })
        .click();
      await page.screenshot({
        path: `${snapshots}/layers-${width === 1440 ? "desktop" : "mobile"}.png`,
        fullPage: true,
      });
      await page.getByText("Open a context", { exact: true }).click();
      const imported = {
        ...sample,
        context: {
          ...sample.context,
          question: "My <script>safe</script> question",
        },
      };
      await page
        .getByLabel("Native Context JSON")
        .setInputFiles({
          name: "mine.json",
          mimeType: "application/json",
          buffer: Buffer.from(JSON.stringify(imported)),
        });
      await page
        .getByRole("status")
        .filter({ hasText: "Imported for local inspection" })
        .waitFor();
      await page.getByRole("button", { name: /Purpose/ }).click();
      await page
        .getByText("My <script>safe</script> question", { exact: true })
        .waitFor();
      await page
        .getByLabel("Native Context JSON")
        .setInputFiles({
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
          .getByRole("region", { name: "Seven context layers" })
          .count(),
        0,
      );
      assert.equal(
        await page
          .getByRole("button", { name: "Export unchanged JSON" })
          .isDisabled(),
        true,
      );
      assert.equal(
        requests.some((url) => url.includes("/api/")),
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
