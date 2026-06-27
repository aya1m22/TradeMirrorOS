import { useState } from "react";
import { CompanyContractEditor } from "@/features/contract-editor/components/CompanyContractEditor";
import { ContractExtractionPage, type ConfirmedExtraction } from "./ContractExtractionPage";

/**
 * The full new-trade workflow:
 *   upload → extract → review  →  mirror → company contract → generate/save.
 * Holds the reviewed values + original PDF between the two phases.
 */
export function NewTradeWorkflow() {
  const [confirmed, setConfirmed] = useState<ConfirmedExtraction | null>(null);

  if (confirmed) {
    return (
      <CompanyContractEditor
        reviewed={confirmed.values}
        originalFile={confirmed.originalFile}
        onBack={() => setConfirmed(null)}
      />
    );
  }
  return <ContractExtractionPage onConfirmed={setConfirmed} />;
}
