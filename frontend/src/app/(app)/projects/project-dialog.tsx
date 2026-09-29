"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { projectsApi } from "@/lib/api/projects";

export const EMOJI_CHOICES = ["📁", "🏗️", "🎨", "🍽️", "🧾", "🚚", "🛠️", "🏠", "🧑‍💻", "🌱", "🎉", "📦"];

export interface EditableProject {
  id: string;
  name: string;
  icon: string;
  description: string;
  budget: number | null;
  autoApproveThreshold: number;
}

// Edit-only — creation is its own multi-step flow (new-project-wizard.tsx),
// since it needs to collect team assignment too and a single dialog got
// cramped trying to do both. This one just edits an existing project's
// fields in place.
export function ProjectDialog({
  open,
  onOpenChange,
  existing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing: EditableProject | null;
  onSaved: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Keyed on open+id so the form's local state is freshly initialized
            from `existing` every time the dialog opens, instead of syncing
            it via an effect. */}
        {existing && <ProjectDialogForm key={open ? existing.id : "idle"} existing={existing} onOpenChange={onOpenChange} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  );
}

function ProjectDialogForm({
  existing,
  onOpenChange,
  onSaved,
}: {
  existing: EditableProject;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(existing.name);
  const [icon, setIcon] = useState(existing.icon);
  const [description, setDescription] = useState(existing.description);
  const [budget, setBudget] = useState(existing.budget != null ? String(existing.budget) : "");
  const [threshold, setThreshold] = useState(String(existing.autoApproveThreshold));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) {
      setError("Enter a project name.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await projectsApi.update(existing.id, {
        name: name.trim(),
        icon,
        description: description.trim(),
        budget: budget.trim() ? Number(budget) : null,
        autoApproveThreshold: Number(threshold) || 0,
      });
      toast.success("Project updated.");
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
        <DialogTitle>Edit project</DialogTitle>
        <DialogDescription>Update the project&apos;s details, budget, and auto-approve limit.</DialogDescription>
      </DialogHeader>

      <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
        <div className="space-y-2">
          <Label htmlFor="project-name">Name</Label>
          <Input id="project-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus onKeyDown={(e) => e.key === "Enter" && submit()} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="project-description">Description (optional)</Label>
          <Input id="project-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's this project for?" />
        </div>

        <div className="space-y-2">
          <Label>Icon</Label>
          <div className="flex flex-wrap gap-1.5">
            {EMOJI_CHOICES.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setIcon(e)}
                className={`flex h-9 w-9 items-center justify-center rounded-lg text-lg transition-all ${
                  icon === e ? "bg-primary/15 ring-2 ring-primary scale-105" : "bg-muted hover:bg-muted/70"
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="budget">Budget (optional)</Label>
            <Input id="budget" type="number" min={0} step="0.01" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="No limit" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="threshold">Auto-approve under</Label>
            <Input id="threshold" type="number" min={0} step="0.01" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
          </div>
        </div>
        <p className="-mt-2 text-xs text-muted-foreground">
          Budget is just a target to track spend against. Auto-approve is the amount under which a purchase skips review entirely.
        </p>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Save
        </Button>
      </DialogFooter>
    </>
  );
}
