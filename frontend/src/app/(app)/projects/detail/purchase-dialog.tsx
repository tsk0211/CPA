"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { purchasesApi } from "@/lib/api/purchases";
import type { Purchase } from "@/types";

export function PurchaseDialog({
  open,
  onOpenChange,
  projectId,
  existing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  existing: Purchase | null;
  onSaved: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Keyed on open+id so the form's local state is freshly initialized
            from `existing` every time the dialog opens, instead of syncing
            it via an effect. */}
        <PurchaseDialogForm key={open ? (existing?.id ?? "new") : "idle"} projectId={projectId} existing={existing} onOpenChange={onOpenChange} onSaved={onSaved} />
      </DialogContent>
    </Dialog>
  );
}

function PurchaseDialogForm({
  projectId,
  existing,
  onOpenChange,
  onSaved,
}: {
  projectId: string;
  existing: Purchase | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState(existing ? String(existing.amount) : "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [quantity, setQuantity] = useState(existing?.quantity != null ? String(existing.quantity) : "");
  const [unit, setUnit] = useState(existing?.unit ?? "");
  const [vendor, setVendor] = useState(existing?.vendor ?? "");
  const [category, setCategory] = useState(existing?.category ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const amountNum = Number(amount);
    if (!description.trim()) {
      setError("What was it for?");
      return;
    }
    if (!amount || Number.isNaN(amountNum) || amountNum <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const shared = {
        amount: amountNum,
        description: description.trim(),
        quantity: quantity ? Number(quantity) : null,
        unit: unit.trim() || null,
        vendor: vendor.trim() || null,
        category: category.trim() || null,
        notes: notes.trim() || null,
      };
      if (existing) {
        await purchasesApi.update(existing.id, shared);
        toast.success("Purchase updated.");
      } else {
        await purchasesApi.create({
          projectId,
          amount: amountNum,
          description: description.trim(),
          quantity: quantity ? Number(quantity) : undefined,
          unit: unit.trim() || undefined,
          vendor: vendor.trim() || undefined,
          category: category.trim() || undefined,
          notes: notes.trim() || undefined,
        });
        toast.success("Purchase added.");
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
        <DialogTitle>{existing ? "Edit purchase" : "Add purchase"}</DialogTitle>
        <DialogDescription>{existing ? "Update the details of this purchase." : "Log a cash purchase for this project."}</DialogDescription>
      </DialogHeader>

      <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
        <div className="space-y-2">
          <Label htmlFor="amount">Amount</Label>
          <Input id="amount" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">What was it for?</Label>
          <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity (optional)</Label>
            <Input id="quantity" type="number" min={0} step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="unit">Unit</Label>
            <Input id="unit" value={unit} onChange={(e) => setUnit(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="vendor">Vendor (optional)</Label>
          <Input id="vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">Category (optional)</Label>
          <Input id="category" value={category} onChange={(e) => setCategory(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="notes">Notes (optional)</Label>
          <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {existing ? "Save" : "Add"}
        </Button>
      </DialogFooter>
    </>
  );
}
