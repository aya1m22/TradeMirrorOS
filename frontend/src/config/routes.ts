/**
 * Central route path constants. Importing from here keeps links and the
 * router in sync as feature routes come online in later steps.
 */
export const ROUTES = {
  overview: "/",
  trades: "/trades",
  tradeNew: "/trades/new",
  tradeDetail: "/trades/:id",
  clients: "/clients",
  contacts: "/contacts",
  entities: "/settings/entities",
  users: "/settings/users",
  taxReadiness: "/settings/tax-readiness",
  partner: "/partner",
  login: "/login",
  forgotPassword: "/forgot-password",
  acceptInvite: "/accept-invite",
  resetPassword: "/reset-password",
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];

/** Link to a specific Trade Folder. */
export const tradeDetailPath = (id: string) => `/trades/${id}`;
