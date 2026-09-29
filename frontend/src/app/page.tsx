"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";

export default function RootPage() {
  const router = useRouter();
  const session = useSession();

  useEffect(() => {
    if (session.status === "loggedIn") router.replace("/dashboard");
    else if (session.status === "mustChangePassword") router.replace("/change-password");
    else if (session.status === "loggedOut") router.replace("/login");
  }, [session.status, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">
        {session.serverStatus === "waking" ? "Waking up the server… this can take up to a minute the first time." : "Loading…"}
      </p>
    </div>
  );
}
