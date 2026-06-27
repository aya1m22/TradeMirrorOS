/**
 * Phase-1 defaults — the active entity, its banking profile, and the default
 * contact, as client-side constants that mirror `supabase/seed.sql`.
 *
 * The trade-creation pickers (entity / bank / contact selection) are deferred,
 * so these stand in. The active entity is Chipa Tech E.A.S. (the operational
 * toggle for Phase 1). Editable in the contract editor.
 */
import type { OverlayBank, OverlayContact, OverlayParty } from "@/core/pdf-engine/coordinate-map/contract701-2026";

/** Active entity = Chipa Tech E.A.S. (seed id 1111…). Becomes the exporter/seller. */
export const ACTIVE_ENTITY: OverlayParty = {
  name: "Chipa Tech E.A.S.",
  taxId: "", // RUC pending in the source data
  address: "Calle Dr. Eusebio Lilio y Bernardino Caballero #2880",
  city: "Asuncion",
  country: "Paraguay",
};

/** Active banking profile (seed id 3333…, belongs to the E.A.S. entity). */
export const ACTIVE_BANK: OverlayBank = {
  intermediaryBankName: "CITIBANK NA",
  intermediaryBankSwift: "CITIUS33",
  bankName: "BANCO NACIONAL DE FOMENTO",
  bankSwift: "BNFAPYPAXXX",
  accountNumber: "000000000000",
  araNumber: "",
  beneficiaryName: "Chipa Tech E.A.S.",
  beneficiaryAddress: "Asuncion, Paraguay",
};

/** Default contact (seed id 5555…). */
export const DEFAULT_CONTACT: OverlayContact = {
  name: "Ali Kanso",
  phone: "+20 1017299515",
  email: "ali@chipafarm.com",
};

/** Default balance condition text on the 701-2026 template. */
export const DEFAULT_BALANCE_TEXT = "50% TT AGAINST COPY OF BL BY EMAIL";

// ── Selectable Phase-1 catalogs ─────────────────────────────────────────────
// The trade-creation pickers source from these client-side lists (mirroring the
// seed) until the entity/bank/contact CMS modules exist. The ids match
// supabase/seed.sql so persistence FKs resolve.

export interface EntityOption {
  id: string;
  name: string;
  party: OverlayParty;
}
export interface BankOption {
  id: string;
  entityId: string;
  label: string;
  bank: OverlayBank;
}
export interface ContactOption {
  id: string;
  label: string;
  contact: OverlayContact;
}

export const ENTITIES: EntityOption[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Chipa Tech E.A.S.",
    party: ACTIVE_ENTITY,
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    name: "Chipa Farm LLC",
    party: {
      name: "Chipa Farm LLC",
      taxId: "",
      address: "—",
      city: "—",
      country: "USA (Wyoming)",
    },
  },
];

export const BANK_PROFILES: BankOption[] = [
  {
    id: "33333333-3333-3333-3333-333333333333",
    entityId: "11111111-1111-1111-1111-111111111111",
    label: "EAS — Banco Nacional de Fomento",
    bank: ACTIVE_BANK,
  },
];

export const CONTACTS: ContactOption[] = [
  {
    id: "55555555-5555-5555-5555-555555555555",
    label: "Ali Kanso — Trade Desk",
    contact: DEFAULT_CONTACT,
  },
];

/** The Phase-1 active entity id (Chipa Tech E.A.S.). */
export const ACTIVE_ENTITY_ID = ENTITIES[0].id;

/**
 * A baseline client (mirrors seed id 4444…) so the client selector always has a
 * selectable option and preview/download work offline before the DB is reachable.
 * Shaped like a `clients` row (sans created_at/notes).
 */
export const PHASE1_DEFAULT_CLIENT = {
  id: "44444444-4444-4444-4444-444444444444",
  company_name: "Al Manara Trading LLC",
  address: "14 Corniche Road",
  city: "Alexandria",
  country: "Egypt",
  tax_id: "EG-000000000",
  contact_name: "Mohamed Said",
  contact_email: "buyer@almanara.example",
  contact_phone: "+20 100 000 0000",
};
