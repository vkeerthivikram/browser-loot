import { browser } from "wxt/browser";
import { asset, clear, insert, mutate, restore, snapshot } from "../lib/db";
import {
  allowedUrl,
  defaults,
  origin,
  settingsSchema,
  validateCandidate,
  type Candidate,
  type Settings,
} from "../lib/model";
import { parseBackup } from "../lib/backup";
const getSettings = async () =>
  ({
    ...defaults,
    ...(((await browser.storage.local.get("settings"))
      .settings as Partial<Settings>) ?? {}),
  }) as Settings;
async function permitted(tab: any, manual = false) {
  if (!tab || tab.incognito || !allowedUrl(tab.url ?? ""))
    throw Error("Collecting is unavailable on this page.");
  const s = await getSettings();
  if (s.paused || s.excluded.includes(new URL(tab.url).hostname))
    throw Error("Collecting is paused or this website is excluded.");
  if (
    !manual &&
    (!s.automatic ||
      !(await browser.permissions.contains({
        origins: [origin(tab.url) + "/*"],
      })))
  )
    throw Error("Automatic access is not enabled.");
  return s;
}
async function inject(tabId: number) {
  await browser.scripting.executeScript({
    target: { tabId },
    files: ["/collector.js"],
  });
}
async function image(url: string): Promise<Blob | undefined> {
  try {
    if (
      !allowedUrl(url) ||
      !(await browser.permissions.contains({
        origins: [new URL(url).origin + "/*"],
      }))
    )
      return;
    const response = await fetch(url, {
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: AbortSignal.timeout(5000),
    });
    if (
      !response.ok ||
      !/^image\/(png|jpeg|webp|gif|x-icon|vnd.microsoft.icon)/.test(
        response.headers.get("content-type") ?? "",
      )
    )
      return;
    const b = await response.blob();
    if (b.size > 5 * 1024 * 1024) return;
    const bitmap = await createImageBitmap(b);
    if (bitmap.width > 2048 || bitmap.height > 2048) return;
    const c = new OffscreenCanvas(bitmap.width, bitmap.height);
    c.getContext("2d")!.drawImage(bitmap, 0, 0);
    bitmap.close();
    return await c.convertToBlob({ type: "image/png" });
  } catch {
    return;
  }
}
async function capture(
  candidates: unknown[],
  tab: any,
  automatic: boolean,
  feed: boolean,
) {
  const s = await permitted(tab, !automatic),
    valid = candidates
      .slice(0, 20)
      .map(validateCandidate)
      .filter((c) => s.enabled.includes(c.kind));
  const assets = new Map<number, Blob>();
  for (const [i, c] of valid.entries()) {
    if (c.assetUrl) {
      const b = await image(c.assetUrl);
      if (b) {
        assets.set(i, b);
        if (c.kind === "cursor") c.payload.available = true;
      }
      delete c.assetUrl;
    }
  }
  return insert(valid, origin(tab.url), automatic, assets, feed && !!s.word);
}
let synchronising: Promise<void> = Promise.resolve();
function syncScripts() {
  const next = synchronising.then(syncScriptsNow, syncScriptsNow);
  synchronising = next.catch(() => {});
  return next;
}
async function syncScriptsNow() {
  const s = await getSettings();
  await browser.scripting.unregisterContentScripts().catch(() => {});
  if (s.automatic && !s.paused) {
    const { origins = [] } = await browser.permissions.getAll();
    const matches = origins.filter((v) => /^https?:/.test(v));
    if (matches.length)
      await browser.scripting.registerContentScripts([
        {
          id: "loot",
          matches,
          js: ["collector.js"],
          runAt: "document_idle",
          allFrames: false,
        },
      ]);
  }
}
export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    void syncScripts();
  });
  browser.runtime.onStartup.addListener(() => {
    void syncScripts();
  });
  browser.permissions.onAdded.addListener(() => {
    void syncScripts();
  });
  browser.permissions.onRemoved.addListener(() => {
    void syncScripts();
  });
  browser.runtime.onMessage.addListener((m: any, sender: any) => {
    const page =
      sender.id === browser.runtime.id &&
      typeof sender.url === "string" &&
      sender.url.startsWith(browser.runtime.getURL("/"));
    return (async () => {
      if (m.type === "COLLECTOR_SETTINGS") {
        try {
          return await permitted(sender.tab);
        } catch {
          return null;
        }
      }
      if (m.type === "AUTO_CAPTURE") {
        if (!sender.tab || sender.frameId !== 0) throw Error("Invalid sender");
        return capture(m.candidates, sender.tab, true, m.feed === true);
      }
      if (!page) throw Error("Untrusted request");
      if (m.type === "SNAPSHOT") return snapshot(await getSettings());
      if (m.type === "SETTINGS") {
        const settings = settingsSchema.parse({
          ...(await getSettings()),
          ...m.patch,
        });
        await browser.storage.local.set({ settings });
        await syncScripts();
        return true;
      }
      if (m.type === "MUTATE") {
        if (
          !["favourite", "delete"].includes(m.action) ||
          typeof m.id !== "string"
        )
          throw Error("Invalid specimen action");
        await mutate(m.id, m.action);
        return true;
      }
      if (m.type === "CLEAR") {
        await clear();
        return true;
      }
      if (m.type === "IMPORT") {
        const parsed = parseBackup(new Uint8Array(m.bytes));
        for (const blob of parsed.assets.values()) {
          const bitmap = await createImageBitmap(blob);
          if (bitmap.width > 8192 || bitmap.height > 8192) {
            bitmap.close();
            throw Error("Backup image dimensions are too large");
          }
          bitmap.close();
        }
        await restore(parsed.specimens, parsed.assets, parsed.familiar);
        const current = await getSettings();
        await browser.storage.local.set({
          settings: {
            ...parsed.settings,
            onboarded: current.onboarded,
            automatic: current.automatic,
            paused: current.paused,
          },
        });
        await syncScripts();
        return true;
      }
      if (m.type === "COLLECT" || m.type === "LOADER") {
        const [tab] = await browser.tabs.query({
          active: true,
          currentWindow: true,
        });
        const settings = await permitted(tab, true);
        await inject(tab.id!);
        if (m.type === "LOADER") {
          const candidate = await browser.tabs.sendMessage(tab.id!, {
            type: "PICK_LOADER",
          });
          if (!candidate) return { unsupported: true, tabId: tab.id };
          return { added: await capture([candidate], tab, false, false) };
        }
        const result = await browser.tabs.sendMessage(tab.id!, {
          type: "SCAN",
          settings,
        });
        return {
          added: await capture(result.candidates, tab, false, result.feed),
        };
      }
      if (m.type === "SCREENSHOT") {
        const [tab] = await browser.tabs.query({
          active: true,
          currentWindow: true,
        });
        await permitted(tab, true);
        if (m.tabId !== undefined && m.tabId !== tab.id)
          throw Error("Selected tab changed. Start capture again.");
        const expected = tab.url;
        const data = await browser.tabs.captureVisibleTab(tab.windowId, {
          format: "png",
        });
        const current = await browser.tabs.get(tab.id!);
        if (current.url !== expected || !current.active)
          throw Error("Page changed during capture.");
        return {
          data,
          sourceOrigin: origin(expected!),
          pageUrl: expected,
          tabId: tab.id,
        };
      }
      if (m.type === "SAVE_POSTCARD") {
        const source = origin(m.sourceOrigin);
        if (
          typeof m.data !== "string" ||
          m.data.length > 8 * 1024 * 1024 ||
          !m.data.startsWith("data:image/png;base64,")
        )
          throw Error("Invalid capture");
        const b = new Blob(
          [Uint8Array.from(atob(m.data.split(",")[1]), (c) => c.charCodeAt(0))],
          { type: "image/png" },
        );
        if (b.size > 5 * 1024 * 1024) throw Error("Image is too large");
        const c = validateCandidate({
          kind: "postcard",
          payload: {
            label: m.label || "404 postcard",
            ...(m.pageUrl ? { pageUrl: m.pageUrl } : {}),
          },
        });
        return insert([c], source, false, new Map([[0, b]]));
      }
      throw Error("Unknown action");
    })().then(
      (value) => ({ ok: true, value }),
      (e) => ({
        ok: false,
        error: e instanceof Error ? e.message : "Operation failed",
      }),
    );
  });
});
