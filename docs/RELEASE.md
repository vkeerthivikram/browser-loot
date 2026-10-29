# Release checklist

1. Run `npm ci`, `npm run check`, and `npm run test:e2e`.
2. Run `npx web-ext lint --source-dir .output/firefox-mv3`. Inspect any browser-specific validation warnings.
3. Load the release packages in Chrome and Firefox 140+. Check optional access approval/denial, automatic discovery on a newly opened website, revocation, exclusions, pause, restart persistence, loader selection, screenshot approval/cancel, and backup round trip.
4. Verify reduced-motion mode and keyboard access. Inspect museum, popup, details, and Settings at desktop and narrow widths.
5. Run `npm run zip`. Archive the lockfile, source, and this validation record alongside release packages. Firefox reviewers need reproducible source and the exact build commands from README.
6. Use the icons in `public/icon`. Capture genuine museum/popup screenshots; never present examples as real user collections. Store screenshots should be exported at each store's required dimensions.
7. Publish privacy copy from `docs/PRIVACY.md` at a public URL owned by the publisher and provide that URL in both store listings. Confirm publisher account, support contact, and listing assets before submission.
8. Submit Chrome ZIP to Chrome Web Store and Firefox ZIP/source to Mozilla Add-ons. Mozilla signing and store approval are external steps; a successful local build does not establish either.

## Listing copy

**Name:** Browser Loot

**Short description:** A private curiosity cabinet for the small wonders of the web.

**Description:** Turn everyday browsing into a collection of colourful little discoveries. Grow a favicon garden, keep beautiful colours and gradients, compare shadows and corners, and collect button styles, type specimens, cursors, and scrollbars. Arrange your finds into a quilt, save approved postcards, and feed a curious moth familiar with sightings of your favourite word. Your collection lives in your browser. Automatic collecting is optional, website exclusions and pause controls are always available, and ZIP backups let you move your treasures between Chrome and Firefox.

Loader capture supports selected CSS animations. Fonts use local fallback previews. Custom assets may be unavailable without source access. Postcards are manually labelled; HTTP status is not verified.
