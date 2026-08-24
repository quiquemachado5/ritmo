"use client";

import * as React from "react";
import { DataProvider } from "@/lib/store/provider";
import { QuickLogProvider } from "./quick-log-provider";
import { AppShell } from "./app-shell";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <DataProvider>
      <QuickLogProvider>
        <AppShell>{children}</AppShell>
      </QuickLogProvider>
    </DataProvider>
  );
}
