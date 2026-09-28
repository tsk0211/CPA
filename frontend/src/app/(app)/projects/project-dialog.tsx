"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { projectsApi } from "@/lib/api/projects";

const EMOJI_CHOICES = ["📁", "🏗️", "🎨", "🍽️", "🧾", "🚚", "🛠️", "🏠", "🧑‍💻", "🌱", "🎉", "📦"];

interface Existing {
  id: string;
  name: string;
  icon: string;
  autoApproveThreshold: number;
}

export function ProjectDialog({
  open,
  onOpenChange,
  existing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing: Existing | null;
  onSaved: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Keyed on open+id so the form's local state is freshly initialized
            from `existing` every time the dialog opens, instead of syncing
            it via an effect. */}
        <ProjectDialogForm key={open ? (existing?.id ?? "new") : "idle"} existing={existing} onOpenChange={onOpenChange} onSaved={onSaved} />
      </DialogContent>
    </Dialog>
  );
}

function ProjectDialogForm({
  existing,
  onOpenChange,
  onSaved,
}: {
  existing: Existing | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [icon, setIcon] = useState(existing?.icon ?? EMOJI_CHOICES[0]);
  const [threshold, setThreshold] = useState(existing ? String(existing.autoApproveThreshold) : "0");
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
      if (existing) {
        await projectsApi.update(existing.id, name.trim(), icon, Number(threshold) || 0);
        toast.success("Project updated.");
      } else {
        await projectsApi.create(name.trim(), icon);
        toast.success("Project created.");
      }
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
        <DialogTitle>{existing ? "Edit project" : "New project"}</DialogTitle>
        <DialogDescription>{existing ? "Update the project's name, icon, or auto-approve limit." : "Give the project a name and icon."}</DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="project-name">Name</Label>
          <Input id="project-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus onKeyDown={(e) => e.key === "Enter" && submit()} />
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

        {existing && (
          <div className="space-y-2">
            <Label htmlFor="threshold">Auto-approve under</Label>
            <Input id="threshold" type="number" min={0} step="0.01" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
            <p className="text-xs text-muted-foreground">Purchases below this amount are approved automatically. Set to 0 to require review for everything.</p>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {existing ? "Save" : "Create"}
        </Button>
      </DialogFooter>
    </>
  );
}
