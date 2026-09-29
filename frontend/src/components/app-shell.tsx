"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, FolderKanban, ClipboardCheck, BarChart3, Users, UserCircle } from "lucide-react";
import { useSession } from "@/lib/session";
import { roleCan } from "@/types";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useSession();

  if (session.status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">
          {session.serverStatus === "waking" ? "Waking up the server… this can take up to a minute the first time." : "Loading…"}
        </p>
      </div>
    );
  }
  if (session.status === "loggedOut") {
    router.replace("/login");
    return null;
  }
  if (session.status === "mustChangePassword") {
    router.replace("/change-password");
    return null;
  }

  const role = session.user!.role;
  const can = roleCan(role);
  const items: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/projects", label: "Projects", icon: FolderKanban },
    ...(can.canReviewPurchases ? [{ href: "/review", label: "Review", icon: ClipboardCheck }] : []),
    ...(can.canExport ? [{ href: "/reports", label: "Reports", icon: BarChart3 }] : []),
    ...(can.canManageUsers || can.canSeeActivityLog ? [{ href: "/team", label: "Team", icon: Users }] : []),
  ];

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 flex-col border-r bg-muted/20 px-3 py-4">
        <div className="mb-6 flex items-center gap-2 px-2">
          <Image src="/logo.png" alt="" width={32} height={32} className="rounded-lg shadow-sm" priority />
          <span className="font-semibold">CPA</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {items.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                  active
                    ? "bg-primary/15 text-primary shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground hover:translate-x-0.5",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex flex-col gap-2">
          <ThemeToggle className="self-start" />
          <Link
            href="/profile"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
              pathname.startsWith("/profile")
                ? "bg-primary/15 text-primary shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground hover:translate-x-0.5",
            )}
          >
            <UserCircle className="h-4 w-4" />
            Profile
          </Link>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
