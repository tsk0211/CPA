"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { SessionProvider } from "@/lib/session";
import { CurrencyProvider } from "@/lib/currency";
import { Toaster } from "@/components/ui/sonner";
import { ConfirmProvider } from "@/components/confirm-dialog";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <CurrencyProvider>
          <ConfirmProvider>
            {children}
            <Toaster />
          </ConfirmProvider>
        </CurrencyProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}
