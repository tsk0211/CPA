"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usersApi } from "@/lib/api/users";
import { rolesApi } from "@/lib/api/roles";
import type { Role, TeamMember } from "@/types";

export function ChangeRoleDialog({
  open,
  onOpenChange,
  member,
  canAssignAdmin,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TeamMember | null;
  // Owner-only. "owner" itself is never offered here — it's not a Role
  // document, and it can't be assigned, transferred, or changed via any
  // UI or API (see server/src/routes/users.ts's PATCH /:id/role).
  canAssignAdmin: boolean;
  onSaved: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Keyed on open+id so the form's local state is freshly initialized
            from `member` every time the dialog opens, instead of syncing it
            via an effect. */}
        <ChangeRoleDialogForm
          key={open ? (member?.id ?? "none") : "idle"}
          member={member}
          canAssignAdmin={canAssignAdmin}
          onOpenChange={onOpenChange}
          onSaved={onSaved}
        />
      </DialogContent>
    </Dialog>
  );
}

function ChangeRoleDialogForm({
  member,
  canAssignAdmin,
  onOpenChange,
  onSaved,
}: {
  member: TeamMember | null;
  canAssignAdmin: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [role, setRole] = useState<Role | undefined>(member?.role);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rolesQuery = useQuery({ queryKey: ["roles"], queryFn: () => rolesApi.list() });
  const roleOptions = [...(rolesQuery.data ?? []).map((r) => ({ id: r.id, name: r.name })), ...(canAssignAdmin ? [{ id: "admin", name: "Admin" }] : [])];

  async function submit() {
    if (!member || !role) return;
    setSubmitting(true);
    setError(null);
    try {
      await usersApi.changeRole(member.id, role);
      toast.success("Role updated.");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Change role</DialogTitle>
        <DialogDescription>{member ? `Update ${member.name}'s role.` : ""}</DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Role</Label>
          <Select value={role} onValueChange={(v) => setRole(v ?? undefined)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={rolesQuery.isLoading ? "Loading roles…" : "Select a role"}>
                {(value: string) => roleOptions.find((r) => r.id === value)?.name ?? value}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {roleOptions.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={submitting || !role}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Save
        </Button>
      </DialogFooter>
    </>
  );
}
