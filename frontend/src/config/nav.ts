import {
  LayoutDashboard,
  FileText,
  Building2,
  Contact,
  Landmark,
  Users,
  FileSpreadsheet,
  type LucideIcon,
} from "lucide-react";
import { ROUTES } from "./routes";
import type { UserRole } from "@/services/supabase";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Grouping header this item sits under in the sidebar. */
  group: "Operations" | "Settings";
  /** Roles allowed to see this destination (PRD §3.4 permission matrix). */
  roles: UserRole[];
}

/**
 * Sidebar navigation. Filtered by the signed-in user's role per the §3.4 matrix.
 * Partner has no main-nav destinations — they land on the Partner Dashboard.
 */
export const NAV_ITEMS: NavItem[] = [
  { label: "Overview", to: ROUTES.overview, icon: LayoutDashboard, group: "Operations", roles: ["super_admin", "internal"] },
  { label: "Trades", to: ROUTES.trades, icon: FileText, group: "Operations", roles: ["super_admin", "internal"] },
  { label: "Clients", to: ROUTES.clients, icon: Building2, group: "Operations", roles: ["super_admin", "internal"] },
  { label: "Contacts", to: ROUTES.contacts, icon: Contact, group: "Operations", roles: ["super_admin"] },
  { label: "Entities & Banking", to: ROUTES.entities, icon: Landmark, group: "Settings", roles: ["super_admin"] },
  { label: "Tax Readiness", to: ROUTES.taxReadiness, icon: FileSpreadsheet, group: "Settings", roles: ["super_admin"] },
  { label: "Users", to: ROUTES.users, icon: Users, group: "Settings", roles: ["super_admin"] },
];

/** Nav items visible to a given role (null role → none). */
export function navItemsForRole(role: UserRole | null): NavItem[] {
  if (!role) return [];
  return NAV_ITEMS.filter((i) => i.roles.includes(role));
}
