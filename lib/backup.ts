import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import { z } from "zod";
import {
  BUDGET,
  settingsSchema,
  validateSpecimen,
  type Snapshot,
  type Familiar,
} from "./model";
import { asset } from "./db";
export async function exportBackup(s: Snapshot) {
  const files: Record<string, Uint8Array> = {};
  for (const item of s.specimens)
    if (item.assetId) {
      const b = await asset(item.assetId);
      if (b)
        files["assets/" + item.assetId] = new Uint8Array(await b.arrayBuffer());
    }
  files["manifest.json"] = strToU8(
    JSON.stringify({
      version: 1,
      specimens: s.specimens,
      settings: s.settings,
      familiar: s.familiar,
    }),
  );
  return new Blob([zipSync(files) as Uint8Array<ArrayBuffer>], {
    type: "application/zip",
  });
}
export function parseBackup(input: Uint8Array) {
  if (input.byteLength > BUDGET) throw Error("Backup is too large.");
  let expanded = 0;
  const files = unzipSync(input, {
    filter: (f) => {
      expanded += f.originalSize;
      if (expanded > BUDGET || Object.keys(f).length > 100)
        throw Error("Expanded backup exceeds budget.");
      return true;
    },
  });
  if (!files["manifest.json"]) throw Error("Missing backup manifest.");
  const raw = z
    .object({
      version: z.literal(1),
      specimens: z.array(z.unknown()).max(50000),
      settings: settingsSchema,
      familiar: z.object({
        feeds: z.number().int().min(0),
        days: z.record(z.string(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
      }),
    })
    .strict()
    .parse(JSON.parse(strFromU8(files["manifest.json"])));
  const specimens = raw.specimens.map(validateSpecimen);
  const assets = new Map<string, Blob>();
  for (const s of specimens)
    if (s.assetId) {
      const data = files["assets/" + s.assetId];
      if (
        !data ||
        data.byteLength > 5 * 1024 * 1024 ||
        data[0] !== 137 ||
        data[1] !== 80 ||
        data[2] !== 78 ||
        data[3] !== 71
      )
        throw Error("Invalid or missing PNG asset.");
      assets.set(
        s.assetId,
        new Blob([data as Uint8Array<ArrayBuffer>], { type: "image/png" }),
      );
    }
  return {
    specimens,
    assets,
    settings: raw.settings,
    familiar: raw.familiar as Familiar,
  };
}
