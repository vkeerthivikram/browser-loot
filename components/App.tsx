import { QuiltPatch } from "./QuiltPatch";
import { sheet, designCss } from "../lib/share";
import { useEffect, useMemo, useState } from "react";
import { browser } from "wxt/browser";
import {
  Archive,
  ArrowDownToLine,
  ArrowUpFromLine,
  Flower2,
  Grid2X2,
  Heart,
  House,
  Leaf,
  Pause,
  Play,
  Plus,
  Search,
  Settings as Gear,
  Sparkles,
  Trash2,
  X,
  ExternalLink,
  Copy,
  Camera,
} from "lucide-react";
import { request, enableAutomatic, openMuseum } from "../lib/client";
import {
  defaults,
  kinds,
  titles,
  BUDGET,
  type Kind,
  type Settings,
  type Snapshot,
  type Specimen,
} from "../lib/model";
import { exportBackup } from "../lib/backup";
import { SpecimenView } from "./SpecimenView";
import css from "./app.module.css";
const rooms = [
  ["Home", House],
  ["Garden", Flower2],
  ["Cabinet", Archive],
  ["Oddities", Sparkles],
  ["Quilt", Grid2X2],
] as const;
function save(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const example = (kind: Kind, payload: any): Specimen =>
  ({
    id: "example-" + kind,
    kind,
    payload,
    sourceOrigin: "https://example.com",
    capturedAt: new Date().toISOString(),
    fingerprint: "example",
    favourite: false,
  }) as Specimen;
const examples = [
  example("colour", {
    value:
      "linear-gradient(135deg,#cc764f 0%,#cc764f 35%,#eee5cc 35%,#eee5cc 60%,#426447 60%)",
  }),
  example("shadow", { value: "10px 15px 20px #292d2633" }),
  example("corner", {
    radii: ["50%", "50%", "8px", "8px"],
    width: 130,
    height: 130,
  }),
  example("button", {
    styles: {
      backgroundColor: "#f0e5ce",
      color: "#6e4c2f",
      borderRadius: "8px",
      borderWidth: "1px",
      borderStyle: "solid",
      borderColor: "#8b7355",
      padding: "12px 22px",
      fontFamily: "Georgia",
    },
  }),
];
export function App({ popup = false }: { popup?: boolean }) {
  const [data, setData] = useState<Snapshot>({
    specimens: [],
    settings: defaults,
    familiar: { feeds: 0, days: {} },
    bytes: 0,
  });
  const [room, setRoom] = useState("Home");
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("");
  const [site, setSite] = useState("");
  const [date, setDate] = useState("");
  const [favourites, setFavourites] = useState(false);
  const [selected, setSelected] = useState<Specimen>();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [limit, setLimit] = useState(60);
  const [capture, setCapture] = useState<any>();
  const [crop, setCrop] = useState(100);
  const [label, setLabel] = useState("404 postcard");
  const [includeLink, setIncludeLink] = useState(false);
  useEffect(() => {
    if (!selected && !capture) return;
    const previous = document.activeElement as HTMLElement;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelected(undefined);
        setCapture(undefined);
      }
      if (e.key === "Tab") {
        const dialog = document.querySelector('[role="dialog"]');
        const controls = Array.from(
          dialog?.querySelectorAll<HTMLElement>(
            "button,input,a[href],select",
          ) ?? [],
        ).filter((el) => !el.hasAttribute("disabled"));
        const first = controls[0],
          last = controls.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [selected, capture]);
  async function refresh() {
    try {
      setData(await request<Snapshot>({ type: "SNAPSHOT" }));
      setReady(true);
    } catch (e) {
      setMessage(String(e));
    }
  }
  useEffect(() => {
    void refresh();
    const listener = () => void refresh();
    browser.storage.onChanged.addListener(listener);
    window.addEventListener("focus", listener);
    return () => {
      browser.storage.onChanged.removeListener(listener);
      window.removeEventListener("focus", listener);
    };
  }, []);
  async function action(fn: () => Promise<any>, success?: string) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
      await refresh();
      if (success) setMessage(success);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  const settings = data.settings;
  const patch = (p: Partial<Settings>) =>
    request({ type: "SETTINGS", patch: p });
  const filtered = useMemo(
    () =>
      data.specimens.filter(
        (s) =>
          (room !== "Garden" || s.kind === "favicon") &&
          (room !== "Cabinet" ||
            !["favicon", "postcard", "loader"].includes(s.kind)) &&
          (room !== "Oddities" || ["loader", "postcard"].includes(s.kind)) &&
          (!kind || s.kind === kind) &&
          (!site || s.sourceOrigin === site) &&
          (!date || s.capturedAt.startsWith(date)) &&
          (!favourites || s.favourite) &&
          (!search ||
            `${titles[s.kind]} ${s.sourceOrigin} ${JSON.stringify(s.payload)}`
              .toLowerCase()
              .includes(search.toLowerCase())),
      ),
    [data.specimens, room, kind, site, date, favourites, search],
  );
  const ordered = useMemo(() => {
    const ids = settings.quilt;
    return [...filtered].sort((a, b) => {
      const ai = ids.indexOf(a.id),
        bi = ids.indexOf(b.id);
      return (ai < 0 ? 99999 : ai) - (bi < 0 ? 99999 : bi);
    });
  }, [filtered, settings.quilt]);
  const quiltItems = useMemo(() => {
    const groups = new Map<string, Specimen[]>();
    for (const item of filtered)
      groups.set(item.sourceOrigin, [
        ...(groups.get(item.sourceOrigin) ?? []),
        item,
      ]);
    return [...groups.values()]
      .map(
        (items) =>
          items.find((s) => s.kind === "colour") ??
          items.find((s) => s.kind === "favicon") ??
          items[0],
      )
      .sort(
        (a, b) =>
          (settings.quilt.indexOf(a.id) < 0
            ? 99999
            : settings.quilt.indexOf(a.id)) -
          (settings.quilt.indexOf(b.id) < 0
            ? 99999
            : settings.quilt.indexOf(b.id)),
      );
  }, [filtered, settings.quilt]);
  async function collect() {
    if (!popup) {
      setMessage(
        "Open a website, then choose Collect now from the Browser Loot toolbar button.",
      );
      return;
    }
    const r = await request({ type: "COLLECT" });
    setMessage(
      `${r.added} new ${r.added === 1 ? "find" : "finds"} tucked away.`,
    );
  }
  async function screenshot() {
    setCapture(await request({ type: "SCREENSHOT" }));
    setCrop(100);
  }
  async function confirmCapture() {
    const img = new Image();
    img.src = capture.data;
    await img.decode();
    const canvas = document.createElement("canvas");
    const w = Math.round((img.naturalWidth * crop) / 100),
      h = Math.round((img.naturalHeight * crop) / 100);
    canvas.width = w;
    canvas.height = h;
    canvas
      .getContext("2d")!
      .drawImage(
        img,
        (img.naturalWidth - w) / 2,
        (img.naturalHeight - h) / 2,
        w,
        h,
        0,
        0,
        w,
        h,
      );
    await request({
      type: "SAVE_POSTCARD",
      data: canvas.toDataURL("image/png"),
      sourceOrigin: capture.sourceOrigin,
      label,
      ...(includeLink ? { pageUrl: capture.pageUrl } : {}),
    });
    setCapture(undefined);
  }
  async function exportSheet(quilt = false) {
    save(
      await sheet((quilt ? quiltItems : filtered).slice(0, 100), quilt),
      quilt ? "browser-loot-quilt.png" : "browser-loot-sheet.png",
    );
  }
  const familiar = (
    <aside className={css.familiar}>
      <span className={css.kicker}>Your familiar</span>
      <img src="/familiar-small.png" alt="An olive moth resting on a twig" />
      <h2>{settings.word || "A curious companion"}</h2>
      <p className={css.quote}>
        “An eye for the small
        <br />
        and unusual.”
      </p>
      <div className={css.feedLabel}>
        <span>
          <Leaf size={15} /> Little discoveries
        </span>
        <span>{data.familiar.feeds}</span>
      </div>
      <progress value={data.familiar.feeds % 20} max={20} />
      <p className={css.muted}>
        {settings.word
          ? `Whole-word sightings of “${settings.word}” help your familiar grow. One feed per site each day.`
          : "Choose a word in Settings. Your familiar will watch for it as you wander."}
      </p>
      <span className={css.stage}>
        {data.familiar.feeds < 5
          ? "Just hatched"
          : data.familiar.feeds < 20
            ? "Finding its wings"
            : data.familiar.feeds < 50
              ? "Curious explorer"
              : "Keeper of wonders"}
      </span>
    </aside>
  );
  return (
    <div className={popup ? css.popup : css.app}>
      {!popup && (
        <nav className={css.sidebar} aria-label="Museum">
          <a className={css.brand} href="#" onClick={() => setRoom("Home")}>
            <Leaf />
            <span>
              Browser Loot<small>Small wonders from the web</small>
            </span>
          </a>
          <div className={css.navItems}>
            {rooms.map(([name, Icon]) => (
              <button
                key={name}
                className={room === name ? css.active : ""}
                onClick={() => {
                  setRoom(name);
                  setLimit(60);
                }}
              >
                <Icon size={20} />
                {name}
              </button>
            ))}
          </div>
          <div className={css.sideArt}>
            <Leaf size={90} strokeWidth={0.6} />
            <p>
              Keep a little
              <br />
              of the wonderful.
            </p>
          </div>
          <button
            className={room === "Settings" ? css.active : ""}
            onClick={() => setRoom("Settings")}
          >
            <Gear size={20} />
            Settings
          </button>
          <span className={css.local}>Stored on this device</span>
        </nav>
      )}
      <main className={css.main}>
        {popup ? (
          <header className={css.popupHeader}>
            <div className={css.brand}>
              <Leaf />
              <span>
                Browser Loot<small>Small wonders from the web</small>
              </span>
            </div>
            <button aria-label="Open settings" onClick={() => openMuseum()}>
              <Gear size={20} />
            </button>
          </header>
        ) : (
          <header className={css.header}>
            <div>
              <h1>
                {room === "Home"
                  ? "A little more curious."
                  : room === "Garden"
                    ? "A garden of elsewhere."
                    : room === "Cabinet"
                      ? "Details worth keeping."
                      : room === "Oddities"
                        ? "The wonderfully unusual."
                        : room === "Quilt"
                          ? "Your web, woven together."
                          : "Make yourself at home."}
              </h1>
              <p>
                {room === "Home"
                  ? "Small wonders from your everyday browsing."
                  : room === "Settings"
                    ? "Your collection. Your pace. Your rules."
                    : "Every little detail has a story."}
              </p>
            </div>
            <span className={css.local}>
              <span className={css.dot} />
              Local & private
            </span>
          </header>
        )}
        {message && (
          <div className={css.notice} role="status">
            {message}
            <button aria-label="Dismiss message" onClick={() => setMessage("")}>
              <X size={16} />
            </button>
          </div>
        )}
        {ready && !settings.onboarded && (
          <section className={css.onboarding}>
            <Leaf size={28} />
            <div>
              <h2>Make room for small wonders.</h2>
              <p>
                Collect visual details while you browse. Everything stays in
                this browser. Automatic collecting needs website access; manual
                collecting works without it.
              </p>
              <div className={css.row}>
                <button
                  className={css.primary}
                  disabled={busy}
                  onClick={() =>
                    action(async () => {
                      const ok = await enableAutomatic();
                      if (!ok)
                        setMessage(
                          "Access declined. You can still collect manually.",
                        );
                    })
                  }
                >
                  Enable automatic collecting
                </button>
                <button
                  onClick={() => action(() => patch({ onboarded: true }))}
                >
                  Collect manually
                </button>
              </div>
            </div>
          </section>
        )}
        {room === "Settings" && !popup ? (
          <section className={css.settings}>
            <h2>Collecting</h2>
            <label className={css.setting}>
              <span>
                Automatic collecting
                <small>Discover visual details on permitted websites.</small>
              </span>
              <input
                type="checkbox"
                checked={settings.automatic}
                onChange={(e) =>
                  action(() =>
                    e.target.checked
                      ? enableAutomatic()
                      : patch({ automatic: false }),
                  )
                }
              />
            </label>
            <label className={css.setting}>
              <span>Pause all collecting</span>
              <input
                type="checkbox"
                checked={settings.paused}
                onChange={(e) =>
                  action(() => patch({ paused: e.target.checked }))
                }
              />
            </label>
            <h2>Your familiar’s word</h2>
            <p className={css.muted}>
              Choose one word. Only feeding counts are saved, never page text.
            </p>
            <form
              className={css.row}
              onSubmit={(e) => {
                e.preventDefault();
                const word = new FormData(e.currentTarget).get(
                  "word",
                ) as string;
                void action(
                  () => patch({ word: word.trim().slice(0, 40) }),
                  "Word saved.",
                );
              }}
            >
              <input
                name="word"
                defaultValue={settings.word}
                maxLength={40}
                placeholder="perhaps"
                aria-label="Familiar word"
              />
              <button type="submit">Save word</button>
            </form>
            <h2>Your collections</h2>
            <div className={css.toggles}>
              {kinds.map((k) => (
                <label key={k}>
                  <input
                    type="checkbox"
                    checked={settings.enabled.includes(k)}
                    onChange={(e) =>
                      action(() =>
                        patch({
                          enabled: e.target.checked
                            ? [...settings.enabled, k]
                            : settings.enabled.filter((x) => x !== k),
                        }),
                      )
                    }
                  />
                  {titles[k]}
                </label>
              ))}
            </div>
            <h2>Excluded websites</h2>
            <form
              className={css.row}
              onSubmit={(e) => {
                e.preventDefault();
                const f = e.currentTarget;
                try {
                  const host = new URL(
                    "https://" +
                      String(new FormData(f).get("host")).replace(
                        /^https?:\/\//,
                        "",
                      ),
                  ).hostname;
                  void action(() =>
                    patch({
                      excluded: [...new Set([...settings.excluded, host])],
                    }),
                  );
                  f.reset();
                } catch {
                  setMessage("Enter a website hostname.");
                }
              }}
            >
              <input
                name="host"
                required
                placeholder="example.com"
                aria-label="Website to exclude"
              />
              <button>Add exclusion</button>
            </form>
            {settings.excluded.map((host) => (
              <div className={css.setting} key={host}>
                {host}
                <button
                  onClick={() =>
                    action(() =>
                      patch({
                        excluded: settings.excluded.filter((x) => x !== host),
                      }),
                    )
                  }
                >
                  Remove
                </button>
              </div>
            ))}
            <h2>Keep your treasures safe</h2>
            <p>{(data.bytes / 1024 / 1024).toFixed(2)} MB of 250 MB used</p>
            <progress max={BUDGET} value={data.bytes} />
            <div className={css.row}>
              <button
                onClick={() =>
                  action(async () =>
                    save(await exportBackup(data), "browser-loot-backup.zip"),
                  )
                }
              >
                <ArrowDownToLine size={16} />
                Export backup
              </button>
              <label className={css.fileButton}>
                <ArrowUpFromLine size={16} />
                Import backup
                <input
                  type="file"
                  accept=".zip"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f)
                      void action(
                        async () =>
                          request({
                            type: "IMPORT",
                            bytes: Array.from(
                              new Uint8Array(await f.arrayBuffer()),
                            ),
                          }),
                        "Backup restored.",
                      );
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            <p className={css.muted}>
              Backups include source websites and any postcards you saved. Keep
              them somewhere private.
            </p>
            <button
              className={css.danger}
              onClick={() => {
                if (
                  confirm(
                    "Delete every saved specimen, image, and familiar feeding count? This cannot be undone.",
                  )
                )
                  void action(
                    () => request({ type: "CLEAR" }),
                    "Collection cleared.",
                  );
              }}
            >
              <Trash2 size={16} />
              Delete collection
            </button>
          </section>
        ) : (
          <>
            <div className={css.toolbar}>
              {!popup && (
                <label className={css.search}>
                  <Search size={19} />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search collection…"
                    aria-label="Search collection"
                  />
                </label>
              )}
              <button
                className={css.primary}
                disabled={busy}
                onClick={() => action(collect)}
              >
                <Plus size={19} />
                {busy ? "Collecting…" : "Collect now"}
              </button>
            </div>
            {popup && (
              <>
                <div className={css.row}>
                  <button
                    onClick={() =>
                      action(() => patch({ paused: !settings.paused }))
                    }
                  >
                    {settings.paused ? <Play size={15} /> : <Pause size={15} />}{" "}
                    {settings.paused ? "Resume" : "Pause"}
                  </button>
                  <button
                    onClick={() =>
                      action(async () => {
                        const [t] = await browser.tabs.query({
                          active: true,
                          currentWindow: true,
                        });
                        if (!t.url) throw Error("Website access unavailable.");
                        await patch({
                          excluded: [
                            ...new Set([
                              ...settings.excluded,
                              new URL(t.url).hostname,
                            ]),
                          ],
                        });
                      }, "Website excluded.")
                    }
                  >
                    Exclude site
                  </button>
                </div>
                <div className={css.row}>
                  <button onClick={() => action(screenshot)}>
                    <Camera size={15} />
                    Save postcard
                  </button>
                  <button
                    onClick={() =>
                      action(async () => {
                        const r = await request({ type: "LOADER" });
                        setMessage(
                          r.unsupported
                            ? "No supported CSS loader selected. Use Save postcard for a still."
                            : `${r.added} loader saved.`,
                        );
                      })
                    }
                  >
                    Pick loader
                  </button>
                </div>
              </>
            )}
            {!popup && (
              <>
                <div className={css.stats}>
                  <span>
                    <Leaf />
                    {data.specimens.length}
                    <small>Finds</small>
                  </span>
                  <span>
                    <Flower2 />
                    {new Set(data.specimens.map((s) => s.sourceOrigin)).size}
                    <small>Websites</small>
                  </span>
                  <button
                    onClick={() => setFavourites(!favourites)}
                    aria-pressed={favourites}
                  >
                    <Heart fill={favourites ? "currentColor" : "none"} />
                    {data.specimens.filter((s) => s.favourite).length}
                    <small>Favourites</small>
                  </button>
                </div>
                <div className={css.filters}>
                  <select
                    aria-label="Collection type"
                    value={kind}
                    onChange={(e) => setKind(e.target.value)}
                  >
                    <option value="">All collections</option>
                    {kinds.map((k) => (
                      <option key={k} value={k}>
                        {titles[k]}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Source website"
                    value={site}
                    onChange={(e) => setSite(e.target.value)}
                  >
                    <option value="">All websites</option>
                    {[
                      ...new Set(data.specimens.map((s) => s.sourceOrigin)),
                    ].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                  <input
                    type="date"
                    aria-label="Collection date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                  <button
                    onClick={() => action(() => exportSheet(room === "Quilt"))}
                  >
                    <ArrowDownToLine size={15} />
                    Export PNG
                  </button>
                </div>
              </>
            )}
            {room === "Home" &&
              !popup &&
              data.specimens.length === 0 &&
              !search && (
                <section>
                  <div className={css.sectionTitle}>
                    <h2>Example specimens</h2>
                    <span>A taste of what you can collect</span>
                  </div>
                  <div className={css.shelf}>
                    {examples.map((item) => (
                      <article key={item.id} className={css.example}>
                        <div className={css.preview}>
                          <SpecimenView item={item} />
                        </div>
                        <h3>{titles[item.kind]}</h3>
                        <small>Example · example.com</small>
                      </article>
                    ))}
                  </div>
                </section>
              )}
            <section>
              <div className={css.sectionTitle}>
                <h2>
                  {popup
                    ? "Recent finds"
                    : room === "Home"
                      ? "Fresh from the web"
                      : room === "Quilt"
                        ? "A patch for every discovery"
                        : "Your specimens"}
                </h2>
                <span>
                  {filtered.length
                    ? `${filtered.length} little wonders`
                    : "Good things begin with a little wandering"}
                </span>
              </div>
              {filtered.length === 0 ? (
                <div className={css.empty}>
                  <Leaf size={42} strokeWidth={1} />
                  <h3>
                    {search || kind || site || date || favourites
                      ? "No matching wonders."
                      : "Nothing here. Yet."}
                  </h3>
                  <p>
                    {search || kind || site || date || favourites
                      ? "Try another filter or search."
                      : "Open a website and collect something curious from the toolbar."}
                  </p>
                </div>
              ) : (
                <div className={room === "Quilt" ? css.quilt : css.specimens}>
                  {(room === "Quilt" ? quiltItems : filtered)
                    .slice(0, popup ? 4 : limit)
                    .map((item, index) => (
                      <article key={item.id} className={css.specimen}>
                        <button
                          className={css.specimenOpen}
                          onClick={() => setSelected(item)}
                        >
                          <div className={css.preview}>
                            {room === "Quilt" ? (
                              <QuiltPatch
                                items={data.specimens.filter(
                                  (s) => s.sourceOrigin === item.sourceOrigin,
                                )}
                              />
                            ) : (
                              <SpecimenView item={item} />
                            )}
                          </div>
                          <h3>{titles[item.kind]}</h3>
                          <small>{new URL(item.sourceOrigin).hostname}</small>
                          <time>
                            {new Date(item.capturedAt).toLocaleDateString()}
                          </time>
                        </button>
                        <button
                          className={css.heart}
                          aria-label={
                            item.favourite
                              ? "Remove favourite"
                              : "Favourite specimen"
                          }
                          onClick={() =>
                            action(() =>
                              request({
                                type: "MUTATE",
                                id: item.id,
                                action: "favourite",
                              }),
                            )
                          }
                        >
                          <Heart
                            size={16}
                            fill={item.favourite ? "currentColor" : "none"}
                          />
                        </button>
                        {room === "Quilt" && (
                          <div className={css.row}>
                            <button
                              disabled={index === 0}
                              onClick={() =>
                                action(async () => {
                                  const ids = quiltItems.map((s) => s.id);
                                  [ids[index - 1], ids[index]] = [
                                    ids[index],
                                    ids[index - 1],
                                  ];
                                  await patch({ quilt: ids });
                                })
                              }
                            >
                              Move earlier
                            </button>
                            <button
                              disabled={index === quiltItems.length - 1}
                              onClick={() =>
                                action(async () => {
                                  const ids = quiltItems.map((s) => s.id);
                                  [ids[index], ids[index + 1]] = [
                                    ids[index + 1],
                                    ids[index],
                                  ];
                                  await patch({ quilt: ids });
                                })
                              }
                            >
                              Move later
                            </button>
                          </div>
                        )}
                      </article>
                    ))}
                </div>
              )}
              {!popup && filtered.length > limit && (
                <button onClick={() => setLimit(limit + 60)}>
                  Show more finds
                </button>
              )}
            </section>
            {popup && (
              <button className={css.openMuseum} onClick={openMuseum}>
                <Archive size={18} />
                Open museum
                <ExternalLink size={15} />
              </button>
            )}
          </>
        )}
        {!popup && (
          <footer className={css.footer}>
            <span>Made for the joy of noticing.</span>
            <span>Browser Loot · A cabinet of your own</span>
          </footer>
        )}
      </main>
      {!popup && familiar}
      {selected && (
        <div className={css.modalBackdrop}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Specimen details"
            className={css.modal}
          >
            <button
              className={css.close}
              aria-label="Close details"
              onClick={() => setSelected(undefined)}
              autoFocus
            >
              <X />
            </button>
            <h2>{titles[selected.kind]}</h2>
            <div className={css.detailPreview}>
              <SpecimenView item={selected} />
            </div>
            <p>
              <a href={selected.sourceOrigin} target="_blank" rel="noreferrer">
                {new URL(selected.sourceOrigin).hostname}{" "}
                <ExternalLink size={14} />
              </a>
            </p>
            <p className={css.muted}>
              Collected {new Date(selected.capturedAt).toLocaleString()}
            </p>
            {selected.kind === "corner" && (
              <p>
                Original dimensions: {selected.payload.width.toFixed(0)} ×{" "}
                {selected.payload.height.toFixed(0)} px
              </p>
            )}
            {selected.kind === "typography" && (
              <p className={css.muted}>
                Declared font stack. Preview uses fonts available on this
                device.
              </p>
            )}
            {selected.kind === "scrollbar" && (
              <p className={css.muted}>
                {selected.payload.engine} styling · reconstructed preview
              </p>
            )}
            <pre>{designCss(selected)}</pre>
            <div className={css.row}>
              <button
                onClick={() =>
                  action(
                    () =>
                      navigator.clipboard.writeText(
                        JSON.stringify(selected.payload, null, 2),
                      ),
                    "Design values copied.",
                  )
                }
              >
                <Copy size={16} />
                Copy values
              </button>
              <button
                className={css.danger}
                onClick={() =>
                  action(async () => {
                    await request({
                      type: "MUTATE",
                      id: selected.id,
                      action: "delete",
                    });
                    setSelected(undefined);
                  })
                }
              >
                <Trash2 size={16} />
                Delete
              </button>
            </div>
          </section>
        </div>
      )}
      {capture && (
        <div className={css.modalBackdrop}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Review screenshot"
            className={css.modal}
          >
            <h2>Keep this postcard?</h2>
            <p>Review what will be saved. Cancel discards the image.</p>
            <div className={css.cropPreview}>
              <img
                src={capture.data}
                alt="Screenshot awaiting your approval"
                style={{ clipPath: `inset(${(100 - crop) / 2}%)` }}
              />
            </div>
            <label>
              Centre crop: {crop}%
              <input
                type="range"
                min="20"
                max="100"
                value={crop}
                onChange={(e) => setCrop(Number(e.target.value))}
              />
            </label>
            <label>
              Label
              <input
                value={label}
                maxLength={120}
                onChange={(e) => setLabel(e.target.value)}
              />
            </label>
            <label className={css.row}>
              <input
                type="checkbox"
                checked={includeLink}
                onChange={(e) => setIncludeLink(e.target.checked)}
              />
              Include page link
            </label>
            {includeLink && <p className={css.muted}>{capture.pageUrl}</p>}
            <div className={css.row}>
              <button
                className={css.primary}
                onClick={() => action(confirmCapture, "Postcard saved.")}
              >
                Save postcard
              </button>
              <button onClick={() => setCapture(undefined)}>Cancel</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
