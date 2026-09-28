"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api, checkHealth, clearTokens, isLoggedIn, loadPersistedTokens, login as apiLogin, logout as apiLogout, setOnSessionExpired } from "./api/client";
import type { AppUser } from "@/types";

type SessionStatus = "loading" | "loggedOut" | "mustChangePassword" | "loggedIn";

interface SessionState {
  status: SessionStatus;
  user: AppUser | null;
  serverStatus: "idle" | "waking" | "live";
  login: (email: string, password: string, rememberMe: boolean) => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession() called with no SessionProvider ancestor");
  return ctx;
}

// Mirrors lib/state/session.dart's bootstrap(): loads any stored refresh
// token, and — since there's no cached-identity concept on web the way the
// mobile app needs for offline field use — waits behind a visible "waking
// up the server" state (same /health poll Login uses) before calling /me,
// so a Render cold start on first page load doesn't just hang.
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [user, setUser] = useState<AppUser | null>(null);
  const [serverStatus, setServerStatus] = useState<"idle" | "waking" | "live">("idle");
  const bootstrapped = useRef(false);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    setOnSessionExpired(() => {
      setUser(null);
      setStatus("loggedOut");
    });

    (async () => {
      loadPersistedTokens();
      if (!isLoggedIn()) {
        setStatus("loggedOut");
        return;
      }

      setServerStatus("waking");
      const maxAttempts = 30; // ~90s at 3s apart
      let live = false;
      for (let i = 0; i < maxAttempts && !live; i++) {
        live = await checkHealth();
        if (!live) await new Promise((r) => setTimeout(r, 3000));
      }
      if (live) setServerStatus("live");

      try {
        const me = (await api.get("/auth/me")) as AppUser;
        setUser(me);
        setStatus(me.mustChangePassword ? "mustChangePassword" : "loggedIn");
      } catch {
        setStatus("loggedOut");
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string, rememberMe: boolean) => {
    const raw = await apiLogin(email, password, rememberMe);
    const nextUser: AppUser = { id: raw.id, name: raw.name, email: raw.email, role: raw.role as AppUser["role"], mustChangePassword: raw.mustChangePassword };
    setUser(nextUser);
    setStatus(nextUser.mustChangePassword ? "mustChangePassword" : "loggedIn");
  }, []);

  const changePassword = useCallback(
    async (current: string, next: string) => {
      await api.post("/auth/change-password", { currentPassword: current, newPassword: next });
      if (user) setUser({ ...user, mustChangePassword: false });
      setStatus("loggedIn");
    },
    [user],
  );

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
    setStatus("loggedOut");
  }, []);

  return (
    <SessionContext.Provider value={{ status, user, serverStatus, login, changePassword, logout }}>{children}</SessionContext.Provider>
  );
}

export { clearTokens };
