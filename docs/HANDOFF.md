# Linux handoff — paused checkpoint

User requested saving this work publicly and pausing until continuing on a Linux laptop. Resume from this checkpoint; this is a working development build, not a published store release.

## Start on Linux

```sh
git clone https://github.com/vkeerthivikram/browser-loot.git
cd browser-loot
npm ci
npx playwright install --with-deps chromium firefox
npm run check
npm run test:e2e
```

Node 22.22+ is recommended. Load `.output/chrome-mv3` as an unpacked extension or `.output/firefox-mv3/manifest.json` through Firefox's temporary add-on loader. Chrome and Firefox builds explicitly use Manifest V3.

## Implemented

Museum and toolbar popup, onboarding, optional automatic collection, manual collection, all ten specimen types, word familiar, per-website quilt patches, favourite/search/filter/delete controls, source links, per-site exclusions, pause, collection toggles, a 250 MB application budget, PNG exports, ZIP backups, and screenshot preview/centre crop/confirmation. Generated moth artwork and icons are committed. Specimen rendering uses validated values and local assets.

## Evidence so far

- TypeScript checks and both browser production builds passed.
- Twelve unit tests passed, including concurrent capture deduplication, one feeding per site/day, storage rollback, asset deletion, unsafe-style rejection, and future-backup rejection.
- Chromium collector fixtures passed, including visible styles, editable-field exclusion, open shadow roots, and CSS loader selection.
- An earlier full integration journey passed in installed Brave: capture six fixture specimens, reload persistence, favourite, export a backup, and desktop/narrow screenshots without horizontal overflow.
- The expanded final journey (pause/exclusions, confirmed screenshots, restore, 5,000-specimen performance) was interrupted at the user's pause request. Do not claim these checks passed. The source includes the expanded tests for Linux.
- Firefox production build succeeded and `web-ext lint` reported zero errors. Runtime testing was blocked before startup by Windows SideBySide assembly failures in both downloaded Firefox versions. Recheck Firefox on Linux.

## Next work

1. Run the expanded integration suite on Linux and fix remaining failures. The capture response was intermittent on Windows; the content-script listener now uses explicit `sendResponse` with `return true`. Verify repeated collecting and permission changes.
2. Verify actual Firefox extension loading with `web-ext run`, as well as the Firefox collector fixture. Review consent metadata and lint warnings. Zod JIT is disabled (`jitless`) for the extension CSP; bundled libraries may still trigger static eval/innerHTML warnings.
3. Complete large-backup transfer. Import currently serialises bytes into a runtime message; large archives can exceed Chrome's message size. Move the user-selected file through a temporary local transfer store or chunked port, validate before collection mutations, and clean up cancelled transfers. An unintegrated draft helper was removed before committing.
4. Verify PNG/quilt export fidelity, large collections, loader cancellation/fallback, keyboard focus, permission revocation, automatic scans on dynamic pages, and browser restart persistence. Loader support is deliberately limited to a single element's supported CSS animation; fonts use local fallbacks.
5. Compare the current UI with `design/concept.png`. The implementation follows its palette, serif hierarchy, sidebar/room structure, specimen exhibits, and moth, with simplified shelf decoration and explicit controls required by the plan. It has not been signed off as pixel-identical.
6. Run `npm run zip` after checks pass. Complete `docs/RELEASE.md`, including publisher contact, hosted privacy page, store screenshots, signing, and submission. No extension store publication has occurred.

Build output, browser profiles, test artifacts, node_modules, and temporary debugging scripts are intentionally excluded from Git. No user browsing collection is part of this repository.
