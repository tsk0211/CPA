"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { checkHealth } from "@/lib/api/client";
import { useSession } from "@/lib/session";
import { ApiException, NetworkUnavailableException } from "@/lib/api/client";

type ServerStatus = "idle" | "waking" | "live";

export default function LoginPage() {
  const router = useRouter();
  const session = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverStatus, setServerStatus] = useState<ServerStatus>("idle");
  const formEnabled = serverStatus === "live";

  useEffect(() => {
    if (session.status === "loggedIn") router.replace("/dashboard");
    if (session.status === "mustChangePassword") router.replace("/change-password");
  }, [session.status, router]);

  async function start() {
    setServerStatus("waking");
    const poll = async () => {
      const alive = await checkHealth();
      if (alive) {
        setServerStatus("live");
        return true;
      }
      return false;
    };
    if (await poll()) return;
    const interval = setInterval(async () => {
      if (await poll()) clearInterval(interval);
    }, 3000);
  }

  async function submit() {
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await session.login(email.trim(), password, rememberMe);
      // Redirect handled by the effect above once session.status updates.
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
        <div className="flex flex-col items-center text-center gap-3">
          <Image src="/logo.png" alt="" width={72} height={72} priority />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">CPA</h1>
            <p className="text-muted-foreground text-sm">Cash Purchase Accounting</p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <span
              className={`h-3 w-3 rounded-full ${
                serverStatus === "live" ? "bg-green-500" : serverStatus === "waking" ? "bg-amber-500 animate-pulse" : "bg-red-500"
              }`}
            />
            <span className="text-sm text-muted-foreground">
              {serverStatus === "live" ? "Server is live" : serverStatus === "waking" ? "Waking up the server…" : "Server not checked yet"}
            </span>
          </div>
          <Button variant="outline" size="sm" disabled={serverStatus !== "idle"} onClick={start}>
            {serverStatus === "waking" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {serverStatus === "live" ? "Ready" : "Start"}
          </Button>
        </div>

        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" disabled={!formEnabled} value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                disabled={!formEnabled}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && formEnabled && submit()}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="remember" disabled={!formEnabled} checked={rememberMe} onCheckedChange={(v) => setRememberMe(v === true)} />
              <Label htmlFor="remember" className="font-normal">
                Remember me on this device
              </Label>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="w-full" disabled={!formEnabled || submitting} onClick={submit}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Log in
            </Button>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">Accounts are created by your Owner or Admin — there&apos;s no self-signup.</p>
      </div>
    </div>
  );
}
