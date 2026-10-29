import { z } from "zod";
z.config({ jitless: true });
export const kinds = [
  "favicon",
  "colour",
  "shadow",
  "corner",
  "button",
  "typography",
  "cursor",
  "scrollbar",
  "loader",
  "postcard",
] as const;
export type Kind = (typeof kinds)[number];
export const titles: Record<Kind, string> = {
  favicon: "Favicon Garden",
  colour: "Colour Goblin",
  shadow: "Shadow Thief",
  corner: "Corner Collector",
  button: "Button Collection",
  typography: "Typography",
  cursor: "Cursor Cabinet",
  scrollbar: "Scrollbar Museum",
  loader: "Loader Zoo",
  postcard: "404 Postcards",
};
export const BUDGET = 250 * 1024 * 1024;
const safe = z
  .string()
  .max(2000)
  .refine(
    (v) =>
      !/[<>\\]|url\s*\(|expression\s*\(|@import|javascript:|var\s*\(/i.test(v),
    "Unsafe style",
  );
export const styleKeys = [
  "color",
  "backgroundColor",
  "backgroundImage",
  "boxShadow",
  "borderRadius",
  "borderTopLeftRadius",
  "borderTopRightRadius",
  "borderBottomLeftRadius",
  "borderBottomRightRadius",
  "borderColor",
  "borderWidth",
  "borderStyle",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "letterSpacing",
  "lineHeight",
  "width",
  "height",
  "opacity",
  "transform",
  "transformOrigin",
  "padding",
  "display",
  "position",
  "top",
  "left",
  "margin",
  "animationTimingFunction",
] as const;
export type SafeStyle = Partial<Record<(typeof styleKeys)[number], string>>;
const styleSchema = z
  .record(z.string(), safe)
  .refine(
    (v) =>
      Object.keys(v).every((k) => (styleKeys as readonly string[]).includes(k)),
    "Unknown style",
  );
const frameSchema = z
  .object({
    offset: z.number().min(0).max(1).optional(),
    opacity: safe.optional(),
    transform: safe.optional(),
    backgroundColor: safe.optional(),
    borderRadius: safe.optional(),
  })
  .strict();
export const payloadSchemas = {
  favicon: z.object({ monogram: z.string().max(4) }).strict(),
  colour: z.object({ value: safe }).strict(),
  shadow: z.object({ value: safe }).strict(),
  corner: z
    .object({
      radii: z.array(safe).length(4),
      width: z.number().min(0).max(10000),
      height: z.number().min(0).max(10000),
    })
    .strict(),
  button: z.object({ styles: styleSchema }).strict(),
  typography: z
    .object({ styles: styleSchema, fallback: z.literal(true) })
    .strict(),
  cursor: z
    .object({
      x: z.number().min(0).max(512),
      y: z.number().min(0).max(512),
      available: z.boolean(),
    })
    .strict(),
  scrollbar: z
    .object({
      color: safe,
      width: safe,
      engine: z.enum(["standard", "webkit", "default"]),
    })
    .strict(),
  loader: z
    .object({
      styles: styleSchema,
      frames: z.array(frameSchema).min(2).max(100),
      duration: z.number().min(50).max(60000),
      easing: z.enum(["linear", "ease", "ease-in", "ease-out", "ease-in-out"]),
    })
    .strict(),
  postcard: z
    .object({
      label: z.string().max(120),
      pageUrl: z.string().url().max(2000).optional(),
    })
    .strict(),
};
export type Payloads = { [K in Kind]: z.infer<(typeof payloadSchemas)[K]> };
export type Candidate = {
  [K in Kind]: { kind: K; payload: Payloads[K]; assetUrl?: string };
}[Kind];
export type Specimen = {
  [K in Kind]: {
    id: string;
    kind: K;
    sourceOrigin: string;
    capturedAt: string;
    fingerprint: string;
    favourite: boolean;
    assetId?: string;
    payload: Payloads[K];
  };
}[Kind];
export interface Settings {
  onboarded: boolean;
  automatic: boolean;
  paused: boolean;
  excluded: string[];
  enabled: Kind[];
  word: string;
  quilt: string[];
}
export interface Familiar {
  feeds: number;
  days: Record<string, string>;
}
export interface Snapshot {
  specimens: Specimen[];
  settings: Settings;
  familiar: Familiar;
  bytes: number;
}
export const defaults: Settings = {
  onboarded: false,
  automatic: false,
  paused: false,
  excluded: [],
  enabled: [...kinds],
  word: "",
  quilt: [],
};
export const settingsSchema = z
  .object({
    onboarded: z.boolean(),
    automatic: z.boolean(),
    paused: z.boolean(),
    excluded: z.array(z.string().max(255)).max(10000),
    enabled: z.array(z.enum(kinds)),
    word: z.string().max(40),
    quilt: z.array(z.string().max(100)).max(50000),
  })
  .strict();
export function allowedUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return (
      ["http:", "https:"].includes(u.protocol) &&
      !["chromewebstore.google.com", "addons.mozilla.org"].includes(
        u.hostname,
      ) &&
      !(
        u.hostname === "chrome.google.com" && u.pathname.startsWith("/webstore")
      )
    );
  } catch {
    return false;
  }
}
export function origin(value: string) {
  if (!allowedUrl(value)) throw Error("This page cannot be collected.");
  return new URL(value).origin;
}
export function validateCandidate(value: unknown): Candidate {
  const v = z
    .object({
      kind: z.enum(kinds),
      payload: z.unknown(),
      assetUrl: z.string().max(4000).optional(),
    })
    .strict()
    .parse(value);
  return {
    ...v,
    payload: payloadSchemas[v.kind].parse(v.payload),
  } as Candidate;
}
export function validateSpecimen(value: unknown): Specimen {
  const v = z
    .object({
      id: z.string().uuid(),
      kind: z.enum(kinds),
      sourceOrigin: z
        .string()
        .url()
        .refine((v) => allowedUrl(v) && new URL(v).origin === v),
      capturedAt: z.string().datetime(),
      fingerprint: z.string().max(10000),
      favourite: z.boolean(),
      assetId: z.string().uuid().optional(),
      payload: z.unknown(),
    })
    .strict()
    .parse(value);
  return { ...v, payload: payloadSchemas[v.kind].parse(v.payload) } as Specimen;
}
function stable(v: unknown): string {
  if (Array.isArray(v)) return "[" + v.map(stable).join(",") + "]";
  if (v && typeof v === "object")
    return (
      "{" +
      Object.entries(v)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, x]) => JSON.stringify(k) + ":" + stable(x))
        .join(",") +
      "}"
    );
  return JSON.stringify(v);
}
export function fingerprint(c: Candidate) {
  return stable({ kind: c.kind, payload: c.payload });
}
export function hasWord(text: string, word: string) {
  const sought = word.trim().toLocaleLowerCase();
  if (!sought) return false;
  return [
    ...new Intl.Segmenter(undefined, { granularity: "word" }).segment(text),
  ].some((s) => s.isWordLike && s.segment.toLocaleLowerCase() === sought);
}
