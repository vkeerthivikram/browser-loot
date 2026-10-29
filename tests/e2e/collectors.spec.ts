import { test, expect, chromium, firefox } from "@playwright/test";
import { build } from "vite";
import path from "node:path";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
test.beforeAll(async () => {
  await build({
    configFile: false,
    build: {
      lib: {
        entry: path.resolve("lib/collector.ts"),
        name: "LootCollector",
        formats: ["iife"],
        fileName: () => "collector-fixture.js",
      },
      outDir: "artifacts/qa/fixture",
      emptyOutDir: true,
    },
  });
});
for (const [name, engine] of [
  ["Chromium", chromium],
  ["Firefox", firefox],
] as const)
  test(`${name} collector handles visible styles, private fields, shadows, and loader selection`, async () => {
    const server = createServer(async (_req, res) => {
      res.setHeader("Content-Type", "text/html");
      res.end(await readFile("tests/fixture.html"));
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const port = (server.address() as any).port;
    const browser = await engine.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(`http://127.0.0.1:${port}`);
      await page.addScriptTag({
        path: "artifacts/qa/fixture/collector-fixture.js",
      });
      const result = await page.evaluate(async () => {
        const { scan } = (window as any).LootCollector;
        return scan({
          enabled: [
            "favicon",
            "colour",
            "corner",
            "shadow",
            "button",
            "typography",
            "scrollbar",
            "cursor",
          ],
          word: "perhaps",
        });
      });
      expect(result.feed).toBe(true);
      for (const kind of [
        "favicon",
        "colour",
        "corner",
        "shadow",
        "button",
        "typography",
      ])
        expect(result.candidates.some((c: any) => c.kind === kind)).toBe(true);
      expect(JSON.stringify(result)).not.toContain("PRIVATE_");
      await page.evaluate(() => {
        (window as any).picked = (window as any).LootCollector.pickLoader();
        return true;
      });
      await page.locator(".spinner").click({ force: true });
      const picked = await page.evaluate(() => (window as any).picked);
      expect(picked.kind).toBe("loader");
      expect(picked.payload.frames.length).toBeGreaterThan(1);
      expect(
        await page.locator("body").getAttribute("data-clicked"),
      ).toBeNull();
    } finally {
      await browser.close();
      server.close();
    }
  });
