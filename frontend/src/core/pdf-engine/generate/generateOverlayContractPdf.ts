/**
 * Overlay generator — the Phase-1 mirroring engine.
 *
 * Loads the original supplier PDF (the uploaded 701-2026), paints white blocks
 * over the WHITE-BLOCK fields, and draws the mirrored values in their place at
 * the coordinates measured in `coordinate-map/contract701-2026.ts`. Every
 * PURE-MIRROR field is left exactly as it was on the source document.
 *
 * Deterministic and dependency-light (pdf-lib only), so it renders identically
 * in the browser and in tests.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { buildOverlayOps, type OverlayData } from "@/core/pdf-engine/coordinate-map/contract701-2026";

const WHITE = rgb(1, 1, 1);
const INK = rgb(0.06, 0.06, 0.06);

/** Replace characters Helvetica's WinAnsi encoding can't render (º, smart quotes…). */
function sanitize(text: string): string {
  return (text || "")
    .replace(/[‘’′]/g, "'")
    .replace(/[“”″]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/º/g, "o")
    .replace(/[^\x00-\xFF]/g, "?");
}

/**
 * Produce the mirrored Sales Contract by overlaying `data` onto `originalBytes`
 * (the uploaded 701-2026 PDF).
 */
export async function generateOverlayContractPdf(
  originalBytes: ArrayBuffer | Uint8Array,
  data: OverlayData,
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(originalBytes);
  const page = doc.getPage(0);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  for (const op of buildOverlayOps(data)) {
    // 1. White out the original text.
    page.drawRectangle({
      x: op.rect.x,
      y: op.rect.y,
      width: op.rect.w,
      height: op.rect.h,
      color: WHITE,
    });

    // 2. Inject the new value (skip if empty — the block already cleared it).
    const value = sanitize(op.value);
    if (!value.trim()) continue;

    const f: PDFFont = op.bold ? bold : font;
    const fitted = fit(value, f, op.size, op.rect.w);
    const width = f.widthOfTextAtSize(fitted, op.size);
    let x = op.x;
    if (op.align === "right") x = op.x - width;
    else if (op.align === "center") x = op.x - width / 2;

    page.drawText(fitted, { x, y: op.y, size: op.size, font: f, color: INK });
  }

  return doc.save();
}

/** Truncate with an ellipsis if a value is wider than its white block. */
function fit(value: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(value, size) <= maxWidth) return value;
  let s = value;
  while (s.length > 1 && font.widthOfTextAtSize(s + "…", size) > maxWidth) {
    s = s.slice(0, -1);
  }
  return s + "…";
}
