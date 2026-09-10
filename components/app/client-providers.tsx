"use client";

import * as React from "react";
import { DataProvider } from "@/lib/store/provider";
import { QuickLogProvider } from "./quick-log-provider";
import { AppShell } from "./app-shell";
import { OfflineBanner } from "./offline-banner";
import { ServiceWorkerRegister } from "./sw-register";
import { AutoBackup } from "./auto-backup";
import { PlatformProvider } from "./platform-provider";
import type { PlatformConfig } from "@/lib/platform/config";

export function ClientProviders({ children, isAdmin, platformConfig }: { children: React.ReactNode; isAdmin: boolean; platformConfig: PlatformConfig }) {
  return (
    <PlatformProvider config={platformConfig}>
      <DataProvider>
        <QuickLogProvider>
          <ServiceWorkerRegister />
          <AutoBackup />
          <OfflineBanner />
          <AppShell isAdmin={isAdmin}>{children}</AppShell>
        </QuickLogProvider>
      </DataProvider>
    </PlatformProvider>
  );
}
