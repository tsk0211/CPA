"use client";

// Mirrors lib/state/app_currency.dart on the Flutter side: the server is
// the source of truth for which currency to display (GET /config), not
// each client's own guess from device/browser locale — that's exactly how
// this app ended up silently showing USD ($) for users in India. Cached in
// localStorage so it still renders correctly on a reload before /config
// resolves, or if the device is briefly offline.

import { createContext, useContext, useEffect, useState } from "react";
import { API_BASE_URL } from "./api/client";

const CACHE_KEY = "cpa_cached_currency_code";
const DEFAULT_CURRENCY = "INR"; // matches the server's own default (config/app.ts)

const CurrencyContext = createContext<string>(DEFAULT_CURRENCY);

export function useCurrencyCode(): string {
  return useContext(CurrencyContext);
}

export function useCurrencyFormatter() {
  const code = useCurrencyCode();
  return new Intl.NumberFormat(undefined, { style: "currency", currency: code });
}

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [code, setCode] = useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT_CURRENCY;
    return localStorage.getItem(CACHE_KEY) ?? DEFAULT_CURRENCY;
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/config`);
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled && json.currencyCode) {
          setCode(json.currencyCode);
          localStorage.setItem(CACHE_KEY, json.currencyCode);
        }
      } catch {
        // Best-effort — stay on the cached/default value if unreachable.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return <CurrencyContext.Provider value={code}>{children}</CurrencyContext.Provider>;
}
