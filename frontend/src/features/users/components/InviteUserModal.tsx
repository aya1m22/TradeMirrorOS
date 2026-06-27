import { useEffect, useState } from "react";
import { Button, Input, Modal, Select, Spinner } from "@/components/ui";
import { userService } from "@/features/users/services/userService";
import type { UserRole } from "@/services/supabase";

const ROLES: { value: UserRole; label: string }[] = [
  { value: "internal", label: "Internal Team" },
  { value: "partner", label: "Partner (read-only)" },
  { value: "super_admin", label: "Super Admin" },
];

/**
 * Invite a new user (PRD §2.2/§2.4). Sends to the `invite-user` Edge Function
 * which creates the auth account and emails the invitation via Resend. Until the
 * function's secrets are configured the call errors — surfaced inline.
 */
export function InviteUserModal({
  open,
  onClose,
  onInvited,
}: {
  open: boolean;
  onClose: () => void;
  onInvited: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("internal");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setFullName("");
      setEmail("");
      setRole("internal");
      setError("");
    }
  }, [open]);

  const submit = async () => {
    if (!fullName.trim() || !email.trim()) {
      setError("Name and email are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await userService.invite({ full_name: fullName.trim(), email: email.trim(), role });
      onInvited();
    } catch (e) {
      setError(
        e instanceof Error
          ? `Couldn't send the invite: ${e.message}`
          : "Couldn't send the invite. The invite-user Edge Function and its secrets (service-role + Resend) must be configured.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invite user"
      description="Creates an account and emails an invitation to set a password."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Spinner size="sm" /> : null} Send invite
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Select label="Role" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </Select>
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </Modal>
  );
}
