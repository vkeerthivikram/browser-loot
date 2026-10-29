import type { Specimen } from "../lib/model";
import { SpecimenView } from "./SpecimenView";
import css from "./app.module.css";
export function QuiltPatch({ items }: { items: Specimen[] }) {
  const colour = items.find((s) => s.kind === "colour"),
    corner = items.find((s) => s.kind === "corner"),
    shadow = items.find((s) => s.kind === "shadow"),
    favicon = items.find((s) => s.kind === "favicon");
  return (
    <div
      className={css.quiltPatch}
      style={{
        background:
          colour?.kind === "colour" ? colour.payload.value : "#dedfcf",
        borderRadius:
          corner?.kind === "corner" ? corner.payload.radii.join(" ") : "0",
        boxShadow: shadow?.kind === "shadow" ? shadow.payload.value : undefined,
      }}
    >
      {favicon ? (
        <SpecimenView item={favicon} />
      ) : (
        <span>
          {new URL(items[0].sourceOrigin).hostname.slice(0, 2).toUpperCase()}
        </span>
      )}
    </div>
  );
}
