import { test, expect, chromium } from "@playwright/test";
import path from "node:path";
import { createServer } from "node:http";
import { readFile, cp, mkdir, writeFile } from "node:fs/promises";
test("real extension collects, persists, favourites, exports, and excludes", async () => {
  test.setTimeout(300000);
  console.log("Preparing isolated extension");
  const root = path.resolve("artifacts/qa/test-extension");
  await mkdir("artifacts/qa", { recursive: true });
  await cp(".output/chrome-mv3", root, { recursive: true });
  const manifest = JSON.parse(await readFile(root + "/manifest.json", "utf8"));
  manifest.host_permissions = ["http://127.0.0.1/*"];
  await writeFile(root + "/manifest.json", JSON.stringify(manifest));
  const server = createServer(async (_req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.end(await readFile("tests/fixture.html"));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as any).port;
  console.log("Starting browser");
  const context = await chromium.launchPersistentContext("", {
    headless: true,
    channel: "chromium",
    ignoreDefaultArgs: ["--disable-extensions"],
    executablePath: process.env.LOOT_CHROMIUM_PATH,
    args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`],
  });
  try {
    console.log("Waiting for background");
    const worker =
      context.serviceWorkers()[0] ??
      (await context.waitForEvent("serviceworker"));
    const id = new URL(worker.url()).host;
    console.log("Opening fixture");
    const website = await context.newPage();
    await website.goto(`http://127.0.0.1:${port}`);
    console.log("Opening museum");
    const museum = await context.newPage();
    await museum.goto(`chrome-extension://${id}/museum.html`);
    await expect(
      museum.getByRole("heading", { name: "A little more curious." }),
    ).toBeVisible();
    await museum
      .getByRole("button", { name: "Collect manually", exact: true })
      .click();
    await website.bringToFront();
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${id}/popup.html`);
    await website.bringToFront();
    console.log("Collecting fixture");
    const response = await museum.evaluate(async () => {
      return Promise.race([
        (globalThis as any).chrome.runtime.sendMessage({ type: "COLLECT" }),
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({ ok: false, error: "Collection response timed out" }),
            60000,
          ),
        ),
      ]);
    });
    console.log("COLLECT RESULT", response);
    expect(response.ok, response.error).toBe(true);
    expect(response.value.added).toBeGreaterThan(3);
    const duplicate = await museum.evaluate(() =>
      (globalThis as any).chrome.runtime.sendMessage({ type: "COLLECT" }),
    );
    expect(duplicate.value.added).toBe(0);
    const paused = await museum.evaluate(async () => {
      const b = (globalThis as any).chrome;
      await b.runtime.sendMessage({
        type: "SETTINGS",
        patch: { paused: true },
      });
      const r = await b.runtime.sendMessage({ type: "COLLECT" });
      await b.runtime.sendMessage({
        type: "SETTINGS",
        patch: { paused: false },
      });
      return r;
    });
    expect(paused.ok).toBe(false);
    const excluded = await museum.evaluate(async () => {
      const b = (globalThis as any).chrome;
      await b.runtime.sendMessage({
        type: "SETTINGS",
        patch: { excluded: ["127.0.0.1"] },
      });
      const r = await b.runtime.sendMessage({ type: "COLLECT" });
      await b.runtime.sendMessage({
        type: "SETTINGS",
        patch: { excluded: [] },
      });
      return r;
    });
    expect(excluded.ok).toBe(false);
    const before = await museum.evaluate(() =>
      (globalThis as any).chrome.runtime.sendMessage({ type: "SNAPSHOT" }),
    );
    const shot = await museum.evaluate(() =>
      (globalThis as any).chrome.runtime.sendMessage({ type: "SCREENSHOT" }),
    );
    expect(shot.ok, shot.error).toBe(true);
    expect(shot.value.data).toMatch(/^data:image\/png/);
    const unchanged = await museum.evaluate(() =>
      (globalThis as any).chrome.runtime.sendMessage({ type: "SNAPSHOT" }),
    );
    expect(unchanged.value.specimens.length).toBe(
      before.value.specimens.length,
    );
    const saved = await museum.evaluate(
      (shot) =>
        (globalThis as any).chrome.runtime.sendMessage({
          type: "SAVE_POSTCARD",
          data: shot.data,
          sourceOrigin: shot.sourceOrigin,
          label: "Fixture postcard",
        }),
      shot.value,
    );
    expect(saved.ok, saved.error).toBe(true);
    await museum.bringToFront();
    await museum.reload();
    console.log("Inspecting finds");
    await expect(
      museum.getByRole("button", { name: "Favourite specimen" }).first(),
    ).toBeVisible();
    await museum
      .getByRole("button", { name: "Favourite specimen" })
      .first()
      .click();
    await museum.getByRole("button", { name: "Settings", exact: true }).click();
    const downloadPromise = museum.waitForEvent("download");
    await museum
      .getByRole("button", { name: "Export backup", exact: true })
      .click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("browser-loot-backup.zip");
    const backup = Array.from(await readFile((await download.path())!));
    const restored = await museum.evaluate(async (bytes) => {
      const b = (globalThis as any).chrome;
      await b.runtime.sendMessage({ type: "CLEAR" });
      return b.runtime.sendMessage({ type: "IMPORT", bytes });
    }, backup);
    expect(restored.ok, restored.error).toBe(true);
    await museum.reload();
    await museum.getByRole("button", { name: "Home", exact: true }).click();
    await museum.setViewportSize({ width: 1537, height: 1045 });
    await museum.screenshot({
      path: "artifacts/qa/museum.png",
      fullPage: true,
    });
    await popup.bringToFront();
    await popup.reload();
    await popup.setViewportSize({ width: 370, height: 590 });
    await popup.screenshot({ path: "artifacts/qa/popup.png", fullPage: true });
    await museum.bringToFront();
    await museum.setViewportSize({ width: 390, height: 844 });
    await museum.screenshot({
      path: "artifacts/qa/mobile.png",
      fullPage: true,
    });
    expect(
      await museum.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const serialized = await museum.evaluate(async () => {
      return JSON.stringify(
        await (globalThis as any).chrome.runtime.sendMessage({
          type: "SNAPSHOT",
        }),
      );
    });
    expect(serialized).not.toContain("PRIVATE_SENTINEL");
    expect(serialized).not.toContain("PRIVATE_EDITABLE_SENTINEL");
    await museum.setViewportSize({ width: 1440, height: 1000 });
    await museum.evaluate(async () => {
      const db: IDBDatabase = await new Promise((resolve, reject) => {
        const r = indexedDB.open("browser-loot", 1);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(["specimens", "assets", "meta"], "readwrite");
        tx.objectStore("specimens").clear();
        tx.objectStore("assets").clear();
        for (let i = 0; i < 5000; i++)
          tx.objectStore("specimens").put({
            id: crypto.randomUUID(),
            kind: "colour",
            sourceOrigin: "https://example.com",
            capturedAt: new Date().toISOString(),
            fingerprint: String(i),
            favourite: false,
            payload: { value: "hsl(" + (i % 360) + " 40% 60%)" },
          });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    });
    await museum.reload({ waitUntil: "domcontentloaded" });
    await expect(museum.getByText("5000", { exact: true })).toBeVisible();
    const interactive = await museum.evaluate(() => performance.now());
    console.log("5000 specimen interactive ms", interactive);
    expect(interactive).toBeLessThan(2000);
  } finally {
    await context.close();
    server.close();
  }
});
