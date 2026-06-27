import { describe, it, expect } from "vitest";
import { createZip, crc32 } from "./zip";

const enc = (s: string) => new TextEncoder().encode(s);

describe("zip writer", () => {
  it("computes the standard CRC-32", () => {
    expect(crc32(enc("hello")).toString(16)).toBe("3610a686");
    expect(crc32(enc("")).toString(16)).toBe("0");
  });

  it("produces a valid ZIP container", () => {
    const zip = createZip([
      { name: "a.txt", data: enc("hello") },
      { name: "b.txt", data: enc("world!") },
    ]);
    // Local file header signature "PK\x03\x04"
    expect(Array.from(zip.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    // End-of-central-directory signature "PK\x05\x06" in the last 22 bytes
    const end = zip.slice(zip.length - 22);
    expect(Array.from(end.slice(0, 4))).toEqual([0x50, 0x4b, 0x05, 0x06]);
    // Entry count = 2 (offset 10 in EOCD)
    expect(new DataView(end.buffer, end.byteOffset).getUint16(10, true)).toBe(2);
    // Filenames embedded
    const text = new TextDecoder("latin1").decode(zip);
    expect(text).toContain("a.txt");
    expect(text).toContain("b.txt");
  });
});
