import { useEffect, useRef, useState } from "react";
import { asset } from "../lib/db";
import type { Specimen } from "../lib/model";
import css from "./app.module.css";
export function SpecimenView({ item }: { item: Specimen }) {
  const [url, setUrl] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true,
      local = "";
    if (item.assetId)
      void asset(item.assetId).then((b) => {
        if (b && active) {
          local = URL.createObjectURL(b);
          setUrl(local);
        }
      });
    return () => {
      active = false;
      if (local) URL.revokeObjectURL(local);
    };
  }, [item.assetId]);
  useEffect(() => {
    if (
      item.kind !== "loader" ||
      !ref.current ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const a = ref.current.animate(item.payload.frames, {
      duration: item.payload.duration,
      easing: item.payload.easing,
      iterations: Infinity,
    });
    return () => a.cancel();
  }, [item]);
  switch (item.kind) {
    case "favicon":
      return (
        <div className={css.flower}>
          <span>{url ? <img src={url} alt="" /> : item.payload.monogram}</span>
          <i />
        </div>
      );
    case "colour":
      return (
        <div
          className={css.swatch}
          style={{ background: item.payload.value }}
        />
      );
    case "shadow":
      return (
        <div className={css.shadow} style={{ boxShadow: item.payload.value }} />
      );
    case "corner":
      return (
        <div
          className={css.corner}
          style={{
            borderRadius: item.payload.radii.join(" / ").includes("%")
              ? item.payload.radii.join(" ")
              : item.payload.radii.join(" "),
            aspectRatio: `${item.payload.width || 1}/${item.payload.height || 1}`,
          }}
        />
      );
    case "button":
      return (
        <span className={css.buttonSample} style={item.payload.styles}>
          Button
        </span>
      );
    case "typography":
      return (
        <div className={css.typeSample}>
          <span style={item.payload.styles}>Aa</span>
          <small>Local font preview</small>
        </div>
      );
    case "cursor":
      return url ? (
        <img className={css.cursorImage} src={url} alt="Custom cursor" />
      ) : (
        <span className={css.unavailable}>
          ↖<small>Preview unavailable</small>
        </span>
      );
    case "scrollbar":
      return (
        <div
          className={css.scrollSample}
          style={{
            scrollbarColor: item.payload.color,
            scrollbarWidth: ["auto", "thin", "none"].includes(
              item.payload.width,
            )
              ? (item.payload.width as "thin")
              : "thin",
          }}
        >
          <p>A small scroll through something curious.</p>
          <p>Every little detail has a story.</p>
          <p>Keep wandering.</p>
        </div>
      );
    case "loader":
      return (
        <div ref={ref} style={item.payload.styles} className={css.loader} />
      );
    case "postcard":
      return url ? (
        <img className={css.postcardImage} src={url} alt={item.payload.label} />
      ) : (
        <span>Saved postcard</span>
      );
  }
}
