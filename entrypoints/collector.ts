import { browser } from "wxt/browser";
import { scan, pickLoader } from "../lib/collector";
import type { Settings } from "../lib/model";
export default defineUnlistedScript(() => {
  const key = "__browserLootCollector";
  if ((globalThis as any)[key]) return;
  (globalThis as any)[key] = true;
  let busy = false;
  browser.runtime.onMessage.addListener(
    (message: any, _sender, sendResponse) => {
      const operation =
        message.type === "SCAN"
          ? scan(message.settings as Settings)
          : message.type === "PICK_LOADER"
            ? pickLoader()
            : null;
      if (!operation) return false;
      void operation.then(sendResponse, (error) =>
        sendResponse({ error: String(error) }),
      );
      return true;
    },
  );
  let count = 0,
    timer: ReturnType<typeof setTimeout>;
  const run = async () => {
    if (busy || document.hidden || count >= 3) return;
    busy = true;
    try {
      const response = await browser.runtime.sendMessage({
        type: "COLLECTOR_SETTINGS",
      });
      const settings = response?.ok ? response.value : null;
      if (settings) {
        count++;
        const result = await scan(settings);
        await browser.runtime.sendMessage({ type: "AUTO_CAPTURE", ...result });
      }
    } catch {
    } finally {
      busy = false;
    }
  };
  void run();
  const observer = new MutationObserver(() => {
    clearTimeout(timer);
    if (count < 3) timer = setTimeout(run, 1500);
    else observer.disconnect();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  window.addEventListener(
    "pagehide",
    () => {
      observer.disconnect();
      clearTimeout(timer);
    },
    { once: true },
  );
});
