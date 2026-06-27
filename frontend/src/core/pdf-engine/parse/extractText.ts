/**
 * Browser PDF → raw text.
 *
 * pdf-parse is a thin Node wrapper over pdfjs that builds text by grouping
 * runs on the same Y-position and inserting a newline when Y changes. We can't
 * run pdf-parse (Node-only) in the browser, so this reproduces that exact
 * algorithm directly on pdfjs — yielding text identical to pdf-parse's, so the
 * same parser works in both environments. (Production may instead run pdf-parse
 * itself inside the planned parse-contract Edge Function.)
 *
 * pdfjs is loaded lazily so it (and its worker) stay out of the main bundle and
 * only download when a contract is actually uploaded.
 */
interface TextItemLike {
  str?: string;
  transform?: number[];
}

let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

async function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import("pdfjs-dist");
      const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      return pdfjs;
    })();
  }
  return pdfjsPromise;
}

export async function extractPdfText(data: ArrayBuffer): Promise<string> {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  let out = "";

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    let lastY: number | undefined;
    for (const item of content.items as TextItemLike[]) {
      const y = item.transform?.[5];
      const str = item.str ?? "";
      if (lastY === undefined || lastY === y) out += str;
      else out += "\n" + str;
      lastY = y;
    }
    out += "\n";
  }

  await doc.cleanup();
  return out;
}
