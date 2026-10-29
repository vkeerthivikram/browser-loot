import { defineConfig } from "wxt";
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: ({ browser }) => ({
    name: "Browser Loot",
    description: "A local curiosity cabinet for the small wonders of the web.",
    version: "1.0.0",
    permissions: ["activeTab", "scripting", "storage"],
    optional_host_permissions: ["http://*/*", "https://*/*"],
    incognito: "not_allowed",
    options_ui: { page: "museum.html", open_in_tab: true },
    icons: { 16: "icon/16.png", 48: "icon/48.png", 128: "icon/128.png" },
    content_security_policy: {
      extension_pages:
        "script-src 'self'; object-src 'none'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; connect-src http: https:;",
    },
    ...(browser === "firefox"
      ? {
          browser_specific_settings: {
            gecko: {
              id: "browser-loot@extensions.local",
              strict_min_version: "140.0",
              data_collection_permissions: { required: ["none"] },
            },
          },
        }
      : {}),
  }),
});
