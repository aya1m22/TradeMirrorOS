import { parseLatinNumber, round2 } from "@/core/domain/finance";
import type { MirroredContract, Party, ReviewedValues } from "./types";

/** Default company seller — the Phase-1 active entity, Chipa Tech E.A.S. Editable in the form. */
export const DEFAULT_COMPANY_SELLER: Party = {
  name: "Chipa Tech E.A.S.",
  address: "Calle Dr. Eusebio Lilio y Bernardino Caballero #2880",
  city: "Asuncion",
  country: "Paraguay",
  taxId: "",
};

const EMPTY_BUYER: Party = { name: "", address: "", city: "", country: "", taxId: "" };

export interface MirrorInput {
  reviewed: ReviewedValues;
  /** Company acting as seller; defaults to Chipa Farm LLC. */
  seller?: Party;
  /** End customer; starts empty for the operator to fill. */
  buyer?: Party;
  /** Per-unit markup applied to the supplier price. */
  marginPerUnit?: number;
  currency?: string;
}

/**
 * Mirror a reviewed supplier contract into a company Sales Contract:
 *   - supplier → replaced by the company as seller
 *   - customer → buyer (operator-entered)
 *   - commodity / quantity / quality / Incoterm / delivery terms → preserved
 *   - sale price = supplier price + margin (editable downstream)
 */
export function buildMirroredContract(input: MirrorInput): MirroredContract {
  const { reviewed } = input;
  const margin = input.marginPerUnit ?? 0;
  const supplierUnitPrice = parseLatinNumber(reviewed.unitPrice);
  const quantity = parseLatinNumber(reviewed.quantity);

  return {
    seller: input.seller ?? DEFAULT_COMPANY_SELLER,
    buyer: input.buyer ?? EMPTY_BUYER,

    // Preserved back-to-back, verbatim from the reviewed extraction.
    commodity: reviewed.commodity ?? "",
    quantity,
    quantityUnit: reviewed.quantityUnit || "Ton",
    quality: reviewed.quality ?? "",
    incoterm: reviewed.incoterm ?? "",
    deliveryTerms: reviewed.deliveryTerms ?? "",

    // Company pricing.
    currency: input.currency ?? "USD",
    supplierUnitPrice,
    marginPerUnit: margin,
    saleUnitPrice: round2(supplierUnitPrice + margin),
    shippingCost: 0,
    insuranceCost: 0,
    bankFees: 0,
    paymentTerms: reviewed.paymentTerms ?? "",

    frigoContractRef: reviewed.contractNumber ?? "",
    issueDate: reviewed.issueDate ?? "",
  };
}
