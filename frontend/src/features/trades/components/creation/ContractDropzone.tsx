import { useRef, useState, type DragEvent } from "react";
import { UploadCloud, FileText, AlertCircle } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Empty-state dropzone: drag-and-drop plus a file picker. Validation and the
 * actual work happen in the parent hook; this just surfaces the chosen file
 * and any inline validation message.
 */
export function ContractDropzone({
  onFile,
  validationError,
}: {
  onFile: (file: File) => void;
  validationError: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-16 text-center transition-colors duration-150",
          dragging
            ? "border-brand-500 bg-brand-50"
            : validationError
              ? "border-danger/50 bg-danger/5"
              : "border-border bg-surface-2 hover:border-brand-300",
        )}
      >
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          {dragging ? <FileText className="h-7 w-7" /> : <UploadCloud className="h-7 w-7" />}
        </div>
        <h2 className="text-lg font-semibold text-ink-900">
          Drop the supplier contract here
        </h2>
        <p className="mt-1 text-sm text-ink-500">
          PDF only, up to 20&nbsp;MB. We extract the fields for you to review.
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-5 inline-flex h-10 items-center rounded bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-2"
        >
          Choose a PDF
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            e.target.value = "";
          }}
        />
      </div>
      {validationError && (
        <p className="flex items-center gap-2 text-sm text-danger">
          <AlertCircle className="h-4 w-4" />
          {validationError}
        </p>
      )}
    </div>
  );
}
