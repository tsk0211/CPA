"use client";

import Link from "next/link";
import { KeyRound, LogOut } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ColoredAvatar } from "@/components/colored-avatar";
import { useSession } from "@/lib/session";
import { useConfirm } from "@/components/confirm-dialog";
import { roleLabel } from "@/types";

export default function ProfilePage() {
  const session = useSession();
  const confirm = useConfirm();
  const user = session.user!;

  async function handleLogout() {
    const ok = await confirm({
      title: "Log out?",
      message: "You'll need to sign in again to continue.",
      confirmLabel: "Log out",
      tone: "destructive",
    });
    if (ok) session.logout();
  }

  return (
    <div className="mx-auto max-w-md p-6 md:p-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <ColoredAvatar name={user.name} size={72} />
        <div>
          <p className="text-lg font-semibold">{user.name}</p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">{roleLabel[user.role]}</span>
      </div>

      <Card className="mt-8">
        <CardContent className="p-0">
          <Link href="/change-password" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted/50">
            <KeyRound className="h-4 w-4" />
            Change password
          </Link>
          <Separator />
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-destructive hover:bg-destructive/5"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
