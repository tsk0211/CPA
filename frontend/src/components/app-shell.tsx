"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, FolderKanban, ClipboardCheck, BarChart3, Users, UserCircle, Menu } from "lucide-react";
import { useSession } from "@/lib/session";
import { roleCan } from "@/types";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { assetPath } from "@/lib/asset-path";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useSession();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Desktop/tablet-landscape: permanent sidebar. This app was built
          desktop-first and the fixed-width sidebar-beside-content layout
          simply doesn't fit a phone-width viewport — below md it's
          replaced by the header + slide-in drawer below instead of
          shrinking in place (which is what made it look "sandwiched":
          the main content squeezed into whatever was left over). */}
      <aside className="hidden w-56 shrink-0 flex-col border-r bg-muted/20 px-3 py-4 md:flex">
        <NavContent pathname={pathname} items={items} />
      </aside>

      {/* Mobile/tablet-portrait: top bar with a hamburger opening the same
          nav as a slide-in drawer, instead of a persistent sidebar. */}
      <header className="flex items-center justify-between border-b bg-background px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- next/image's basePath prefixing doesn't apply reliably here; see lib/asset-path.ts */}
          <img src={assetPath("/logo.png")} alt="" width={28} height={28} className="rounded-lg shadow-sm" />
          <span className="font-semibold">CPA</span>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button variant="outline" size="icon" onClick={() => setMobileNavOpen(true)} aria-label="Open menu">
            <Menu className="h-4 w-4" />
          </Button>
        </div>
      </header>
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">App navigation menu</SheetDescription>
          <div className="flex h-full flex-col px-3 py-4">
            <NavContent pathname={pathname} items={items} onNavigate={() => setMobileNavOpen(false)} showThemeToggle={false} />
          </div>
        </SheetContent>
      </Sheet>

      <main className="min-w-0 flex-1 overflow-auto">{children}</main>
    </div>
  );
}

function NavContent({
  pathname,
  items,
  onNavigate,
  showThemeToggle = true,
}: {
  pathname: string;
  items: NavItem[];
  onNavigate?: () => void;
  showThemeToggle?: boolean;
}) {
  return (
    <>
      <div className="mb-6 hidden items-center gap-2 px-2 md:flex">
        {/* eslint-disable-next-line @next/next/no-img-element -- next/image's basePath prefixing doesn't apply reliably here; see lib/asset-path.ts */}
        <img src={assetPath("/logo.png")} alt="" width={32} height={32} className="rounded-lg shadow-sm" />
        <span className="font-semibold">CPA</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 md:py-2",
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
        {showThemeToggle && <ThemeToggle className="self-start" />}
        <Link
          href="/profile"
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 md:py-2",
            pathname.startsWith("/profile")
              ? "bg-primary/15 text-primary shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground hover:translate-x-0.5",
          )}
        >
          <UserCircle className="h-4 w-4" />
          Profile
        </Link>
      </div>
    </>
  );
}
