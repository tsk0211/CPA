"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Plus, Search, MoreVertical, Pencil, Trash2, Check, X, Receipt, UserPlus, Users2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ColoredAvatar } from "@/components/colored-avatar";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { useCurrencyFormatter } from "@/lib/currency";
import { useSession } from "@/lib/session";
import { useConfirm } from "@/components/confirm-dialog";
import { projectsApi } from "@/lib/api/projects";
import { purchasesApi } from "@/lib/api/purchases";
import { auditLogApi } from "@/lib/api/auditLog";
import { usersApi } from "@/lib/api/users";
import { rolesApi } from "@/lib/api/roles";
import { colorForKey } from "@/lib/colors";
import { roleCan } from "@/types";
import type { Purchase } from "@/types";
import { PurchaseDialog } from "./purchase-dialog";
import { format } from "date-fns";

export default function ProjectDetailPage() {
  return (
    <Suspense fallback={null}>
      <ProjectDetailContent />
    </Suspense>
  );
}

function ProjectDetailContent() {
  const router = useRouter();
  const id = useSearchParams().get("id") ?? "";
  const session = useSession();
  const currency = useCurrencyFormatter();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const can = roleCan(session.user!.role);

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Purchase | null>(null);

  const projectQuery = useQuery({ queryKey: ["project", id], queryFn: () => projectsApi.get(id), enabled: !!id });
  const purchasesQuery = useQuery({
    queryKey: ["purchases", id, search],
    queryFn: () => purchasesApi.forProject(id, { page: 1, limit: 100, search }),
    enabled: !!id,
  });

  function refreshAll() {
    queryClient.invalidateQueries({ queryKey: ["project", id] });
    queryClient.invalidateQueries({ queryKey: ["purchases", id] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }

  async function handleDelete(p: Purchase) {
    const ok = await confirm({ title: "Delete this purchase?", message: p.description, confirmLabel: "Delete", tone: "destructive" });
    if (!ok) return;
    try {
      await purchasesApi.delete(p.id);
      toast.success("Purchase deleted.");
      refreshAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  async function handleApprove(p: Purchase) {
    const ok = await confirm({ title: "Approve this purchase?", message: "It will count toward the project's total.", confirmLabel: "Approve" });
    if (!ok) return;
    try {
      await purchasesApi.approve(p.id);
      toast.success("Purchase approved.");
      refreshAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  async function handleReject(p: Purchase) {
    const reason = window.prompt(`Reason for rejecting "${p.description}":`);
    if (!reason) return;
    try {
      await purchasesApi.reject(p.id, reason);
      toast.success("Purchase rejected.");
      refreshAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  if (projectQuery.isLoading) {
    return (
      <div className="mx-auto max-w-[1200px] space-y-4 p-6 md:p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  if (projectQuery.error || !projectQuery.data) {
    return (
      <div className="mx-auto max-w-[1200px] p-6 md:p-8">
        <EmptyState title="Couldn't load this project" subtitle={(projectQuery.error as Error)?.message} action={<Button onClick={() => router.push("/projects")}>Back to projects</Button>} />
      </div>
    );
  }

  const project = projectQuery.data;
  const items = purchasesQuery.data?.items ?? [];

  return (
    <div className="mx-auto max-w-[1200px] p-6 md:p-8">
      <Button variant="ghost" size="sm" className="mb-4 -ml-2" onClick={() => router.push("/projects")}>
        <ArrowLeft className="h-4 w-4" />
        Projects
      </Button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl shadow-sm"
            style={{ backgroundColor: `${colorForKey(project.id)}29` }}
          >
            {project.icon || "📁"}
          </div>
          <div>
            <h1 className="text-2xl font-semibold">{project.name}</h1>
            {project.description && <p className="mt-0.5 max-w-lg text-sm text-muted-foreground">{project.description}</p>}
            <p className="mt-1 text-xs text-muted-foreground">Created {format(new Date(project.createdAt), "MMM d, yyyy")}</p>
          </div>
        </div>
        {can.canAddPurchases && (
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Add purchase
          </Button>
        )}
      </div>

      <div className={`mb-6 grid gap-4 ${project.budget != null ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"}`}>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total spent</p>
            <p className="mt-1 text-2xl font-bold">{currency.format(project.totalSpent)}</p>
          </CardContent>
        </Card>
        {project.budget != null && (
          <>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Budget</p>
                <p className="mt-1 text-2xl font-bold">{currency.format(project.budget)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Remaining</p>
                <p className={`mt-1 text-2xl font-bold ${project.budget - project.totalSpent < 0 ? "text-destructive" : ""}`}>
                  {currency.format(project.budget - project.totalSpent)}
                </p>
              </CardContent>
            </Card>
          </>
        )}
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Auto-approve under</p>
            <p className="mt-1 text-2xl font-bold">{currency.format(project.autoApproveThreshold)}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="purchases">
        <TabsList>
          <TabsTrigger value="purchases">Purchases</TabsTrigger>
          <TabsTrigger value="team">
            <Users2 className="h-4 w-4" />
            Team
          </TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="purchases" className="mt-4">
          <div className="relative mb-4 max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search purchases…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
          </div>

          {purchasesQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState icon={Receipt} title="No purchases yet" subtitle={can.canAddPurchases ? "Log the first purchase for this project." : undefined} />
          ) : (
            <Card className="animate-fade-in-up overflow-hidden py-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <p className="font-medium">{p.description}</p>
                        {p.category && <p className="text-xs text-muted-foreground">{p.category}</p>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{p.vendor || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{format(new Date(p.purchasedAt), "MMM d, yyyy")}</TableCell>
                      <TableCell>
                        <StatusBadge status={p.status} />
                      </TableCell>
                      <TableCell className="text-right font-semibold">{currency.format(p.amount)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
                            <MoreVertical className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {can.canReviewPurchases && p.status === "pending" && (
                              <>
                                <DropdownMenuItem onClick={() => handleApprove(p)}>
                                  <Check className="h-4 w-4" />
                                  Approve
                                </DropdownMenuItem>
                                <DropdownMenuItem variant="destructive" onClick={() => handleReject(p)}>
                                  <X className="h-4 w-4" />
                                  Reject
                                </DropdownMenuItem>
                              </>
                            )}
                            {can.canEditPurchases && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditing(p);
                                  setDialogOpen(true);
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                            )}
                            {can.canEditPurchases && (
                              <DropdownMenuItem variant="destructive" onClick={() => handleDelete(p)}>
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="team" className="mt-4">
          <ProjectTeamTab projectId={id} canManage={can.canManageProjects} />
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <ProjectActivity projectId={id} />
        </TabsContent>
      </Tabs>

      <PurchaseDialog open={dialogOpen} onOpenChange={setDialogOpen} projectId={id} existing={editing} onSaved={refreshAll} />
    </div>
  );
}

function ProjectTeamTab({ projectId, canManage }: { projectId: string; canManage: boolean }) {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [roleId, setRoleId] = useState<string | undefined>(undefined);
  const [adding, setAdding] = useState(false);

  const membersQuery = useQuery({ queryKey: ["project-members", projectId], queryFn: () => projectsApi.members(projectId) });
  const usersQuery = useQuery({ queryKey: ["users", "for-team-tab"], queryFn: () => usersApi.list({ page: 1, limit: 100 }), enabled: canManage });
  const rolesQuery = useQuery({ queryKey: ["roles"], queryFn: () => rolesApi.list(), enabled: canManage });

  const members = membersQuery.data ?? [];
  const availablePeople = (usersQuery.data?.items ?? []).filter((u) => !members.some((m) => m.userId === u.id));

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["project-members", projectId] });
  }

  async function addMember() {
    if (!userId || !roleId) return;
    setAdding(true);
    try {
      await projectsApi.addMember(projectId, userId, roleId);
      toast.success("Team member added.");
      setUserId(undefined);
      setRoleId(undefined);
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setAdding(false);
    }
  }

  async function removeMember(memberUserId: string, name: string) {
    const ok = await confirm({ title: `Remove ${name} from this project?`, confirmLabel: "Remove", tone: "destructive", message: "They'll lose any project-specific role here." });
    if (!ok) return;
    try {
      await projectsApi.removeMember(projectId, memberUserId);
      toast.success("Removed from project.");
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex flex-wrap items-center gap-2">
          <Select value={userId} onValueChange={(v) => setUserId(v ?? undefined)}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Person" />
            </SelectTrigger>
            <SelectContent>
              {availablePeople.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={roleId} onValueChange={(v) => setRoleId(v ?? undefined)}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Role on this project" />
            </SelectTrigger>
            <SelectContent>
              {(rolesQuery.data ?? []).map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" disabled={!userId || !roleId || adding} onClick={addMember}>
            <UserPlus className="h-4 w-4" />
            Add
          </Button>
        </div>
      )}

      {membersQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : members.length === 0 ? (
        <EmptyState icon={Users2} title="No one assigned yet" subtitle={canManage ? "Add people above to assign them to this project." : undefined} />
      ) : (
        <Card className="animate-fade-in-up divide-y p-0">
          <CardContent className="divide-y p-0">
            {members.map((m) => (
              <div key={m.userId} className="flex items-center gap-3 px-4 py-3">
                <ColoredAvatar name={m.userName} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{m.userName}</p>
                  <p className="truncate text-xs text-muted-foreground">{m.roleName}</p>
                </div>
                {canManage && (
                  <Button variant="ghost" size="icon-sm" onClick={() => removeMember(m.userId, m.userName)}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ProjectActivity({ projectId }: { projectId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["audit", "project", projectId],
    queryFn: () => auditLogApi.list({ projectId, page: 1, limit: 50 }),
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }
  if (error) return <EmptyState title="Couldn't load activity" subtitle={(error as Error).message} />;
  if (!data || data.items.length === 0) return <EmptyState title="No activity yet" />;

  return (
    <Card className="animate-fade-in-up divide-y p-0">
      <CardContent className="divide-y p-0">
        {data.items.map((entry) => (
          <div key={entry.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <span className="font-medium">{entry.actorName}</span> {entry.action.replaceAll("_", " ")}
              </p>
              <p className="text-xs text-muted-foreground">{format(new Date(entry.createdAt), "MMM d, yyyy · h:mm a")}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
