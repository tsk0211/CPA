"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search, MoreVertical, Pencil, Trash2, FolderX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/empty-state";
import { useCurrencyFormatter } from "@/lib/currency";
import { useSession } from "@/lib/session";
import { useConfirm } from "@/components/confirm-dialog";
import { projectsApi } from "@/lib/api/projects";
import { colorForKey } from "@/lib/colors";
import { roleCan } from "@/types";
import { ProjectDialog, type EditableProject } from "./project-dialog";
import { NewProjectWizard } from "./new-project-wizard";

export default function ProjectsPage() {
  const session = useSession();
  const currency = useCurrencyFormatter();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const can = roleCan(session.user!.role);

  const [search, setSearch] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EditableProject | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["projects", search],
    queryFn: () => projectsApi.list({ page: 1, limit: 100, search }),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }

  async function handleDelete(id: string, name: string) {
    const ok = await confirm({
      title: `Delete ${name}?`,
      message: "Its purchase history is kept but hidden from normal views.",
      confirmLabel: "Delete",
      tone: "destructive",
    });
    if (!ok) return;
    try {
      await projectsApi.delete(id);
      toast.success("Project deleted.");
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  const items = data?.items ?? [];

  return (
    <div className="mx-auto max-w-[1200px] p-6 md:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search projects…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-8 sm:w-56" />
          </div>
          {can.canManageProjects && (
            <Button onClick={() => setWizardOpen(true)}>
              <Plus className="h-4 w-4" />
              New project
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <EmptyState title="Couldn't load projects" subtitle={(error as Error).message} action={<Button onClick={() => refetch()}>Retry</Button>} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={FolderX}
          title="No projects yet"
          subtitle={can.canManageProjects ? "Create your first project to start tracking purchases." : "Ask an admin to add a project."}
          action={
            can.canManageProjects ? (
              <Button onClick={() => setWizardOpen(true)}>
                <Plus className="h-4 w-4" />
                New project
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid animate-fade-in-up grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((project) => (
            <Card key={project.id} className="group/proj relative transition-transform duration-150 hover:-translate-y-0.5">
              <CardContent className="flex items-center gap-3 pt-6">
                <Link href={`/projects/detail?id=${project.id}`} className="flex flex-1 items-center gap-3 min-w-0">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
                    style={{ backgroundColor: `${colorForKey(project.id)}29` }}
                  >
                    {project.icon || "📁"}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{project.name}</p>
                    <p className="text-sm text-muted-foreground">{currency.format(project.totalSpent)}</p>
                  </div>
                </Link>
                {can.canManageProjects && (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="ghost" size="icon-sm" className="shrink-0 opacity-0 transition-opacity group-hover/proj:opacity-100" />
                      }
                    >
                      <MoreVertical className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setEditing({
                            id: project.id,
                            name: project.name,
                            icon: project.icon,
                            description: project.description,
                            budget: project.budget,
                            autoApproveThreshold: project.autoApproveThreshold,
                          });
                          setEditDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onClick={() => handleDelete(project.id, project.name)}>
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ProjectDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        existing={editing}
        onSaved={() => {
          invalidate();
          refetch();
        }}
      />
      <NewProjectWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onCreated={() => {
          invalidate();
          refetch();
        }}
      />
    </div>
  );
}
