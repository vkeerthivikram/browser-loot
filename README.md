# Browser Loot

A curiosity cabinet that grows while you browse. Collect colours, gradients, shadows, corners, favicons, buttons, typography, custom cursors, and scrollbars. Keep a loader, save a postcard, stitch a quilt, and feed a curious moth with a word of your choosing.

Your specimens stay in your browser. No account, analytics, or server.

## Install locally

Use Node.js 22.22 or newer and npm:

```sh
npm ci
npm run build
npm run build:firefox
```

**Chrome / Brave:** open `chrome://extensions` or `brave://extensions`, turn on Developer mode, choose **Load unpacked**, and select `.output/chrome-mv3`. Pin Browser Loot to your toolbar.

**Firefox 140+:** open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and select `.output/firefox-mv3/manifest.json`. Temporary installations are removed when Firefox restarts. Permanent public installation requires Mozilla signing.

Open a website, click the toolbar icon, then **Collect now**. Open the museum from the popup. Enable automatic collecting during onboarding or in Settings if you want finds to arrive while browsing. Your normal new-tab page is preserved.

## Explore

- **Garden:** one favicon flower per website; unavailable icons become monograms.
- **Cabinet:** visual design specimens with source websites, dates, and copyable values.
- **Oddities:** supported CSS loader animations and manually approved 404 postcards.
- **Quilt:** arrange your finds and export a PNG. Sharing exports omit website labels.
- **Familiar:** choose a whole word in Settings. Sightings feed your moth once per website per day; only totals and feeding dates are saved.

Search, filter, favourite, disable collections, exclude websites, and pause collecting whenever you like. Settings includes ZIP backup export/import and collection deletion. Backups can move collections between browsers; permissions are never transferred.

## Capture boundaries

Automatic scans run in bounded batches on permitted top-level HTTP/HTTPS pages, including accessible open shadow roots. Private windows, browser/store pages, hidden content, and editable fields are excluded. Automatic finds save visual properties, not page text or original HTML. Source links retain only the origin by default.

Custom asset requests happen only during collection, only on granted origins, without cookies or a referrer. Museum previews use local assets. Missing icons/cursors are labelled. Typography shows the declared font stack with locally available fallback fonts; font files are not downloaded.

Loader selection currently supports a single element's CSS animation using opacity, transform, background colour, and border radius. Composite loaders, canvas/WebGL, JavaScript-driven animations, and unsupported keyframes can be saved as still postcards instead. Selection expires after 30 seconds; Escape cancels. A still is always a separate, confirmed action.

Postcards capture the visible viewport with a centre-crop slider and optional reviewed source link. The 404 label is supplied by you; Browser Loot does not inspect HTTP status. Cancel discards the pending image. Closing the popup also discards an unconfirmed screenshot.

The application budget is 250 MB. Captures stop at the limit; saved items are never silently evicted. Browser quota/eviction can still affect local storage, so keep backups of valued finds. Removing the extension removes its browser storage.

## Development and checks

```sh
npm run dev
npm run typecheck
npm test
npm run test:e2e
npm run check
npm run zip
```

Install test browsers once with `npx playwright install chromium firefox`. Chromium integration uses an isolated copy of the production extension with localhost fixture access pre-granted; release manifests retain optional host access. Firefox collector tests execute the same extraction bundle in the Firefox engine. The Firefox package can additionally be checked with `npx web-ext lint --source-dir .output/firefox-mv3` and loaded with `web-ext run`.

`npm run zip` creates per-browser release ZIPs under `.output`. Before public submission, complete the store checklist in `docs/RELEASE.md`. Uploading, signing, and publishing are separate release actions.

## Implementation

WXT + React + TypeScript, CSS Modules, IndexedDB (`idb`), Zod validation, and ZIP backups (`fflate`). Chrome uses an MV3 service worker; Firefox uses an MV3 event page. Background logic owns collection writes and deduplicates inside transactions. See `docs/PRIVACY.md` for storage and permission details.
