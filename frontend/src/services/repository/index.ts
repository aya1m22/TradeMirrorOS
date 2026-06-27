/**
 * Data-access seam.
 *
 * Re-exports the repository contracts and the concrete implementations the app
 * uses. Today these resolve to the Supabase-backed services. When the mock
 * layer lands (VITE_USE_MOCKS, a later step), this is the single place that
 * chooses mock vs. real — callers keep importing from here unchanged.
 */
export type {
  AuthRepository,
  ClientRepository,
  TradeRepository,
  DocumentRepository,
  CrudRepository,
  ReadRepository,
  WriteRepository,
} from "./contracts";

export { authService } from "@/features/auth/services/authService";
export { clientService } from "@/features/clients/services/clientService";
export { tradeService } from "@/features/trades/services/tradeService";
export { documentService } from "@/features/trades/services/documentService";

// Placeholder: mock implementations are wired here in the mock-data step.
// e.g. export const clientRepository = isMockMode ? mockClientService : clientService;
