"use client";

import * as React from "react";
import { DataProvider } from "@/lib/store/provider";
import { QuickLogProvider } from "./quick-log-provider";
import { AppShell } from "./app-shell";
import { OfflineBanner } from "./offline-banner";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <DataProvider>
      <QuickLogProvider>
        <OfflineBanner />
        <AppShell>{children}</AppShell>
      </QuickLogProvider>
    </DataProvider>
  );
}
