import {
  hasWord,
  validateCandidate,
  type Candidate,
  type Settings,
  type SafeStyle,
  styleKeys,
} from "./model";
const forbidden =
  'input,textarea,select,option,[contenteditable]:not([contenteditable="false"]),[hidden],[aria-hidden="true"],script,style,noscript';
export function visible(el: Element) {
  if (
    el.checkVisibility &&
    !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
  )
    return false;
  const s = getComputedStyle(el);
  return (
    !el.closest(forbidden) &&
    s.display !== "none" &&
    s.visibility !== "hidden" &&
    s.opacity !== "0" &&
    el.getClientRects().length > 0
  );
}
export function styles(el: Element): SafeStyle {
  const s = getComputedStyle(el);
  const keys = [
    "color",
    "backgroundColor",
    "backgroundImage",
    "boxShadow",
    "borderRadius",
    "borderColor",
    "borderWidth",
    "borderStyle",
    "fontFamily",
    "fontSize",
    "fontWeight",
    "letterSpacing",
    "lineHeight",
    "padding",
  ] as const;
  return Object.fromEntries(
    keys
      .map((k) => [k, s[k]])
      .filter(([, v]) => v && !/url\s*\(|[<>\\]|var\s*\(/i.test(v)),
  );
}
export async function scan(settings: Settings) {
  const candidates: Candidate[] = [];
  const seen = new Set<string>();
  let text = "";
  let visited = 0;
  const roots: (Document | ShadowRoot)[] = [document];
  const add = (c: Candidate) => {
    try {
      const safe = validateCandidate(c),
        key = safe.kind;
      if (safe.kind === "colour" && safe.payload.value.includes("gradient(")) {
        const old = candidates.findIndex(
          (item) =>
            item.kind === "colour" && !item.payload.value.includes("gradient("),
        );
        if (old >= 0 && settings.enabled.includes("colour")) {
          candidates[old] = safe;
          return;
        }
      }
      if (settings.enabled.includes(safe.kind) && !seen.has(key)) {
        candidates.push(safe);
        seen.add(key);
      }
    } catch {}
  };
  add({
    kind: "favicon",
    payload: {
      monogram: location.hostname
        .replace(/^www\./, "")
        .slice(0, 2)
        .toUpperCase(),
    },
    assetUrl:
      document.querySelector<HTMLLinkElement>('link[rel~="icon"]')?.href,
  });
  for (let r = 0; r < roots.length && visited < 1200; r++) {
    const walker = document.createTreeWalker(roots[r], NodeFilter.SHOW_ELEMENT);
    let node: Node | null;
    while ((node = walker.nextNode()) && visited < 1200) {
      visited++;
      const el = node as HTMLElement;
      if (el.shadowRoot) roots.push(el.shadowRoot);
      if (!visible(el)) continue;
      const s = getComputedStyle(el),
        rect = el.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8) continue;
      if (settings.word && text.length < 100000)
        for (const child of el.childNodes)
          if (child.nodeType === Node.TEXT_NODE)
            text += (child.textContent ?? "").slice(0, 2000) + " ";
      if (
        s.backgroundImage.includes("gradient(") &&
        !s.backgroundImage.includes("url(")
      )
        add({ kind: "colour", payload: { value: s.backgroundImage } });
      else if (
        s.backgroundColor !== "rgba(0, 0, 0, 0)" &&
        s.backgroundColor !== "rgb(255, 255, 255)"
      )
        add({ kind: "colour", payload: { value: s.backgroundColor } });
      if (s.boxShadow !== "none")
        add({ kind: "shadow", payload: { value: s.boxShadow } });
      const radii = [
        s.borderTopLeftRadius,
        s.borderTopRightRadius,
        s.borderBottomRightRadius,
        s.borderBottomLeftRadius,
      ];
      if (radii.some((v) => v !== "0px"))
        add({
          kind: "corner",
          payload: {
            radii,
            width: Math.min(rect.width, 10000),
            height: Math.min(rect.height, 10000),
          },
        });
      if (
        el.matches(
          'button,[role="button"],input[type="button"],input[type="submit"]',
        )
      )
        add({ kind: "button", payload: { styles: styles(el) } });
      if (el.matches("h1,h2,h3,p"))
        add({
          kind: "typography",
          payload: {
            styles: {
              fontFamily: s.fontFamily,
              fontSize: s.fontSize,
              fontWeight: s.fontWeight,
              letterSpacing: s.letterSpacing,
              lineHeight: s.lineHeight,
            },
            fallback: true,
          },
        });
      const cursor = s.cursor.match(
        /url\(["']?(.+?)["']?\)(?:\s+(\d+)\s+(\d+))?/,
      );
      if (cursor)
        add({
          kind: "cursor",
          payload: {
            x: Number(cursor[2] ?? 0),
            y: Number(cursor[3] ?? 0),
            available: false,
          },
          assetUrl: new URL(cursor[1], location.href).href,
        });
      if (visited % 40 === 0)
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }
  const ss = getComputedStyle(document.documentElement);
  if (ss.scrollbarColor !== "auto" || ss.scrollbarWidth !== "auto")
    add({
      kind: "scrollbar",
      payload: {
        color: ss.scrollbarColor,
        width: ss.scrollbarWidth,
        engine: "standard",
      },
    });
  else {
    try {
      const track = getComputedStyle(
        document.documentElement,
        "::-webkit-scrollbar",
      );
      const thumb = getComputedStyle(
        document.documentElement,
        "::-webkit-scrollbar-thumb",
      );
      if (track.width && track.width !== "auto")
        add({
          kind: "scrollbar",
          payload: {
            color:
              thumb.backgroundColor +
              " " +
              getComputedStyle(document.body).backgroundColor,
            width: track.width,
            engine: "webkit",
          },
        });
    } catch {}
  }
  return {
    candidates,
    feed: settings.word ? hasWord(text, settings.word) : false,
  };
}
export function pickLoader(): Promise<Candidate | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.textContent = "Select a loader · Esc to cancel";
    Object.assign(overlay.style, {
      position: "fixed",
      top: "12px",
      left: "50%",
      transform: "translateX(-50%)",
      padding: "14px 24px",
      background: "#292d26",
      color: "white",
      zIndex: "2147483647",
      borderRadius: "8px",
      pointerEvents: "none",
      font: "14px sans-serif",
    });
    document.documentElement.append(overlay);
    const cleanup = () => {
      overlay.remove();
      document.removeEventListener("click", click, true);
      document.removeEventListener("keydown", key, true);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cleanup();
        resolve(null);
      }
    };
    const click = (e: MouseEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      cleanup();
      const el = e.composedPath()[0] as Element;
      if (!visible(el)) {
        resolve(null);
        return;
      }
      const animations = el
        .getAnimations()
        .filter((a) => a instanceof CSSAnimation);
      const animation = animations[0],
        effect = animation?.effect as KeyframeEffect | undefined;
      const timing = effect?.getTiming();
      const raw = effect?.getKeyframes() ?? [];
      const permitted = [
        "opacity",
        "transform",
        "backgroundColor",
        "borderRadius",
        "offset",
        "easing",
        "composite",
        "computedOffset",
      ];
      if (
        !effect ||
        raw.length < 2 ||
        raw.some((f) => Object.keys(f).some((k) => !permitted.includes(k)))
      ) {
        resolve(null);
        return;
      }
      const frames = raw.map((f) =>
        Object.fromEntries(
          Object.entries(f).filter(([k]) =>
            [
              "opacity",
              "transform",
              "backgroundColor",
              "borderRadius",
              "offset",
            ].includes(k),
          ),
        ),
      );
      try {
        resolve(
          validateCandidate({
            kind: "loader",
            payload: {
              styles: {
                ...styles(el),
                width: getComputedStyle(el).width,
                height: getComputedStyle(el).height,
              },
              frames,
              duration: Math.min(
                60000,
                Math.max(50, Number(timing?.duration) || 1000),
              ),
              easing: [
                "linear",
                "ease",
                "ease-in",
                "ease-out",
                "ease-in-out",
              ].includes(String(timing?.easing))
                ? timing?.easing
                : "linear",
            },
          }),
        );
      } catch {
        resolve(null);
      }
    };
    document.addEventListener("click", click, true);
    document.addEventListener("keydown", key, true);
    setTimeout(() => {
      cleanup();
      resolve(null);
    }, 30000);
  });
}
