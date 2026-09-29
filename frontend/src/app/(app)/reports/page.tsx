"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { CalendarIcon, Download, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { useCurrencyFormatter } from "@/lib/currency";
import { projectsApi } from "@/lib/api/projects";
import { purchasesApi } from "@/lib/api/purchases";
import { colorForKey } from "@/lib/colors";
import { ExportWizard } from "./export-wizard";

const chartConfig = { total: { label: "Spend", color: "var(--primary)" } } satisfies ChartConfig;

function startOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export default function ReportsPage() {
  const currency = useCurrencyFormatter();
  const queryClient = useQueryClient();

  const [range, setRange] = useState<DateRange | undefined>({ from: startOfMonth(), to: new Date() });
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [limit, setLimit] = useState(20);
  const [wizardOpen, setWizardOpen] = useState(false);

  const projectsQuery = useQuery({ queryKey: ["projects", "all"], queryFn: () => projectsApi.list({ page: 1, limit: 100 }) });
  const projects = projectsQuery.data?.items ?? [];

  const searchParams = { page: 1, limit, projectIds: projectIds.length ? projectIds : undefined, from: range?.from, to: range?.to };
  const searchQuery = useQuery({
    queryKey: ["reports", "search", range?.from?.toISOString(), range?.to?.toISOString(), projectIds, limit],
    queryFn: () => purchasesApi.search(searchParams),
  });

  const trendQuery = useQuery({
    queryKey: ["reports", "trend", projectIds],
    queryFn: () => purchasesApi.trend({ days: 90, projectIds: projectIds.length ? projectIds : undefined }),
  });

  function toggleProject(id: string) {
    setProjectIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
    setLimit(20);
  }

  function refreshAll() {
    queryClient.invalidateQueries({ queryKey: ["reports"] });
  }

  const items = searchQuery.data?.items ?? [];
  const rangeLabel = range?.from ? (range.to ? `${format(range.from, "MMM d, yyyy")} – ${format(range.to, "MMM d, yyyy")}` : format(range.from, "MMM d, yyyy")) : "All time";

  return (
    <div className="mx-auto max-w-[1200px] p-6 md:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Reports</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Popover>
            <PopoverTrigger render={<Button variant="outline" size="sm" />}>
              <CalendarIcon className="h-4 w-4" />
              {rangeLabel}
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2">
              <Calendar mode="range" selected={range} onSelect={setRange} numberOfMonths={2} />
              {range && (
                <Button variant="ghost" size="sm" className="w-full" onClick={() => setRange(undefined)}>
                  <X className="h-4 w-4" />
                  Clear range
                </Button>
              )}
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger render={<Button variant="outline" size="sm" />}>
              Projects{projectIds.length > 0 ? ` (${projectIds.length})` : ""}
            </PopoverTrigger>
            <PopoverContent className="w-64">
              {projects.length === 0 ? (
                <p className="p-2 text-sm text-muted-foreground">No projects yet.</p>
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
              {projectIds.length > 0 && (
                <Button variant="ghost" size="sm" className="w-full" onClick={() => setProjectIds([])}>
                  <X className="h-4 w-4" />
                  Clear projects
                </Button>
              )}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total spend</p>
            <p className="mt-1 text-2xl font-bold">{searchQuery.isLoading ? <Skeleton className="h-8 w-24" /> : currency.format(searchQuery.data?.totalAmount ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Purchases</p>
            <p className="mt-1 text-2xl font-bold">{searchQuery.isLoading ? <Skeleton className="h-8 w-16" /> : (searchQuery.data?.total ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col justify-center gap-2 pt-6">
            <p className="text-sm text-muted-foreground">Export</p>
            <Button onClick={() => setWizardOpen(true)}>
              <Download className="h-4 w-4" />
              Export…
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Spend trend</CardTitle>
          <p className="text-sm text-muted-foreground">Approved spend, last 90 days</p>
        </CardHeader>
        <CardContent>
          {trendQuery.isLoading ? (
            <Skeleton className="h-[220px] w-full" />
          ) : trendQuery.data && trendQuery.data.length > 1 ? (
            <ChartContainer config={chartConfig} className="h-[220px] w-full">
              <LineChart data={trendQuery.data} margin={{ left: 12, right: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} tickFormatter={(value) => format(new Date(value), "MMM d")} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => currency.format(value)} width={72} />
                <ChartTooltip content={<ChartTooltipContent labelFormatter={(value) => format(new Date(value), "MMM d, yyyy")} formatter={(value) => currency.format(Number(value))} />} />
                <Line dataKey="total" type="monotone" stroke="var(--color-total)" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartContainer>
          ) : (
            <p className="text-sm text-muted-foreground">Not enough data yet</p>
          )}
        </CardContent>
      </Card>

      <h2 className="mb-3 mt-8 text-lg font-medium">Purchases</h2>
      {searchQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : searchQuery.error ? (
        <EmptyState title="Couldn't load report" subtitle={(searchQuery.error as Error).message} action={<Button onClick={() => refreshAll()}>Retry</Button>} />
      ) : items.length === 0 ? (
        <EmptyState icon={Download} title="No purchases in this range" subtitle="Try widening the date range or clearing project filters." />
      ) : (
        <>
          <Card className="animate-fade-in-up overflow-hidden py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm"
                          style={{ backgroundColor: `${colorForKey(p.projectId)}29` }}
                        >
                          {p.projectIcon ?? "📁"}
                        </div>
                        <span className="truncate">{p.projectName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[240px] truncate">{p.description}</TableCell>
                    <TableCell className="text-muted-foreground">{format(new Date(p.purchasedAt), "MMM d, yyyy")}</TableCell>
                    <TableCell>
                      <StatusBadge status={p.status} />
                    </TableCell>
                    <TableCell className="text-right font-semibold">{currency.format(p.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          {searchQuery.data?.hasMore && (
            <div className="mt-4 flex justify-center">
              <Button variant="outline" onClick={() => setLimit((l) => l + 20)} disabled={searchQuery.isFetching}>
                {searchQuery.isFetching && <Loader2 className="h-4 w-4 animate-spin" />}
                Load more
              </Button>
            </div>
          )}
        </>
      )}

      <ExportWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        projects={projects}
        initialRange={range}
        initialProjectIds={projectIds}
      />
    </div>
  );
}
