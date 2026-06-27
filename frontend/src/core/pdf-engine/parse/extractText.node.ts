// @ts-nocheck
/**
 * Node PDF → raw text using pdf-parse (PRD §7.1). Used by the extraction test
 * suite to validate the parser against genuine pdf-parse output, and available
 * for a server-side / Edge-Function extraction path. Not bundled into the app.
 */
import pdf from "pdf-parse/lib/pdf-parse.js";

export async function extractPdfTextNode(data: Buffer): Promise<string> {
  const result = await pdf(data);
  return result.text;
}
