import { History } from "lucide-react";
import { fmtFechaCorta, fmtPeso, fmtSigno } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MemoriaCorporal } from "@/lib/model/insights";

export function BodyMemory({ memoria }: { memoria: MemoriaCorporal }) {
  const diferencia = memoria.constanciaActual - memoria.constanciaAnterior;
  return (
    <section aria-labelledby="memoria-titulo" className="body-memory-surface overflow-hidden rounded-2xl border border-weight-border p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex max-w-2xl items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-weight text-weight-foreground"><History className="size-4" /></span><div><h2 id="memoria-titulo" className="font-display text-xl font-bold">Ya habías pasado por este peso</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">El {fmtFechaCorta(memoria.fechaAnterior)} registraste {fmtPeso(memoria.pesoAnterior)} kg. Hoy vuelves a {fmtPeso(memoria.pesoActual)} kg, {memoria.diasEntre} días después.</p></div></div>
        <div className="shrink-0 sm:text-right"><p className="text-xs text-muted-foreground">Constancia al llegar</p><p className={cn("mt-1 font-display text-2xl font-bold tabular", diferencia >= 0 ? "text-weight" : "text-energy")}>{fmtSigno(diferencia, 0)} pts</p><p className="text-[0.66rem] text-muted-foreground">frente a aquella etapa</p></div>
      </div>
    </section>
  );
}
