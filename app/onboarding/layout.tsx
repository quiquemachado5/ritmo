"use client";

import { DataProvider } from "@/lib/store/provider";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <DataProvider>{children}</DataProvider>;
}
