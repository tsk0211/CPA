"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { Plus, Search, MoreVertical, ShieldCheck, UserX, Download, Users2, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import { ColoredAvatar } from "@/components/colored-avatar";
import { useSession } from "@/lib/session";
import { useConfirm } from "@/components/confirm-dialog";
import { usersApi } from "@/lib/api/users";
import { auditLogApi } from "@/lib/api/auditLog";
import { projectsApi } from "@/lib/api/projects";
import { roleCan, roleLabel, type TeamMember } from "@/types";
import { InviteMemberDialog } from "./invite-member-dialog";
import { ChangeRoleDialog } from "./change-role-dialog";

export default function TeamPage() {
  const session = useSession();
  const can = roleCan(session.user!.role);

  if (can.canManageUsers) {
    return (
      <div className="mx-auto max-w-[1200px] p-6 md:p-8">
        <h1 className="mb-6 text-2xl font-semibold">Team</h1>
        <Tabs defaultValue="members">
          <TabsList>
            <TabsTrigger value="members">
              <Users2 className="h-4 w-4" />
              Members
            </TabsTrigger>
            <TabsTrigger value="activity">
              <History className="h-4 w-4" />
              Activity
            </TabsTrigger>
          </TabsList>
          <TabsContent value="members" className="mt-4">
            <MembersTab />
          </TabsContent>
          <TabsContent value="activity" className="mt-4">
            <ActivityTab canExport={can.canExport} />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] p-6 md:p-8">
      <h1 className="mb-6 text-2xl font-semibold">Activity</h1>
      <ActivityTab canExport={can.canExport} />
    </div>
  );
}

function MembersTab() {
  const confirm = useConfirm();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState<TeamMember | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["users", search],
    queryFn: () => usersApi.list({ page: 1, limit: 100, search }),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["users"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }

  async function handleDeactivate(member: TeamMember) {
    const ok = await confirm({
      title: `Deactivate ${member.name}?`,
      message: "They'll lose access immediately. This can't be undone from here.",
      confirmLabel: "Deactivate",
      tone: "destructive",
    });
    if (!ok) return;
    try {
      await usersApi.deactivate(member.id);
      toast.success("Member deactivated.");
      invalidate();
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  const items = data?.items ?? [];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:w-auto">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search members…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-8 sm:w-56" />
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <Plus className="h-4 w-4" />
          Invite member
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <EmptyState title="Couldn't load the team" subtitle={(error as Error).message} action={<Button onClick={() => refetch()}>Retry</Button>} />
      ) : items.length === 0 ? (
        <EmptyState icon={Users2} title="No members yet" subtitle="Invite your first teammate to get started." action={<Button onClick={() => setInviteOpen(true)}>Invite member</Button>} />
      ) : (
        <Card className="animate-fade-in-up overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <ColoredAvatar name={member.name} size={32} />
                      <span className="font-medium">{member.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{member.email}</TableCell>
                  <TableCell className="text-muted-foreground">{roleLabel[member.role]}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
                        <MoreVertical className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setRoleTarget(member)}>
                          <ShieldCheck className="h-4 w-4" />
                          Change role
                        </DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onClick={() => handleDeactivate(member)}>
                          <UserX className="h-4 w-4" />
                          Deactivate
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <InviteMemberDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onSaved={() => {
          invalidate();
          refetch();
        }}
      />
      <ChangeRoleDialog
        open={roleTarget !== null}
        onOpenChange={(open) => !open && setRoleTarget(null)}
        member={roleTarget}
        onSaved={() => {
          invalidate();
          refetch();
        }}
      />
    </>
  );
}

const ALL_PROJECTS = "__all__";

function ActivityTab({ canExport }: { canExport: boolean }) {
  const [projectId, setProjectId] = useState<string>(ALL_PROJECTS);
  const [exporting, setExporting] = useState(false);

  const projectsQuery = useQuery({ queryKey: ["projects", "for-filter"], queryFn: () => projectsApi.list({ page: 1, limit: 100 }) });
  const filters = { page: 1, limit: 100, projectId: projectId === ALL_PROJECTS ? undefined : projectId };
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["audit", "all", projectId],
    queryFn: () => auditLogApi.list(filters),
  });

  async function handleExport() {
    setExporting(true);
    try {
      const { blob, filename } = await auditLogApi.export(filters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Select value={projectId} onValueChange={(v) => setProjectId(v ?? ALL_PROJECTS)}>
          <SelectTrigger className="w-56">
            {/* SelectValue with no children just prints the raw stored
                value (a project id) — it has no way to know the label
                unless told, so this maps it back to "icon + name". */}
            <SelectValue>
              {(value: string) => {
                if (value === ALL_PROJECTS) return "All projects";
                const project = projectsQuery.data?.items.find((p) => p.id === value);
                return project ? `${project.icon} ${project.name}` : value;
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_PROJECTS}>All projects</SelectItem>
            {projectsQuery.data?.items.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.icon} {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canExport && (
          <Button variant="outline" onClick={handleExport} disabled={exporting}>
            <Download className="h-4 w-4" />
            Export
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <EmptyState title="Couldn't load activity" subtitle={(error as Error).message} action={<Button onClick={() => refetch()}>Retry</Button>} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState icon={History} title="No activity yet" />
      ) : (
        <Card className="animate-fade-in-up divide-y p-0">
          <CardContent className="divide-y p-0">
            {data.items.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3 px-4 py-3">
                <ColoredAvatar name={entry.actorName} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-medium">{entry.actorName}</span>{" "}
                    <span className="text-muted-foreground">({roleLabel[entry.actorRole as keyof typeof roleLabel] ?? entry.actorRole})</span>{" "}
                    {entry.action.replaceAll("_", " ")} <span className="text-muted-foreground">{entry.entityType}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{format(new Date(entry.createdAt), "MMM d, yyyy · h:mm a")}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}
