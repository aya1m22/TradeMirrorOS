import { useCallback, useRef, useState } from "react";
import { extractPdfText, parseFrigoContract, type ExtractionResult } from "@/core/pdf-engine/parse";
import { storageService } from "@/services/storage/storageService";
import { validateContractFile } from "@/features/trades/components/creation/uploadValidation";

export type ExtractionStatus =
  | "empty"
  | "extracting"
  | "extract_error"
  | "review";

export interface ContractExtractionState {
  status: ExtractionStatus;
  fileName: string | null;
  /** The uploaded PDF — overlaid by the company contract generator downstream. */
  originalFile: File | null;
  result: ExtractionResult | null;
  /** Inline validation message shown on the dropzone. */
  validationError: string;
  /** Hard error for the extract error state. */
  error: string;
  /** Non-blocking notice when the original couldn't be saved to storage. */
  storageWarning: string;
  storagePath: string | null;
}

const initial: ContractExtractionState = {
  status: "empty",
  fileName: null,
  originalFile: null,
  result: null,
  validationError: "",
  error: "",
  storageWarning: "",
  storagePath: null,
};

/**
 * Orchestrates the upload → extract → review flow:
 *   validate → (best-effort) save original to storage → extract text → structure.
 *
 * Saving the original to Storage is best-effort and never blocks: if the backend
 * isn't reachable (Phase 1 may run with no session), extraction proceeds anyway
 * and a small warning is shown. A total extraction failure drops into manual
 * entry while preserving whatever was found.
 */
export function useContractExtraction() {
  const [state, setState] = useState<ContractExtractionState>(initial);
  const fileRef = useRef<File | null>(null);
  const patch = (p: Partial<ContractExtractionState>) => setState((s) => ({ ...s, ...p }));

  const runExtraction = useCallback(async (file: File) => {
    patch({ status: "extracting", error: "" });
    try {
      const text = await extractPdfText(await file.arrayBuffer());
      if (!text || text.trim().length < 20) {
        throw new Error("No selectable text found in this PDF.");
      }
      patch({ status: "review", result: parseFrigoContract(text) });
    } catch (e) {
      patch({
        status: "extract_error",
        error: e instanceof Error ? e.message : "Extraction failed.",
      });
    }
  }, []);

  const selectFile = useCallback(
    async (file: File) => {
      const check = validateContractFile(file);
      if (!check.ok) {
        patch({ status: "empty", validationError: check.error, fileName: null, originalFile: null });
        return;
      }
      fileRef.current = file;
      patch({
        status: "extracting",
        fileName: file.name,
        originalFile: file,
        validationError: "",
        error: "",
        storageWarning: "",
      });

      // Best-effort: persist the original in the background. Never blocks extraction.
      void storageService
        .uploadOriginalContract(file)
        .then((uploaded) => patch({ storagePath: uploaded.path }))
        .catch(() =>
          patch({
            storageWarning:
              "Original not saved to storage (backend not reachable) — continuing with extraction.",
          }),
        );

      await runExtraction(file);
    },
    [runExtraction],
  );

  /** Drop into manual entry with an empty, fully-flagged structure. */
  const startManualEntry = useCallback(() => {
    patch({ status: "review", result: parseFrigoContract("") });
  }, []);

  const reset = useCallback(() => {
    fileRef.current = null;
    setState(initial);
  }, []);

  return {
    state,
    selectFile,
    startManualEntry,
    reset,
  };
}
