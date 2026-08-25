"use client";

import * as React from "react";
import { DataProvider } from "@/lib/store/provider";
import { QuickLogProvider } from "./quick-log-provider";
import { AppShell } from "./app-shell";
import { OfflineBanner } from "./offline-banner";
import { ServiceWorkerRegister } from "./sw-register";
import { AutoBackup } from "./auto-backup";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <DataProvider>
      <QuickLogProvider>
        <ServiceWorkerRegister />
        <AutoBackup />
        <OfflineBanner />
        <AppShell>{children}</AppShell>
      </QuickLogProvider>
    </DataProvider>
  );
}
