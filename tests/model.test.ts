import { describe, it, expect } from "vitest";
import {
  allowedUrl,
  hasWord,
  validateCandidate,
  validateSpecimen,
  fingerprint,
} from "../lib/model";
import { parseBackup } from "../lib/backup";
import { zipSync, strToU8 } from "fflate";
describe("collection trust boundary", () => {
  it("allows websites and excludes privileged pages and stores", () => {
    expect(allowedUrl("https://example.com/private")).toBe(true);
    for (const url of [
      "file:///a",
      "chrome://settings",
      "about:blank",
      "https://chromewebstore.google.com/detail/a",
      "https://addons.mozilla.org/a",
    ])
      expect(allowedUrl(url)).toBe(false);
  });
  it("rejects remote styles and unknown fields", () => {
    for (const value of [
      "url(https://tracker.test)",
      "expression(alert(1))",
      "<script>",
      "var(--remote)",
    ])
      expect(() =>
        validateCandidate({ kind: "colour", payload: { value } }),
      ).toThrow();
    expect(() =>
      validateCandidate({
        kind: "button",
        payload: { styles: { position: "fixed", background: "red" } },
      }),
    ).toThrow();
    expect(() =>
      validateCandidate({
        kind: "favicon",
        payload: { monogram: "A", html: "secret" },
      }),
    ).toThrow();
  });
  it("preserves percentage corner dimensions", () => {
    expect(
      validateCandidate({
        kind: "corner",
        payload: {
          radii: ["50%", "20%", "0px", "3px"],
          width: 200,
          height: 80,
        },
      }).payload,
    ).toMatchObject({ width: 200, height: 80 });
  });
  it("uses whole Unicode words, not substrings", () => {
    expect(hasWord("Perhaps, perhaps!", "perhaps")).toBe(true);
    expect(hasWord("perhapsing", "perhaps")).toBe(false);
    expect(hasWord("café and tea", "café")).toBe(true);
    expect(hasWord("anything", "")).toBe(false);
  });
  it("normalises property order for deduplication", () => {
    const a = validateCandidate({
      kind: "button",
      payload: { styles: { color: "red", borderRadius: "4px" } },
    });
    const b = validateCandidate({
      kind: "button",
      payload: { styles: { borderRadius: "4px", color: "red" } },
    });
    expect(fingerprint(a)).toBe(fingerprint(b));
  });
  it("does not permit arbitrary origins in restored specimens", () => {
    expect(() =>
      validateSpecimen({
        id: crypto.randomUUID(),
        kind: "colour",
        payload: { value: "red" },
        sourceOrigin: "javascript:alert(1)",
        capturedAt: new Date().toISOString(),
        fingerprint: "x",
        favourite: false,
      }),
    ).toThrow();
  });
  it("rejects future backups before mutations", () => {
    const file = zipSync({
      "manifest.json": strToU8(JSON.stringify({ version: 2 })),
    });
    expect(() => parseBackup(file)).toThrow();
  });
});
