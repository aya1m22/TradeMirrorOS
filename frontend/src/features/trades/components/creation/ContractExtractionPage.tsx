import { FileText, Loader2 } from "lucide-react";
import type { ExtractedFieldKey } from "@/core/pdf-engine/parse";
import { Button, Card, CardContent, Spinner } from "@/components/ui";
import { useContractExtraction } from "@/features/trades/hooks/useContractExtraction";
import { ContractDropzone } from "./ContractDropzone";
import { ExtractionReview } from "./ExtractionReview";

export interface ConfirmedExtraction {
  values: Record<ExtractedFieldKey, string>;
  /** The uploaded PDF to overlay (null when entered manually). */
  originalFile: File | null;
}

/**
 * The upload → extract → review half of the workflow: upload a supplier
 * contract, extract its fields, and review them. On confirm, the reviewed values
 * and the original PDF are handed to the parent to build the company contract.
 */
export function ContractExtractionPage({
  onConfirmed,
}: {
  onConfirmed: (result: ConfirmedExtraction) => void;
}) {
  const { state, selectFile, startManualEntry, reset } = useContractExtraction();

  if (state.status === "review" && state.result) {
    return (
      <ExtractionReview
        result={state.result}
        manual={state.result.summary.extracted === 0}
        onBack={reset}
        onConfirm={(values) => onConfirmed({ values, originalFile: state.originalFile })}
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-wider text-brass-600">
          New trade · Step 1
        </p>
        <h1 className="text-2xl font-semibold">Upload supplier contract</h1>
        <p className="text-ink-500">
          Start from the Frigorífico Concepción PDF. We read it and pre-fill the contract
          for you to check.
        </p>
      </header>

      {state.status === "empty" && (
        <ContractDropzone onFile={selectFile} validationError={state.validationError} />
      )}

      {state.status === "extracting" && (
        <StatusCard
          icon={<Spinner size="lg" />}
          title="Reading the contract…"
          body="Extracting fields from the PDF text."
        />
      )}

      {state.status === "extract_error" && (
        <StatusCard
          icon={<FileText className="h-8 w-8 text-warning" />}
          title="Couldn't read this PDF"
          body={`${state.error} You can enter the details manually instead.`}
        >
          <div className="flex flex-wrap gap-2">
            <Button onClick={startManualEntry}>Enter manually</Button>
            <Button variant="ghost" onClick={reset}>
              Choose another file
            </Button>
          </div>
        </StatusCard>
      )}

      {state.storageWarning && (
        <p className="flex items-center gap-2 text-xs text-ink-500">
          <Loader2 className="h-3.5 w-3.5" />
          {state.storageWarning}
        </p>
      )}
    </div>
  );
}

function StatusCard({
  icon,
  title,
  body,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        {icon}
        <h2 className="text-lg font-semibold text-ink-900">{title}</h2>
        <p className="max-w-md text-sm text-ink-500">{body}</p>
        {children && <div className="mt-3">{children}</div>}
      </CardContent>
    </Card>
  );
}
