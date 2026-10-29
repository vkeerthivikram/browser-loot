import { browser } from "wxt/browser";
export async function request<T = any>(
  message: Record<string, unknown>,
): Promise<T> {
  const r = await browser.runtime.sendMessage(message);
  if (!r?.ok) throw Error(r?.error ?? "Extension background unavailable");
  return r.value;
}
export async function enableAutomatic() {
  const granted = await browser.permissions.request({
    origins: ["http://*/*", "https://*/*"],
  });
  await request({
    type: "SETTINGS",
    patch: { automatic: granted, onboarded: true },
  });
  return granted;
}
export function openMuseum() {
  return browser.tabs.create({ url: browser.runtime.getURL("/museum.html") });
}
