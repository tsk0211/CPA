"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usersApi } from "@/lib/api/users";
import { rolesApi } from "@/lib/api/roles";
import type { Role } from "@/types";

export function InviteMemberDialog({
  open,
  onOpenChange,
  canCreateAdmin,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Owner-only — an admin creating a new account can't hand out Admin.
  // "owner" itself is never an option anywhere: it's not a Role document
  // (see server/src/models/Role.ts), it's the one account seeded when the
  // app first boots, and it can never be assigned, transferred, deleted,
  // or deactivated through any UI or API.
  canCreateAdmin: boolean;
  onSaved: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Keyed on open so the form remounts with blank fields every time
            it's reopened, instead of syncing that via an effect. */}
        <InviteMemberDialogForm key={open ? "open" : "idle"} canCreateAdmin={canCreateAdmin} onOpenChange={onOpenChange} onSaved={onSaved} />
      </DialogContent>
    </Dialog>
  );
}

function InviteMemberDialogForm({
  canCreateAdmin,
  onOpenChange,
  onSaved,
}: {
  canCreateAdmin: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [role, setRole] = useState<Role | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetched live, not a hardcoded list — this is the actual role catalog
  // an owner can extend (Project Manager, or anything else they define),
  // so a new custom role shows up here automatically with no code change.
  const rolesQuery = useQuery({ queryKey: ["roles"], queryFn: () => rolesApi.list() });
  const roleOptions = [...(rolesQuery.data ?? []).map((r) => ({ id: r.id, name: r.name })), ...(canCreateAdmin ? [{ id: "admin", name: "Admin" }] : [])];

  async function submit() {
    if (!name.trim() || !email.trim() || !tempPassword || !role) {
      setError("Fill in name, email, a temporary password, and pick a role.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await usersApi.create({ name: name.trim(), email: email.trim(), tempPassword, role });
      toast.success("Member invited.");
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
        <DialogTitle>Invite member</DialogTitle>
        <DialogDescription>They&apos;ll sign in with this email and temporary password, then be asked to change it.</DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="invite-name">Name</Label>
          <Input id="invite-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div className="space-y-2">
          <Label htmlFor="invite-email">Email</Label>
          <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="invite-password">Temporary password</Label>
          <Input id="invite-password" value={tempPassword} onChange={(e) => setTempPassword(e.target.value)} />
        </div>
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
        <Button onClick={submit} disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Invite
        </Button>
      </DialogFooter>
    </>
  );
}
