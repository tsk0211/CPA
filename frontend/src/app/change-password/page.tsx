"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/lib/session";
import { ApiException, NetworkUnavailableException } from "@/lib/api/client";

export default function ChangePasswordPage() {
  const router = useRouter();
  const session = useSession();
  const forced = session.status === "mustChangePassword";
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session.status === "loggedOut") router.replace("/login");
  }, [session.status, router]);

  async function submit() {
    if (next.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await session.changePassword(current, next);
      if (!forced) router.push("/profile");
    } catch (e) {
      if (e instanceof ApiException) setError(e.message);
      else if (e instanceof NetworkUnavailableException) setError("Can't reach the server. Check your connection and try again.");
      else setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-sm space-y-6">
        {forced && (
          <div className="space-y-1 text-center">
            <h1 className="text-2xl font-semibold">Set your password</h1>
            <p className="text-sm text-muted-foreground">You&apos;re using a temporary password. Choose a new one to continue.</p>
          </div>
        )}
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-2">
              <Label htmlFor="current">{forced ? "Temporary password" : "Current password"}</Label>
              <Input id="current" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} />
              {forced && <p className="text-xs text-muted-foreground">The one-time password you just logged in with</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="next">New password</Label>
              <Input
                id="next"
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
              <p className="text-xs text-muted-foreground">At least 8 characters</p>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="w-full" disabled={submitting} onClick={submit}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
