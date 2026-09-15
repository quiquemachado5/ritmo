"use client";

import { useReportWebVitals } from "next/web-vitals";
import { registrarRendimiento } from "@/lib/observability";

export function WebVitals() {
  useReportWebVitals(registrarRendimiento);
  return null;
}
