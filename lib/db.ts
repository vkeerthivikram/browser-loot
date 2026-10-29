import { openDB } from "idb";
import {
  BUDGET,
  defaults,
  fingerprint,
  validateSpecimen,
  type Candidate,
  type Familiar,
  type Settings,
  type Snapshot,
  type Specimen,
} from "./model";
export const dbPromise = openDB("browser-loot", 1, {
  upgrade(db) {
    db.createObjectStore("specimens", { keyPath: "id" });
    db.createObjectStore("assets");
    db.createObjectStore("meta");
  },
});
export async function snapshot(settings: Settings): Promise<Snapshot> {
  const db = await dbPromise;
  const tx = db.transaction(["specimens", "meta"], "readonly");
  return {
    specimens: (await tx.objectStore("specimens").getAll()).sort((a, b) =>
      b.capturedAt.localeCompare(a.capturedAt),
    ),
    settings,
    familiar: (await tx.objectStore("meta").get("familiar")) ?? {
      feeds: 0,
      days: {},
    },
    bytes: (await tx.objectStore("meta").get("bytes")) ?? 0,
  };
}
export async function asset(id: string) {
  return (await dbPromise).get("assets", id) as Promise<Blob | undefined>;
}
export async function insert(
  candidates: Candidate[],
  sourceOrigin: string,
  automatic: boolean,
  assets: Map<number, Blob> = new Map(),
  feed = false,
) {
  const hashes = await Promise.all(
    candidates.map(async (_, i) => {
      const blob = assets.get(i);
      return blob
        ? Array.from(
            new Uint8Array(
              await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()),
            ),
          )
            .map((n) => n.toString(16).padStart(2, "0"))
            .join("")
        : "";
    }),
  );
  const db = await dbPromise;
  const tx = db.transaction(["specimens", "assets", "meta"], "readwrite");
  const store = tx.objectStore("specimens");
  const existing: Specimen[] = await store.getAll();
  let bytes: number = (await tx.objectStore("meta").get("bytes")) ?? 0;
  let added = 0;
  const now = new Date().toISOString(),
    day = now.slice(0, 10);
  for (const [i, c] of candidates.entries()) {
    const fp = fingerprint(c) + (hashes[i] ? ":" + hashes[i] : "");
    if (
      existing.some(
        (s) =>
          s.sourceOrigin === sourceOrigin &&
          (s.fingerprint === fp ||
            (c.kind === "favicon" && s.kind === "favicon") ||
            (automatic && s.kind === c.kind && s.capturedAt.startsWith(day))),
      )
    )
      continue;
    const blob = assets.get(i),
      id = crypto.randomUUID();
    const item = validateSpecimen({
      id,
      kind: c.kind,
      sourceOrigin,
      capturedAt: now,
      fingerprint: fp,
      favourite: false,
      payload: c.payload,
      ...(blob ? { assetId: id } : {}),
    });
    const cost =
      new TextEncoder().encode(JSON.stringify(item)).byteLength +
      (blob?.size ?? 0);
    if (bytes + cost > BUDGET) {
      tx.abort();
      await tx.done.catch(() => {});
      throw Error(
        "Cabinet is full. Export or delete finds before collecting more.",
      );
    }
    bytes += cost;
    await store.put(item);
    if (blob) await tx.objectStore("assets").put(blob, id);
    existing.push(item);
    added++;
  }
  if (feed) {
    const f: Familiar = (await tx.objectStore("meta").get("familiar")) ?? {
      feeds: 0,
      days: {},
    };
    if (f.days[sourceOrigin] !== day) {
      f.days[sourceOrigin] = day;
      f.feeds++;
      await tx.objectStore("meta").put(f, "familiar");
    }
  }
  await tx.objectStore("meta").put(bytes, "bytes");
  await tx.done;
  return added;
}
export async function mutate(id: string, action: "favourite" | "delete") {
  const db = await dbPromise;
  const tx = db.transaction(["specimens", "assets", "meta"], "readwrite");
  const s: Specimen | undefined = await tx.objectStore("specimens").get(id);
  if (s) {
    if (action === "favourite") {
      s.favourite = !s.favourite;
      await tx.objectStore("specimens").put(s);
    } else {
      const b = s.assetId
        ? await tx.objectStore("assets").get(s.assetId)
        : undefined;
      await tx.objectStore("specimens").delete(id);
      if (s.assetId) await tx.objectStore("assets").delete(s.assetId);
      const cost =
        new TextEncoder().encode(JSON.stringify(s)).byteLength + (b?.size ?? 0);
      await tx
        .objectStore("meta")
        .put(
          Math.max(
            0,
            ((await tx.objectStore("meta").get("bytes")) ?? 0) - cost,
          ),
          "bytes",
        );
    }
  }
  await tx.done;
}
export async function clear() {
  const db = await dbPromise;
  const tx = db.transaction(["specimens", "assets", "meta"], "readwrite");
  for (const name of ["specimens", "assets", "meta"] as const)
    await tx.objectStore(name).clear();
  await tx.done;
}
export async function restore(
  items: Specimen[],
  assets: Map<string, Blob>,
  familiar: Familiar,
) {
  const db = await dbPromise;
  const tx = db.transaction(["specimens", "assets", "meta"], "readwrite");
  const existing: Specimen[] = await tx.objectStore("specimens").getAll();
  let bytes = (await tx.objectStore("meta").get("bytes")) ?? 0;
  for (const s of items) {
    if (
      existing.some(
        (x) =>
          x.id === s.id ||
          (x.sourceOrigin === s.sourceOrigin &&
            x.fingerprint === s.fingerprint),
      )
    )
      continue;
    const b = s.assetId ? assets.get(s.assetId) : undefined;
    const cost =
      new TextEncoder().encode(JSON.stringify(s)).byteLength + (b?.size ?? 0);
    bytes += cost;
    if (bytes > BUDGET) {
      tx.abort();
      await tx.done.catch(() => {});
      throw Error("Backup exceeds storage budget.");
    }
    await tx.objectStore("specimens").put(s);
    if (s.assetId && b) await tx.objectStore("assets").put(b, s.assetId);
    existing.push(s);
  }
  await tx.objectStore("meta").put(bytes, "bytes");
  const current = (await tx.objectStore("meta").get("familiar")) ?? {
    feeds: 0,
    days: {},
  };
  await tx.objectStore("meta").put(
    {
      feeds: Math.max(current.feeds, familiar.feeds),
      days: { ...familiar.days, ...current.days },
    },
    "familiar",
  );
  await tx.done;
}
