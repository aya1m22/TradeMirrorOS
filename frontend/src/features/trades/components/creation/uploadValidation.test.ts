import { describe, it, expect } from "vitest";
import { validateContractFile, MAX_PDF_BYTES } from "./uploadValidation";

// Minimal File stand-in (Node's File lacks easy size control across versions).
function fakeFile(name: string, type: string, size: number): File {
  return { name, type, size } as File;
}

describe("validateContractFile", () => {
  it("accepts a normal PDF by mime type", () => {
    expect(validateContractFile(fakeFile("c.pdf", "application/pdf", 1000)).ok).toBe(true);
  });

  it("accepts a PDF by extension when mime is empty", () => {
    expect(validateContractFile(fakeFile("CONTRACT.PDF", "", 1000)).ok).toBe(true);
  });

  it("rejects a non-PDF", () => {
    const r = validateContractFile(fakeFile("photo.png", "image/png", 1000));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/PDF/);
  });

  it("rejects an empty file", () => {
    expect(validateContractFile(fakeFile("c.pdf", "application/pdf", 0)).ok).toBe(false);
  });

  it("rejects a file over the size limit", () => {
    const r = validateContractFile(fakeFile("big.pdf", "application/pdf", MAX_PDF_BYTES + 1));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/20 MB/);
  });
});
