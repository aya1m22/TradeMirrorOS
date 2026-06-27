/**
 * Validation for the contract upload. Pure and testable — the page calls this
 * before doing any work with a dropped or picked file.
 */

export const MAX_PDF_BYTES = 20 * 1024 * 1024; // 20 MB

export interface FileValidation {
  ok: boolean;
  /** User-facing reason when invalid; empty when ok. */
  error: string;
}

export function validateContractFile(file: File): FileValidation {
  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) {
    return { ok: false, error: "That isn't a PDF. Upload the supplier contract as a PDF." };
  }
  if (file.size === 0) {
    return { ok: false, error: "This file is empty. Choose the contract PDF and try again." };
  }
  if (file.size > MAX_PDF_BYTES) {
    return { ok: false, error: "This PDF is over 20 MB. Upload a smaller file." };
  }
  return { ok: true, error: "" };
}
