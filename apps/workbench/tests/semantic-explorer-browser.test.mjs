import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

test("semantic exploration lazily inspects real sources, prepares bounded context and refuses tampered assets", async () => {
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
      "4336",
      "--strictPort",
    ],
    { stdio: "pipe" },
  );
  let browser,
    output = "";
  server.stdout.on("data", (d) => {
    output += d;
  });
  server.stderr.on("data", (d) => {
    output += d;
  });
  const snapshots =
    process.env.TACITUS_CAPTURE_SCREENSHOTS === "1"
      ? "docs/images"
      : "output/semantic";
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (server.exitCode !== null) throw Error(output);
      try {
        if ((await fetch("http://127.0.0.1:4336")).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.equal(ready, true, output);
    browser = await chromium.launch({
      executablePath: process.env.TACITUS_TEST_BROWSER,
      headless: true,
      args: ["--no-sandbox"],
    });
    await mkdir(snapshots, { recursive: true });
    const graph = JSON.parse(
      await readFile("public/semantic/graph.json", "utf8"),
    );
    for (const width of [1440, 390]) {
      const page = await browser.newPage({
          viewport: { width, height: 1000 },
          reducedMotion: "reduce",
        }),
        requests = [],
        errors = [];
      page.on("request", (r) => requests.push(r.url()));
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto("http://127.0.0.1:4336");
      await page
        .getByRole("status")
        .filter({ hasText: "Recorded context loaded" })
        .waitFor();
      const nativeIntro = await page.locator(".showcase-intro").boundingBox();
      assert.equal(
        requests.some((u) => u.includes("/semantic/")),
        false,
        "large data must not load in native mode",
      );
      await page
        .getByRole("button", { name: "Semantic exploration", exact: true })
        .click();
      await page
        .getByRole("status")
        .filter({ hasText: "Verified catalogue: 2,048" })
        .waitFor();
      const inspector = page.getByRole("region", {
        name: "Semantic original record inspector",
        exact: true,
      });
      await inspector
        .getByText(
          "Original provider row verified · all retained fields below.",
          { exact: true },
        )
        .waitFor();
      assert.equal(await inspector.locator(".se-attributes > div").count(), 49);
      await page
        .getByRole("heading", {
          name: "Semantic context explorer",
          level: 1,
          exact: true,
        })
        .waitFor();
      if (width === 1440) {
        const plotTop = await page
          .locator(".se-plot")
          .evaluate(
            (element) => element.getBoundingClientRect().top + window.scrollY,
          );
        assert.ok(
          plotTop < 900,
          `Semantic plot must start in the first 900px; got ${plotTop}px`,
        );
      }
      assert.equal(
        await page.locator('.se-plot [aria-label^="Plot record"]').count(),
        72,
      );
      assert.equal(await page.locator(".se-record-list > button").count(), 24);
      assert.ok(
        requests.filter((u) => u.includes("/semantic/rows/")).length <= 2,
        "raw records are lazy, not all188partitions",
      );
      await page.getByLabel("Country code").selectOption("SY");
      await page.getByLabel("From year", { exact: true }).fill("2011");
      await page.getByLabel("Through year", { exact: true }).fill("2024");
      await page.getByLabel("where_prec = 1 only", { exact: true }).check();
      const expected = graph.nodes.filter(
        (n) =>
          n.kind === "conflict_event" &&
          n.country_code === "SY" &&
          n.precision.where_prec === "1" &&
          n.date_end >= "2011-01-01" &&
          n.date_start <= "2024-12-31",
      );
      await page
        .getByRole("heading", {
          name: `Record directory · ${expected.length} matches`,
          exact: true,
        })
        .waitFor();
      const first = page.locator(".se-record-list > button").first();
      await first.focus();
      await page.keyboard.press("Enter");
      await inspector
        .getByRole("heading", { name: expected[0].label, exact: true })
        .waitFor();
      await inspector
        .getByText(
          "Original provider row verified · all retained fields below.",
          { exact: true },
        )
        .waitFor();
      assert.equal(
        await inspector
          .locator(
            ".se-attributes a, .se-attributes img, .se-attributes script",
          )
          .count(),
        0,
      );
      await inspector
        .getByRole("button", {
          name: "Add verified record to preparation",
          exact: true,
        })
        .click();
      if (width === 1440) {
        await inspector.focus();
        await page.keyboard.press("PageDown");
        await page.waitForFunction(
          () => document.querySelector(".se-inspector").scrollTop > 0,
        );
      }
      for (const name of [
        "Provenance PROV-O",
        "Classification SKOS",
        "Time OWL-Time",
        "Place GeoSPARQL",
      ]) {
        await page
          .getByRole("navigation", { name: "Semantic lens" })
          .getByRole("button", { name, exact: true })
          .click();
        assert.ok(
          (await page
            .locator('.se-plot [aria-label^="Plot record"]')
            .count()) <= 72,
        );
      }
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.screenshot({
        path: `${snapshots}/semantic-${width === 1440 ? "desktop" : "mobile"}.png`,
        fullPage: true,
      });
      await page
        .getByRole("navigation", { name: "Semantic lens" })
        .getByRole("button", { name: "Observation SOSA / SSN", exact: true })
        .click();
      await page
        .getByRole("region", { name: "Original annual observation example" })
        .waitFor();
      await page
        .getByRole("button", {
          name: "Annual observation Population, total · 2024; wdi:2:SYR:SP.POP.TOTL:2024",
          exact: true,
        })
        .click();
      await inspector
        .getByRole("heading", { name: "Population, total · 2024", exact: true })
        .waitFor();
      assert.equal(await inspector.locator(".se-attributes > div").count(), 19);
      const valuePair = inspector
        .locator(".se-attributes > div")
        .filter({ has: page.getByText("value", { exact: true }) });
      assert.equal(await valuePair.locator("dd").textContent(), "24672760");
      await inspector
        .getByRole("button", {
          name: "Add verified record to preparation",
          exact: true,
        })
        .click();
      await page
        .getByLabel("Policy question", { exact: true })
        .fill("What is known, and what is missing?");
      await page
        .getByLabel("Working assessment", { exact: true })
        .fill("Two supplied observations for inspection.");
      await page
        .getByLabel("Alternative readings", { exact: true })
        .fill("Annual estimates and event records have different units.");
      await page
        .getByLabel("Missing evidence / gaps", { exact: true })
        .fill("Original news documents are omitted.");
      await page.screenshot({
        path: `${snapshots}/semantic-observation-${width === 1440 ? "desktop" : "mobile"}.png`,
        fullPage: true,
      });
      const download = page.waitForEvent("download");
      await page
        .getByRole("button", {
          name: "Download preparation JSON",
          exact: false,
        })
        .click();
      const bytes = await readFile(await (await download).path()),
        pack = JSON.parse(bytes);
      assert.equal(pack.format, "policy-research-selection/1");
      assert.equal(pack.records.length, 2);
      assert.equal(pack.datasets.length, 2);
      assert.equal(Object.keys(pack.records[0].attributes).length, 49);
      assert.equal(pack.records[1].attributes.value, 24672760);
      assert.equal(pack.notes.gaps, "Original news documents are omitted.");
      assert.match(
        pack.limitations.join(" "),
        /not a native Context, native capsule or live PRAXIS attachment/,
      );
      await page
        .getByRole("button", { name: "Research selection", exact: true })
        .click();
      await page.getByLabel("Research selection JSON").setInputFiles({
        name: "prepared.json",
        mimeType: "application/json",
        buffer: bytes,
      });
      await page
        .getByRole("status")
        .filter({ hasText: "Research selection imported" })
        .waitFor();
      assert.equal(await page.locator(".rs-record-list tbody tr").count(), 2);
      const unchanged = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Export unchanged selection JSON" })
        .click();
      assert.deepEqual(await readFile(await (await unchanged).path()), bytes);
      await page
        .getByRole("button", { name: "Native Context", exact: true })
        .click();
      await page
        .getByRole("heading", { name: "Accessible results", exact: true })
        .waitFor();
      const returnedNativeIntro = await page
        .locator(".showcase-intro")
        .boundingBox();
      assert.equal(
        returnedNativeIntro.height,
        nativeIntro.height,
        "semantic spacing must not leak into native layout",
      );
      assert.equal(
        requests.some((u) => u.includes("/api/")),
        false,
      );
      assert.deepEqual(errors, []);
      await page.close();
    }
    const bad = await browser.newPage();
    await bad.route("**/semantic/graph.json", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: '{"format":"invented"}',
      }),
    );
    await bad.goto("http://127.0.0.1:4336/?mode=semantic");
    await bad
      .getByRole("alert")
      .filter({ hasText: "Catalogue refused:" })
      .waitFor();
    assert.equal(await bad.locator(".se-plot").count(), 0);
    await bad
      .getByText("No example or generated graph was substituted.", {
        exact: true,
      })
      .waitFor();
    await bad.close();
  } finally {
    await browser?.close();
    server.kill();
    await new Promise((resolve) =>
      server.exitCode !== null ? resolve() : server.once("exit", resolve),
    );
  }
});
