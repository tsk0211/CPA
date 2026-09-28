import { Badge } from "@/components/ui/badge";
import type { PurchaseStatus } from "@/types";
import { cn } from "@/lib/utils";

const STYLES: Record<PurchaseStatus, string> = {
  pending: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  approved: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  rejected: "bg-red-500/15 text-red-600 dark:text-red-400",
};

const LABELS: Record<PurchaseStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

export function StatusBadge({ status, className }: { status: PurchaseStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn("border-transparent font-medium", STYLES[status], className)}>
      {LABELS[status]}
    </Badge>
  );
}
