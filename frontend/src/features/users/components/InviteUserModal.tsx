import { useEffect, useState } from "react";
import { Button, Input, Modal, Select, Spinner } from "@/components/ui";
import { userService, type InviteResult } from "@/features/users/services/userService";
import type { UserRole } from "@/services/supabase";

const ROLES: { value: UserRole; label: string }[] = [
  { value: "internal", label: "Internal Team" },
  { value: "partner", label: "Partner (read-only)" },
  { value: "super_admin", label: "Super Admin" },
];

/**
 * Invite a new user (PRD §2.2/§2.4). Sends to the `invite-user` Edge Function,
 * which saves a secure invitation record and emails the accept link via Brevo.
 * The account is created later, when the invitee accepts and sets a password.
 */
export function InviteUserModal({
  open,
  onClose,
  onInvited,
}: {
  open: boolean;
  onClose: () => void;
  /** Called after the account is created. `emailWarning`/`inviteLink` are set when
   *  the user was created but the invite email couldn't be sent (not a failure). */
  onInvited: (result: InviteResult) => void;
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
      const result = await userService.invite({
        full_name: fullName.trim(),
        email: email.trim(),
        role,
      });
      onInvited(result);
    } catch (e) {
      // userService already maps network + function errors to a clear message.
      setError(e instanceof Error ? e.message : "Couldn't send the invite. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invite user"
      description="Emails a secure link to set a password. The account is created when they accept."
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
