import { asset } from "./db";
import { titles, type Specimen } from "./model";
export function designCss(s: Specimen) {
  const declarations: Record<string, string> =
    s.kind === "colour"
      ? { background: s.payload.value }
      : s.kind === "shadow"
        ? { "box-shadow": s.payload.value }
        : s.kind === "corner"
          ? {
              "border-radius": s.payload.radii.join(" "),
              width: `${s.payload.width}px`,
              height: `${s.payload.height}px`,
            }
          : s.kind === "button" || s.kind === "typography"
            ? s.payload.styles
            : s.kind === "scrollbar"
              ? {
                  "scrollbar-color": s.payload.color,
                  "scrollbar-width": s.payload.width,
                }
              : {};
  return (
    Object.entries(declarations)
      .map(
        ([key, value]) =>
          `${key.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())}: ${value};`,
      )
      .join("\n") || JSON.stringify(s.payload, null, 2)
  );
}
export async function sheet(items: Specimen[], quilt: boolean) {
  if (!items.length) throw Error("Collect a few finds first.");
  const c = document.createElement("canvas");
  c.width = 1200;
  c.height = 180 + Math.ceil(items.length / 5) * 210;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#f6f2e9";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = "#292d26";
  ctx.font = "42px Georgia";
  ctx.fillText(
    quilt ? "Browser Loot · Website Quilt" : "Browser Loot · Little wonders",
    40,
    75,
  );
  for (const [i, s] of items.entries()) {
    const x = 40 + (i % 5) * 230,
      y = 130 + Math.floor(i / 5) * 210;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, 200, 150);
    ctx.clip();
    ctx.fillStyle = "#e4e3d4";
    ctx.fillRect(x, y, 200, 150);
    if (s.kind === "colour") {
      const colours = s.payload.value.match(
        /#[a-f\d]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|oklch\([^)]*\)/gi,
      );
      if (
        s.payload.value.includes("gradient(") &&
        colours &&
        colours.length > 1
      ) {
        const gradient = ctx.createLinearGradient(x, y, x + 200, y + 150);
        colours.forEach((v, j) => {
          try {
            gradient.addColorStop(j / (colours.length - 1), v);
          } catch {}
        });
        ctx.fillStyle = gradient;
      } else ctx.fillStyle = s.payload.value;
      ctx.fillRect(x, y, 200, 150);
    }
    if (s.kind === "shadow") {
      ctx.shadowColor = "#292d2666";
      ctx.shadowBlur = 20;
      ctx.shadowOffsetY = 10;
      ctx.fillStyle = "#f6f2e9";
      ctx.fillRect(x + 45, y + 35, 110, 80);
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    }
    if (s.kind === "corner") {
      ctx.fillStyle = "#426447";
      ctx.beginPath();
      ctx.roundRect(
        x + 30,
        y + 20,
        140,
        110,
        s.payload.radii.map((v) =>
          Math.min(55, parseFloat(v) * (v.includes("%") ? 1.1 : 1) || 0),
        ),
      );
      ctx.fill();
    }
    if (s.kind === "button") {
      ctx.fillStyle = s.payload.styles.backgroundColor || "#426447";
      ctx.beginPath();
      ctx.roundRect(
        x + 25,
        y + 45,
        150,
        55,
        Math.min(27, parseFloat(s.payload.styles.borderRadius || "4")),
      );
      ctx.fill();
      ctx.fillStyle = s.payload.styles.color || "#fff";
      ctx.font = "20px Georgia";
      ctx.fillText("Button", x + 65, y + 80);
    }
    if (s.kind === "typography") {
      ctx.fillStyle = s.payload.styles.color || "#292d26";
      ctx.font = `${s.payload.styles.fontWeight || 400} 64px ${s.payload.styles.fontFamily || "serif"}`;
      ctx.fillText("Aa", x + 50, y + 100, 160);
    }
    if (s.kind === "favicon") {
      ctx.fillStyle = "#c59150";
      ctx.beginPath();
      ctx.arc(x + 100, y + 65, 40, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#292d26";
      ctx.font = "24px Georgia";
      ctx.fillText(s.payload.monogram, x + 82, y + 74);
    }
    if (s.assetId) {
      const blob = await asset(s.assetId);
      if (blob) {
        const bitmap = await createImageBitmap(blob);
        const ratio = Math.min(180 / bitmap.width, 130 / bitmap.height);
        ctx.drawImage(
          bitmap,
          x + 100 - (bitmap.width * ratio) / 2,
          y + 75 - (bitmap.height * ratio) / 2,
          bitmap.width * ratio,
          bitmap.height * ratio,
        );
        bitmap.close();
      }
    }
    if (s.kind === "scrollbar") {
      ctx.fillStyle = "#7c8a68";
      ctx.fillRect(x + 165, y + 15, 8, 120);
      ctx.fillStyle = "#426447";
      ctx.fillRect(x + 165, y + 30, 8, 40);
    }
    if (s.kind === "loader") {
      ctx.strokeStyle = s.payload.styles.borderColor || "#426447";
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(x + 100, y + 75, 30, 0, Math.PI * 1.6);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = "#292d26";
    ctx.font = "15px Georgia";
    ctx.fillText(titles[s.kind], x, y + 174, 200);
  }
  return new Promise<Blob>((resolve, reject) =>
    c.toBlob(
      (b) => (b ? resolve(b) : reject(Error("PNG export failed."))),
      "image/png",
    ),
  );
}
