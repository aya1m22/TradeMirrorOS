import { useMemo, useState } from "react";
import { computeFinancials, round2, type ContractFinancials } from "@/core/domain/finance";
import type { MirroredContract, Party } from "@/core/mirroring";

type PartyKey = "seller" | "buyer";
type PartyField = keyof Party;

/**
 * Holds the editable mirrored contract and recomputes every dependent figure on
 * each change. Margin and sale price stay in sync: editing margin sets the sale
 * price (supplier + margin); editing the sale price back-solves the margin.
 */
export function useCompanyContract(initial: MirroredContract) {
  const [contract, setContract] = useState<MirroredContract>(initial);

  const financials: ContractFinancials = useMemo(
    () =>
      computeFinancials({
        quantity: contract.quantity,
        supplierUnitPrice: contract.supplierUnitPrice,
        saleUnitPrice: contract.saleUnitPrice,
        shippingCost: contract.shippingCost,
        insuranceCost: contract.insuranceCost,
        bankFees: contract.bankFees,
      }),
    [contract],
  );

  const setParty = (key: PartyKey, field: PartyField, value: string) =>
    setContract((c) => ({ ...c, [key]: { ...c[key], [field]: value } }));

  const setMargin = (margin: number) =>
    setContract((c) => ({
      ...c,
      marginPerUnit: margin,
      saleUnitPrice: round2(c.supplierUnitPrice + margin),
    }));

  const setSaleUnitPrice = (price: number) =>
    setContract((c) => ({
      ...c,
      saleUnitPrice: price,
      marginPerUnit: round2(price - c.supplierUnitPrice),
    }));

  const setNumber = (field: "shippingCost" | "insuranceCost" | "bankFees", value: number) =>
    setContract((c) => ({ ...c, [field]: value }));

  const setText = (field: "paymentTerms" | "currency", value: string) =>
    setContract((c) => ({ ...c, [field]: value }));

  // Cargo overrides (normally pure-mirror; only changed via the unlock action).
  const setCargoText = (
    field: "commodity" | "quality" | "incoterm" | "deliveryTerms" | "quantityUnit",
    value: string,
  ) => setContract((c) => ({ ...c, [field]: value }));

  const setQuantity = (value: number) =>
    setContract((c) => ({ ...c, quantity: value }));

  return {
    contract,
    financials,
    setParty,
    setMargin,
    setSaleUnitPrice,
    setNumber,
    setText,
    setCargoText,
    setQuantity,
  };
}
