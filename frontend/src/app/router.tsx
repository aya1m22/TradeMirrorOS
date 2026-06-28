import { Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { OverviewPage } from "./routes/OverviewPage";
import { NewTradeWorkflow } from "@/features/trades/components/creation/NewTradeWorkflow";
import { TradeListPage } from "@/features/trades/components/list/TradeListPage";
import { TradeFolderPage } from "@/features/trades/components/detail/TradeFolderPage";
import { ClientListPage } from "@/features/clients/components/ClientListPage";
import { ContactListPage } from "@/features/contacts/components/ContactListPage";
import { EntitiesPage } from "@/features/entities/components/EntitiesPage";
import { UsersPage } from "@/features/users/components/UsersPage";
import { TaxReadinessPage } from "@/features/exports/components/TaxReadinessPage";
import { PartnerDashboard } from "@/features/partner/components/PartnerDashboard";
import { LoginPage } from "@/features/auth/components/LoginPage";
import { ForgotPasswordPage } from "@/features/auth/components/ForgotPasswordPage";
import { AcceptInvitePage } from "@/features/auth/components/AcceptInvitePage";
import { ResetPasswordPage } from "@/features/auth/components/ResetPasswordPage";
import { RequireAuth, RequireRole } from "@/features/auth/components/ProtectedRoute";
import { ROUTES } from "@/config/routes";

/**
 * Route table with auth + role gating (PRD §2/§3).
 * - Public: /login, /forgot-password.
 * - Authenticated: everything else (RequireAuth).
 * - Partner: their dashboard only (no app shell).
 * - super_admin + internal: the app shell; SuperAdmin-only sections gated further.
 */
export function AppRouter() {
  return (
    <Routes>
      {/* Public */}
      <Route path={ROUTES.login} element={<LoginPage />} />
      <Route path={ROUTES.forgotPassword} element={<ForgotPasswordPage />} />
      <Route path={ROUTES.acceptInvite} element={<AcceptInvitePage />} />
      <Route path={ROUTES.resetPassword} element={<ResetPasswordPage />} />

      <Route element={<RequireAuth />}>
        {/* Partner-only dashboard (no main navigation) */}
        <Route element={<RequireRole roles={["partner"]} fallback={ROUTES.overview} />}>
          <Route path={ROUTES.partner} element={<PartnerDashboard />} />
        </Route>

        {/* App shell for super_admin + internal */}
        <Route element={<RequireRole roles={["super_admin", "internal"]} fallback={ROUTES.partner} />}>
          <Route element={<AppLayout />}>
            <Route path={ROUTES.overview} element={<OverviewPage />} />
            <Route path={ROUTES.trades} element={<TradeListPage />} />
            <Route path={ROUTES.tradeDetail} element={<TradeFolderPage />} />
            {/* Internal has view-only access (mutations gated inside the page). */}
            <Route path={ROUTES.clients} element={<ClientListPage />} />

            {/* SuperAdmin only (contract generation + settings) */}
            <Route element={<RequireRole roles={["super_admin"]} fallback={ROUTES.overview} />}>
              <Route path={ROUTES.tradeNew} element={<NewTradeWorkflow />} />
              <Route path={ROUTES.contacts} element={<ContactListPage />} />
              <Route path={ROUTES.entities} element={<EntitiesPage />} />
              <Route path={ROUTES.taxReadiness} element={<TaxReadinessPage />} />
              <Route path={ROUTES.users} element={<UsersPage />} />
            </Route>
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to={ROUTES.overview} replace />} />
    </Routes>
  );
}
