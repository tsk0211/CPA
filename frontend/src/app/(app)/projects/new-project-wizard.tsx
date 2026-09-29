"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, Loader2, PartyPopper, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { projectsApi } from "@/lib/api/projects";
import { usersApi } from "@/lib/api/users";
import { rolesApi } from "@/lib/api/roles";
import { EMOJI_CHOICES } from "./project-dialog";
import { cn } from "@/lib/utils";

type Step = "basics" | "numbers" | "team" | "review";
const STEPS: { key: Step; label: string }[] = [
  { key: "basics", label: "Basics" },
  { key: "numbers", label: "Numbers" },
  { key: "team", label: "Team" },
  { key: "review", label: "Review" },
];

interface TeamPick {
  userId: string;
  userName: string;
  roleId: string;
  roleName: string;
}

export function NewProjectWizard({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        {/* Keyed on open so every field resets to a blank run each time,
            instead of syncing that via an effect (see reports/export-wizard
            for the same pattern). */}
        <NewProjectWizardBody key={open ? "open" : "closed"} onOpenChange={onOpenChange} onCreated={onCreated} />
      </DialogContent>
    </Dialog>
  );
}

function NewProjectWizardBody({ onOpenChange, onCreated }: { onOpenChange: (open: boolean) => void; onCreated: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [created, setCreated] = useState<{ id: string; name: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [icon, setIcon] = useState(EMOJI_CHOICES[0]);
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [threshold, setThreshold] = useState("0");
  const [team, setTeam] = useState<TeamPick[]>([]);

  const usersQuery = useQuery({ queryKey: ["users", "for-wizard"], queryFn: () => usersApi.list({ page: 1, limit: 100 }) });
  const rolesQuery = useQuery({ queryKey: ["roles"], queryFn: () => rolesApi.list() });
  const availablePeople = (usersQuery.data?.items ?? []).filter((u) => !team.some((t) => t.userId === u.id));

  const step = STEPS[stepIndex].key;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;
  const basicsValid = name.trim().length > 0;

  function addTeamMember(userId: string, roleId: string) {
    const user = usersQuery.data?.items.find((u) => u.id === userId);
    const role = rolesQuery.data?.find((r) => r.id === roleId);
    if (!user || !role) return;
    setTeam((prev) => [...prev, { userId, userName: user.name, roleId, roleName: role.name }]);
  }

  function removeTeamMember(userId: string) {
    setTeam((prev) => prev.filter((t) => t.userId !== userId));
  }

  async function create() {
    setCreating(true);
    setError(null);
    try {
      const project = await projectsApi.create({
        name: name.trim(),
        icon,
        description: description.trim(),
        budget: budget.trim() ? Number(budget) : null,
      });
      if (Number(threshold) > 0) {
        await projectsApi.update(project.id, { name: project.name, icon: project.icon, autoApproveThreshold: Number(threshold) });
      }
      for (const member of team) {
        await projectsApi.addMember(project.id, member.userId, member.roleId);
      }
      setCreated({ id: project.id, name: project.name });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setCreating(false);
    }
  }

  function close() {
    if (created) toast.success(`${created.name} created.`);
    onOpenChange(false);
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>New project</DialogTitle>
        <DialogDescription>{created ? "Your project is ready." : `Step ${stepIndex + 1} of ${STEPS.length} — ${STEPS[stepIndex].label}`}</DialogDescription>
      </DialogHeader>

      {!created && (
        <div className="flex items-center gap-1.5">
          {STEPS.map((s, i) => (
            <div key={s.key} className={cn("h-1.5 flex-1 rounded-full transition-colors", i <= stepIndex ? "bg-primary" : "bg-muted")} />
          ))}
        </div>
      )}

      <div className="flex h-[360px] flex-col overflow-y-auto">
        {created ? (
          <div className="animate-fade-in-up m-auto flex flex-col items-center gap-3 py-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15">
              <PartyPopper className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="font-medium">{created.name} created</p>
              <p className="text-sm text-muted-foreground">{team.length > 0 ? `${team.length} team member${team.length === 1 ? "" : "s"} added.` : "Ready to track purchases."}</p>
            </div>
            <Link href={`/projects/detail?id=${created.id}`}>
              <Button size="lg" className="mt-2" onClick={close}>
                View project
              </Button>
            </Link>
          </div>
        ) : (
          <div className="animate-fade-in-up space-y-4 py-2">
            {step === "basics" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="wizard-name">Name</Label>
                  <Input id="wizard-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wizard-description">Description (optional)</Label>
                  <Input id="wizard-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's this project for?" />
                </div>
                <div className="space-y-2">
                  <Label>Icon</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {EMOJI_CHOICES.map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => setIcon(e)}
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-lg text-lg transition-all",
                          icon === e ? "bg-primary/15 ring-2 ring-primary scale-105" : "bg-muted hover:bg-muted/70",
                        )}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {step === "numbers" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="wizard-budget">Budget (optional)</Label>
                  <Input id="wizard-budget" type="number" min={0} step="0.01" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="No limit" />
                  <p className="text-xs text-muted-foreground">A target to track spend against — shown on the project page, doesn&apos;t block anything.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wizard-threshold">Auto-approve under (optional)</Label>
                  <Input id="wizard-threshold" type="number" min={0} step="0.01" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Purchases below this amount skip review entirely. Leave at 0 to require review for everything.</p>
                </div>
              </>
            )}

            {step === "team" && (
              <>
                <TeamAddRow people={availablePeople} roles={rolesQuery.data ?? []} onAdd={addTeamMember} />
                {team.length === 0 ? (
                  <p className="pt-2 text-sm text-muted-foreground">No team members added yet — you can also add people later from the project page.</p>
                ) : (
                  <div className="space-y-1.5 pt-2">
                    {team.map((t) => (
                      <div key={t.userId} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                        <span className="font-medium">{t.userName}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{t.roleName}</span>
                          <Button variant="ghost" size="icon-xs" onClick={() => removeTeamMember(t.userId)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {step === "review" && (
              <div className="space-y-2 rounded-lg border p-4 text-sm">
                <ReviewRow label="Name" value={`${icon} ${name || "—"}`} />
                {description && <ReviewRow label="Description" value={description} />}
                <ReviewRow label="Budget" value={budget ? budget : "No limit set"} />
                <ReviewRow label="Auto-approve under" value={threshold || "0"} />
                <ReviewRow label="Team" value={team.length === 0 ? "None added" : team.map((t) => `${t.userName} (${t.roleName})`).join(", ")} />
                {error && <p className="pt-2 text-sm text-destructive">{error}</p>}
              </div>
            )}
          </div>
        )}
      </div>

      <DialogFooter className="flex-row justify-between sm:justify-between">
        {created ? (
          <Button variant="outline" onClick={close} className="ml-auto">
            <Check className="h-4 w-4" />
            Done
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={() => setStepIndex((i) => i - 1)} disabled={isFirst || creating}>
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
            {isLast ? (
              <Button onClick={create} disabled={creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Create project
              </Button>
            ) : (
              <Button onClick={() => setStepIndex((i) => i + 1)} disabled={step === "basics" && !basicsValid}>
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </>
        )}
      </DialogFooter>
    </>
  );
}

function TeamAddRow({
  people,
  roles,
  onAdd,
}: {
  people: { id: string; name: string }[];
  roles: { id: string; name: string }[];
  onAdd: (userId: string, roleId: string) => void;
}) {
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [roleId, setRoleId] = useState<string | undefined>(undefined);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={userId} onValueChange={(v) => setUserId(v ?? undefined)}>
        <SelectTrigger className="w-full sm:w-44">
          <SelectValue placeholder="Person" />
        </SelectTrigger>
        <SelectContent>
          {people.length === 0 ? (
            <p className="p-2 text-sm text-muted-foreground">Everyone&apos;s added</p>
          ) : (
            people.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
      <Select value={roleId} onValueChange={(v) => setRoleId(v ?? undefined)}>
        <SelectTrigger className="w-full sm:w-44">
          <SelectValue placeholder="Role on this project" />
        </SelectTrigger>
        <SelectContent>
          {roles.map((r) => (
            <SelectItem key={r.id} value={r.id}>
              {r.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="icon"
        disabled={!userId || !roleId}
        onClick={() => {
          if (userId && roleId) {
            onAdd(userId, roleId);
            setUserId(undefined);
            setRoleId(undefined);
          }
        }}
      >
        <UserPlus className="h-4 w-4" />
      </Button>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
