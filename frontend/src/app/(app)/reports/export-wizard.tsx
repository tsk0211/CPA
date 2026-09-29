"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Check, ChevronLeft, ChevronRight, Download, FileSpreadsheet, FileText, Loader2, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { purchasesApi } from "@/lib/api/purchases";
import { cn } from "@/lib/utils";
import type { Project } from "@/types";

type ExportFormat = "csv" | "xlsx";

// Named steps, not just numbers — the point of pulling this into its own
// wizard (rather than the old inline "click CSV/XLSX and it just downloads"
// buttons) is that each step is now its own slot to extend later: more
// output formats, more per-project options, etc. without reshuffling
// everything else. See reports/page.tsx's comment for the fuller context.
type Step = "format" | "range" | "projects" | "options" | "review";
const STEPS: { key: Step; label: string }[] = [
  { key: "format", label: "Format" },
  { key: "range", label: "Date range" },
  { key: "projects", label: "Projects" },
  { key: "options", label: "Options" },
  { key: "review", label: "Review" },
];

interface ExportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Project[];
  // Seeded from the (now view-only) filters on the Reports page itself, so
  // starting the wizard from a filtered view doesn't make you redo the
  // same picks — every value stays independently editable inside the
  // wizard from there.
  initialFormat?: ExportFormat;
  initialRange?: DateRange;
  initialProjectIds?: string[];
  initialIncludeAuditTrail?: boolean;
}

export function ExportWizard({ open, onOpenChange, projects, initialFormat, initialRange, initialProjectIds, initialIncludeAuditTrail }: ExportWizardProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        {/* Keyed on open so every field resets to a clean run each time the
            wizard is reopened (lazy-initialized from the current props),
            instead of syncing that via an effect. */}
        <ExportWizardBody
          key={open ? "open" : "closed"}
          onOpenChange={onOpenChange}
          projects={projects}
          initialFormat={initialFormat ?? "xlsx"}
          initialRange={initialRange}
          initialProjectIds={initialProjectIds ?? []}
          initialIncludeAuditTrail={initialIncludeAuditTrail ?? false}
        />
      </DialogContent>
    </Dialog>
  );
}

function ExportWizardBody({
  onOpenChange,
  projects,
  initialFormat,
  initialRange,
  initialProjectIds,
  initialIncludeAuditTrail,
}: {
  onOpenChange: (open: boolean) => void;
  projects: Project[];
  initialFormat: ExportFormat;
  initialRange: DateRange | undefined;
  initialProjectIds: string[];
  initialIncludeAuditTrail: boolean;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [done, setDone] = useState<{ filename: string; url: string } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [exportFormat, setExportFormat] = useState<ExportFormat>(initialFormat);
  const [range, setRange] = useState<DateRange | undefined>(initialRange);
  const [projectIds, setProjectIds] = useState<string[]>(initialProjectIds);
  const [includeAuditTrail, setIncludeAuditTrail] = useState(initialIncludeAuditTrail);

  useEffect(() => {
    return () => {
      if (done) URL.revokeObjectURL(done.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done?.url]);

  const step = STEPS[stepIndex].key;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;

  function toggleProject(id: string) {
    setProjectIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const { blob, filename } = await purchasesApi.export({
        format: exportFormat,
        projectIds: projectIds.length ? projectIds : undefined,
        from: range?.from,
        to: range?.to,
        includeAuditTrail,
      });
      setDone({ filename, url: URL.createObjectURL(blob) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setGenerating(false);
    }
  }

  function close() {
    if (done) toast.success("Export ready — downloaded.");
    onOpenChange(false);
  }

  const rangeLabel = range?.from
    ? range.to
      ? `${format(range.from, "MMM d, yyyy")} – ${format(range.to, "MMM d, yyyy")}`
      : format(range.from, "MMM d, yyyy")
    : "All time";
  const projectsLabel = projectIds.length === 0 ? "All projects" : `${projectIds.length} project${projectIds.length === 1 ? "" : "s"}`;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Export report</DialogTitle>
        <DialogDescription>
          {done ? "Your export is ready." : `Step ${stepIndex + 1} of ${STEPS.length} — ${STEPS[stepIndex].label}`}
        </DialogDescription>
      </DialogHeader>

      {!done && (
          <div className="flex items-center gap-1.5">
            {STEPS.map((s, i) => (
              <div
                key={s.key}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors",
                  i <= stepIndex ? "bg-primary" : "bg-muted",
                )}
              />
            ))}
          </div>
        )}

        {/* Fixed height, not min-height — with fixedWeeks on Calendar (see
            components/ui/calendar.tsx) nothing inside ever needs more than
            this, so the dialog's own footprint never shifts switching
            steps or navigating months. overflow-y-auto is a safety net,
            not the expected path. */}
        <div className="flex h-[360px] flex-col justify-center overflow-y-auto">
          {done ? (
            <div className="animate-fade-in-up flex flex-col items-center gap-3 py-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15">
                <PartyPopper className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="font-medium">Export ready</p>
                <p className="text-sm text-muted-foreground">{done.filename}</p>
              </div>
              <a href={done.url} download={done.filename}>
                <Button size="lg" className="mt-2">
                  <Download className="h-4 w-4" />
                  Download {done.filename}
                </Button>
              </a>
            </div>
          ) : (
            <div className="animate-fade-in-up space-y-4 py-2">
              {step === "format" && (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setExportFormat("csv")}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-xl border p-5 transition-all",
                      exportFormat === "csv" ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "hover:bg-muted/50",
                    )}
                  >
                    <FileText className="h-8 w-8 text-muted-foreground" />
                    <span className="font-medium">CSV</span>
                    <span className="text-xs text-muted-foreground">Plain spreadsheet data</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportFormat("xlsx")}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-xl border p-5 transition-all",
                      exportFormat === "xlsx" ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "hover:bg-muted/50",
                    )}
                  >
                    <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
                    <span className="font-medium">XLSX</span>
                    <span className="text-xs text-muted-foreground">Formatted workbook</span>
                  </button>
                </div>
              )}

              {step === "range" && (
                <div className="flex flex-col items-center gap-3">
                  <Calendar mode="range" selected={range} onSelect={setRange} numberOfMonths={1} />
                  {range && (
                    <Button variant="ghost" size="sm" onClick={() => setRange(undefined)}>
                      Clear — use all time
                    </Button>
                  )}
                </div>
              )}

              {step === "projects" && (
                <div className="space-y-1">
                  {projects.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No projects yet — export will cover none.</p>
                  ) : (
                    <div className="max-h-64 space-y-1 overflow-y-auto">
                      {projects.map((p) => (
                        <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-sm hover:bg-muted">
                          <Checkbox checked={projectIds.includes(p.id)} onCheckedChange={() => toggleProject(p.id)} />
                          <span className="truncate">
                            {p.icon} {p.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                  <p className="pt-1 text-xs text-muted-foreground">Nothing checked means every project is included.</p>
                </div>
              )}

              {step === "options" && (
                <div className="space-y-3">
                  <label className="flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm hover:bg-muted/50">
                    <Checkbox checked={includeAuditTrail} onCheckedChange={(v) => setIncludeAuditTrail(v === true)} className="mt-0.5" />
                    <span>
                      <span className="font-medium">Include audit trail</span>
                      <br />
                      <span className="text-muted-foreground">Adds a second sheet with the full edit/approve/reject history for this scope.</span>
                    </span>
                  </label>
                  <p className="text-xs text-muted-foreground">More export options land here as they&apos;re added.</p>
                </div>
              )}

              {step === "review" && (
                <div className="space-y-2 rounded-lg border p-4 text-sm">
                  <ReviewRow label="Format" value={exportFormat.toUpperCase()} />
                  <ReviewRow label="Date range" value={rangeLabel} />
                  <ReviewRow label="Projects" value={projectsLabel} />
                  <ReviewRow label="Audit trail" value={includeAuditTrail ? "Included" : "Not included"} />
                  {error && <p className="pt-2 text-sm text-destructive">{error}</p>}
                </div>
              )}
            </div>
          )}
        </div>

      <DialogFooter className="flex-row justify-between sm:justify-between">
        {done ? (
          <Button variant="outline" onClick={close} className="ml-auto">
            <Check className="h-4 w-4" />
            Done
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={() => setStepIndex((i) => i - 1)} disabled={isFirst || generating}>
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
            {isLast ? (
              <Button onClick={generate} disabled={generating}>
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Generate export
              </Button>
            ) : (
              <Button onClick={() => setStepIndex((i) => i + 1)}>
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

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
