import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, Plus, AlertCircle } from "lucide-react";
import { Button, Card, CardContent, Spinner, EmptyState, Select, Table, THead, TBody, TR, TH, TD } from "@/components/ui";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { userService } from "@/features/users/services/userService";
import { InviteUserModal } from "./InviteUserModal";
import type { UserRole } from "@/services/supabase";

const ROLES: { value: UserRole; label: string }[] = [
  { value: "super_admin", label: "Super Admin" },
  { value: "internal", label: "Internal Team" },
  { value: "partner", label: "Partner" },
];

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function UsersPage() {
  const { user: me } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error } = useQuery({ queryKey: ["users"], queryFn: () => userService.list() });

  const [inviteOpen, setInviteOpen] = useState(false);
  const [actionError, setActionError] = useState("");

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["users"] });

  const guard = async (fn: () => Promise<unknown>, label: string) => {
    setActionError("");
    try {
      await fn();
      refresh();
    } catch (e) {
      setActionError(e instanceof Error ? `${label}: ${e.message}` : label);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="font-mono text-xs uppercase tracking-wider text-brass-600">Settings</p>
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="text-ink-500">Platform accounts and their roles (invite-only).</p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <Plus className="h-4 w-4" /> Invite user
        </Button>
      </header>

      {actionError && (
        <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {actionError}
        </div>
      )}

      {isLoading && (
        <Card>
          <CardContent className="flex items-center justify-center gap-3 py-16 text-ink-500">
            <Spinner /> Loading users…
          </CardContent>
        </Card>
      )}

      {isError && (
        <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          Couldn't load users. {error instanceof Error ? error.message : ""}
        </div>
      )}

      {!isLoading && !isError && (data ?? []).length === 0 && (
        <EmptyState icon={Users} title="No users yet" description="Invite your first teammate or partner." />
      )}

      {!isLoading && !isError && (data ?? []).length > 0 && (
        <Card className="overflow-hidden p-0">
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Email</TH>
                <TH>Role</TH>
                <TH>Status</TH>
                <TH>Last login</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {(data ?? []).map((u) => {
                const isSelf = u.id === me?.id;
                return (
                  <TR key={u.id}>
                    <TD className="font-medium text-ink-900">
                      {u.full_name}
                      {isSelf && <span className="ml-2 text-xs text-ink-400">(you)</span>}
                    </TD>
                    <TD className="text-ink-600">{u.email}</TD>
                    <TD>
                      {/* SuperAdmin cannot downgrade their own role (§2.4). */}
                      <Select
                        value={u.role}
                        disabled={isSelf}
                        onChange={(e) => guard(() => userService.updateRole(u.id, e.target.value as UserRole), "Couldn't change role")}
                        className="h-8 max-w-[150px]"
                      >
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </Select>
                    </TD>
                    <TD>
                      <span className={u.is_active ? "text-success" : "text-ink-400"}>
                        {u.is_active ? "Active" : "Inactive"}
                      </span>
                    </TD>
                    <TD className="whitespace-nowrap text-ink-600">{formatDate(u.last_login_at)}</TD>
                    <TD className="text-right">
                      {/* SuperAdmin cannot deactivate themselves (§2.4). */}
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isSelf}
                        onClick={() => guard(() => userService.setActive(u.id, !u.is_active), "Couldn't update status")}
                      >
                        {u.is_active ? "Deactivate" : "Reactivate"}
                      </Button>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </Card>
      )}

      <InviteUserModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvited={() => {
          setInviteOpen(false);
          void refresh();
        }}
      />
    </div>
  );
}
