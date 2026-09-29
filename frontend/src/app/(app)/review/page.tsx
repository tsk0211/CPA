"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, X, ClipboardCheck, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/empty-state";
import { useCurrencyFormatter } from "@/lib/currency";
import { useConfirm } from "@/components/confirm-dialog";
import { purchasesApi } from "@/lib/api/purchases";
import { colorForKey } from "@/lib/colors";
import type { Purchase } from "@/types";

export default function ReviewPage() {
  const currency = useCurrencyFormatter();
  const confirm = useConfirm();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Purchase | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["purchases", "pending", page],
    queryFn: () => purchasesApi.pending({ page, limit: 20 }),
  });

  function refreshAll() {
    queryClient.invalidateQueries({ queryKey: ["purchases"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["project"] });
  }

  async function handleApprove(p: Purchase) {
    const ok = await confirm({
      title: "Approve this purchase?",
      message: "It will count toward the project's total.",
      confirmLabel: "Approve",
    });
    if (!ok) return;
    setBusyId(p.id);
    try {
      await purchasesApi.approve(p.id);
      toast.success("Purchase approved.");
      refreshAll();
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(id: string, reason: string) {
    setBusyId(id);
    try {
      await purchasesApi.reject(id, reason);
      toast.success("Purchase rejected.");
      setRejecting(null);
      refreshAll();
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  }

  const items = data?.items ?? [];

  return (
    <div className="mx-auto max-w-[1200px] p-6 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Review</h1>
          <p className="text-sm text-muted-foreground">{data ? `${data.total} purchase${data.total === 1 ? "" : "s"} awaiting review` : "Purchases awaiting review"}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <EmptyState title="Couldn't load the review queue" subtitle={(error as Error).message} action={<Button onClick={() => refetch()}>Retry</Button>} />
      ) : items.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="Nothing to review" subtitle="Pending purchases will show up here." />
      ) : (
        <Card className="animate-fade-in-up overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Submitted by</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm"
                        style={{ backgroundColor: `${colorForKey(p.projectId)}29` }}
                      >
                        {p.projectIcon ?? "📁"}
                      </div>
                      <span className="truncate">{p.projectName}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{p.description}</p>
                    {p.category && <p className="text-xs text-muted-foreground">{p.category}</p>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{p.vendor || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{p.createdByName ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{format(new Date(p.purchasedAt), "MMM d, yyyy")}</TableCell>
                  <TableCell className="text-right font-semibold">{currency.format(p.amount)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="outline" size="icon-sm" title="Approve" disabled={busyId === p.id} onClick={() => handleApprove(p)}>
                        {busyId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      </Button>
                      <Button variant="destructive" size="icon-sm" title="Reject" disabled={busyId === p.id} onClick={() => setRejecting(p)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {data && (data.hasMore || page > 1) && !isLoading && items.length > 0 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled={!data.hasMore} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}

      <RejectDialog purchase={rejecting} onOpenChange={(open) => !open && setRejecting(null)} onConfirm={handleReject} submitting={busyId !== null} />
    </div>
  );
}

function RejectDialog({
  purchase,
  onOpenChange,
  onConfirm,
  submitting,
}: {
  purchase: Purchase | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (id: string, reason: string) => void;
  submitting: boolean;
}) {
  const [reason, setReason] = useState("");

  return (
    <Dialog
      open={purchase !== null}
      onOpenChange={(open) => {
        if (!open) setReason("");
        onOpenChange(open);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject purchase</DialogTitle>
          <DialogDescription>{purchase?.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="reject-reason">Reason</Label>
          <Input
            id="reject-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this being rejected?"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && reason.trim() && purchase && onConfirm(purchase.id, reason.trim())}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!reason.trim() || submitting}
            onClick={() => purchase && onConfirm(purchase.id, reason.trim())}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Reject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
