import "fake-indexeddb/auto";
import { beforeEach, it, expect } from "vitest";
import { clear, insert, snapshot, mutate, restore, dbPromise } from "../lib/db";
import { defaults } from "../lib/model";
import { BUDGET } from "../lib/model";
it("rolls back a capture when the application budget is exceeded", async () => {
  const db = await dbPromise;
  await db.put("meta", BUDGET - 1, "bytes");
  await expect(
    insert(
      [{ kind: "colour", payload: { value: "red" } }],
      "https://example.com",
      false,
    ),
  ).rejects.toThrow("full");
  expect((await snapshot(defaults)).specimens).toHaveLength(0);
});
beforeEach(clear);
it("deduplicates concurrent captures transactionally and counts one daily feed", async () => {
  const c = { kind: "colour" as const, payload: { value: "red" } };
  await Promise.all([
    insert([c], "https://example.com", true, new Map(), true),
    insert([c], "https://example.com", true, new Map(), true),
  ]);
  const s = await snapshot(defaults);
  expect(s.specimens).toHaveLength(1);
  expect(s.familiar.feeds).toBe(1);
});
it("limits automatic finds while allowing distinct explicit captures", async () => {
  await insert(
    [{ kind: "colour", payload: { value: "red" } }],
    "https://example.com",
    true,
  );
  expect(
    await insert(
      [{ kind: "colour", payload: { value: "blue" } }],
      "https://example.com",
      true,
    ),
  ).toBe(0);
  expect(
    await insert(
      [{ kind: "colour", payload: { value: "blue" } }],
      "https://example.com",
      false,
    ),
  ).toBe(1);
});
it("deletes associated images and releases budget", async () => {
  await insert(
    [{ kind: "favicon", payload: { monogram: "EX" } }],
    "https://example.com",
    false,
    new Map([[0, new Blob(["asset"])]]),
  );
  const s = await snapshot(defaults);
  expect(s.bytes).toBeGreaterThan(0);
  await mutate(s.specimens[0].id, "delete");
  expect((await snapshot(defaults)).bytes).toBe(0);
});
it("merges restored items without duplicates", async () => {
  await insert(
    [{ kind: "shadow", payload: { value: "0 2px 3px black" } }],
    "https://example.com",
    false,
  );
  const s = await snapshot(defaults);
  await restore(s.specimens, new Map(), s.familiar);
  expect((await snapshot(defaults)).specimens).toHaveLength(1);
});
