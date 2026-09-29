"use client";

import { useQuery } from "@tanstack/react-query";
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { format } from "date-fns";
import { FolderKanban, Wallet, ClipboardCheck, Users, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { useSession } from "@/lib/session";
import { useCurrencyFormatter } from "@/lib/currency";
import { projectsApi } from "@/lib/api/projects";
import { purchasesApi } from "@/lib/api/purchases";
import { usersApi } from "@/lib/api/users";
import { roleCan } from "@/types";
import { colorForKey } from "@/lib/colors";
import { EmptyState } from "@/components/empty-state";

const chartConfig = { total: { label: "Spend", color: "var(--primary)" } } satisfies ChartConfig;

export default function DashboardPage() {
  const session = useSession();
  const currency = useCurrencyFormatter();
  const user = session.user!;
  const can = roleCan(user.role);
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const projectsQuery = useQuery({ queryKey: ["dashboard", "projects"], queryFn: () => projectsApi.list({ page: 1, limit: 1 }) });
  const monthSpendQuery = useQuery({
    queryKey: ["dashboard", "monthSpend"],
    queryFn: () => purchasesApi.search({ page: 1, limit: 1, from: startOfMonth }),
    enabled: can.canExport,
  });
  const pendingQuery = useQuery({
    queryKey: ["dashboard", "pending"],
    queryFn: () => purchasesApi.pending({ page: 1, limit: 1 }),
    enabled: can.canReviewPurchases,
  });
  const teamQuery = useQuery({ queryKey: ["dashboard", "team"], queryFn: () => usersApi.list({ page: 1, limit: 1 }), enabled: can.canManageUsers });
  const recentQuery = useQuery({ queryKey: ["dashboard", "recent"], queryFn: () => purchasesApi.recent({ page: 1, limit: 8 }) });
  const trendQuery = useQuery({ queryKey: ["dashboard", "trend"], queryFn: () => purchasesApi.trend({ days: 30 }), enabled: can.canExport });

  const loading = projectsQuery.isLoading || recentQuery.isLoading;
  const error = projectsQuery.error || recentQuery.error;

  function refreshAll() {
    projectsQuery.refetch();
    monthSpendQuery.refetch();
    pendingQuery.refetch();
    teamQuery.refetch();
    recentQuery.refetch();
    trendQuery.refetch();
  }

  const stats = [
    { key: "projects", icon: FolderKanban, label: "Active projects", value: projectsQuery.data ? `${projectsQuery.data.total}` : "—", color: "#3B82F6" },
    ...(can.canExport
      ? [
          {
            key: "spend",
            icon: Wallet,
            label: "Approved spend this month",
            value: monthSpendQuery.data ? currency.format(monthSpendQuery.data.totalAmount) : "—",
            color: "#14B8A6",
          },
        ]
      : []),
    ...(can.canReviewPurchases
      ? [{ key: "pending", icon: ClipboardCheck, label: "Awaiting review", value: pendingQuery.data ? `${pendingQuery.data.total}` : "—", color: "#F59E0B" }]
      : []),
    ...(can.canManageUsers ? [{ key: "team", icon: Users, label: "Team members", value: teamQuery.data ? `${teamQuery.data.total}` : "—", color: "#A855F7" }] : []),
  ];

  return (
    <div className="mx-auto max-w-[1200px] p-6 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Welcome back, {user.name.split(" ")[0]}</h1>
        <Button variant="outline" size="icon" onClick={refreshAll} title="Refresh">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <EmptyState title="Couldn't load the dashboard" subtitle={(error as Error).message} action={<Button onClick={refreshAll}>Retry</Button>} />
      ) : (
        <>
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}>
            {stats.map((s) => (
              <Card key={s.key}>
                <CardContent className="pt-6">
                  <div
                    className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${s.color}29` }}
                  >
                    <s.icon className="h-5 w-5" style={{ color: s.color }} />
                  </div>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {can.canExport && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Spend trend</CardTitle>
                <p className="text-sm text-muted-foreground">Approved spend, last 30 days</p>
              </CardHeader>
              <CardContent>
                {trendQuery.isLoading ? (
                  <Skeleton className="h-[220px] w-full" />
                ) : trendQuery.data && trendQuery.data.length > 1 ? (
                  <ChartContainer config={chartConfig} className="h-[220px] w-full">
                    <LineChart data={trendQuery.data} margin={{ left: 12, right: 12 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        minTickGap={32}
                        tickFormatter={(value) => format(new Date(value), "MMM d")}
                      />
                      <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => currency.format(value)} width={72} />
                      <ChartTooltip
                        content={<ChartTooltipContent labelFormatter={(value) => format(new Date(value), "MMM d, yyyy")} formatter={(value) => currency.format(Number(value))} />}
                      />
                      <Line dataKey="total" type="monotone" stroke="var(--color-total)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ChartContainer>
                ) : (
                  <p className="text-sm text-muted-foreground">Not enough data yet</p>
                )}
              </CardContent>
            </Card>
          )}

          <h2 className="mb-3 mt-8 text-lg font-medium">Recent activity</h2>
          {recentQuery.data && recentQuery.data.items.length > 0 ? (
            <Card>
              <CardContent className="divide-y p-0">
                {recentQuery.data.items.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg"
                      style={{ backgroundColor: `${colorForKey(p.projectId)}29` }}
                    >
                      {p.projectIcon ?? "📁"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.description}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[p.projectName, p.createdByName].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <p className="shrink-0 font-semibold">{currency.format(p.amount)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <EmptyState title="Nothing logged yet" />
          )}
        </>
      )}
    </div>
  );
}
