import { ChevronDown } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Revelado progresivo para datos secundarios: inspirado en los accordions y
 * panel-reveals de bibliotecas UI, adaptado a los tokens y ritmo de la app.
 */
export function RitmoDisclosure({ title, openLabel = "Abrir", className, children }: { title: string; openLabel?: string; className?: string; children: React.ReactNode }) {
  return <details className={cn("group border-t border-border", className)}>
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-semibold transition-colors hover:bg-secondary/35 sm:px-7">
      <span>{title}</span><span className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><span className="group-open:hidden">{openLabel}</span><span className="hidden group-open:inline">Cerrar</span><ChevronDown className="size-4 transition-transform duration-200 group-open:rotate-180" /></span>
    </summary>
    <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 ease-out group-open:grid-rows-[1fr]"><div className="overflow-hidden">{children}</div></div>
  </details>;
}
