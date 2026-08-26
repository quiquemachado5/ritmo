"use client";

import * as React from "react";
import { Users } from "lucide-react";

export function UserCount({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  const [count, setCount] = React.useState<number | null>(null);
  React.useEffect(() => {
    void fetch("/api/usuarios").then((r) => r.json()).then((data: { count?: unknown }) => {
      if (typeof data.count === "number" && data.count > 0) setCount(data.count);
    }).catch(() => undefined);
  }, []);
  if (count == null) return null;
  const numero = new Intl.NumberFormat("es-ES").format(count);
  return (
    <span aria-label={numero + " usuarios en RITMO"} className={`inline-flex items-center gap-1.5 text-[0.68rem] font-medium text-muted-foreground ${className}`}>
      <Users className="size-3.5 text-primary" />
      {numero}{!compact && " usuarios"}
    </span>
  );
}
