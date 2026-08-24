"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { useRitmo } from "@/lib/store/provider";
import { useQuickLog } from "@/components/app/quick-log-provider";
import { resumen } from "@/lib/model/analytics";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Metric, SectionLabel, Chip, EmptyState } from "@/components/app/primitives";
import { fmtPeso, fmtNum, fmtFechaCorta, relativo } from "@/lib/format";
import { hoy } from "@/lib/model/dates";
import { cn } from "@/lib/utils";

const TONO: Record<string, "weight" | "warning" | "energy"> = { good: "weight", warn: "warning", bad: "energy" };

export default function CuerpoPage() {
  const { estado, cargando, borrarMedicion } = useRitmo();
  const { abrir } = useQuickLog();
  const r = React.useMemo(() => resumen(estado), [estado]);

  if (cargando) return <div className="flex flex-col gap-6"><Skeleton className="h-8 w-40" /><Skeleton className="h-40 w-full rounded-xl" /></div>;

  const comp = r.composicion;
  const mediciones = [...estado.composicion].sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  const ultima = mediciones[0];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold tracking-tight">Cuerpo</h1>
        <Button onClick={() => abrir("medidas")} size="sm" className="gap-1.5">
          <Plus className="size-4" /> Medir
        </Button>
      </header>

      {/* Estado actual */}
      <section>
        <SectionLabel>Estado actual</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4">
            <Metric label="Peso estimado" value={fmtPeso(r.peso.estimadoHoy)} unit="kg" tone="weight" />
          </Card>
          <Card className="p-4">
            {r.imc ? (
              <Metric
                label="IMC"
                value={fmtNum(r.imc.valor, 1)}
                hint={<Chip tone={r.imc.categoria ? TONO[r.imc.categoria.tono] : "muted"}>{r.imc.categoria?.etiqueta}</Chip>}
              />
            ) : (
              <Metric label="IMC" value="—" />
            )}
          </Card>
        </div>
      </section>

      {/* Composición */}
      <section>
        <SectionLabel>Composición corporal</SectionLabel>
        {comp ? (
          <Card className="p-5">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Metric label="Grasa" value={fmtNum(comp.grasaPct, 1)} unit="%" tone="body" />
              <Metric label="Masa grasa" value={fmtPeso(comp.grasaKg)} unit="kg" tone="body" />
              <Metric label="Masa magra" value={fmtPeso(comp.magraKg)} unit="kg" tone="weight" />
              <Metric label="FFMI" value={comp.ffmi != null ? fmtNum(comp.ffmi, 1) : "—"} />
            </div>
            <div className="mt-4 border-t border-border pt-4">
              <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
                <span>Rango saludable de grasa ({estado.perfil.sexo})</span>
                <span className="tabular">{comp.rango.min}–{comp.rango.max}%</span>
              </div>
              <RangoGrasa valor={comp.grasaPct} rango={comp.rango} />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Medición del {fmtFechaCorta(comp.fecha)} · {relativo(comp.fecha, hoy())}</p>
          </Card>
        ) : (
          <EmptyState title="Sin mediciones de composición" action={<Button onClick={() => abrir("medidas")} className="mt-1 gap-2"><Plus className="size-4" /> Añadir medición</Button>}>
            Registra grasa corporal y medidas para ver tu composición. El peso solo no basta.
          </EmptyState>
        )}
      </section>

      {/* Medidas */}
      {ultima && (ultima.cintura || ultima.cadera || ultima.pecho || ultima.brazo || ultima.muslo) && (
        <section>
          <SectionLabel>Medidas (cm)</SectionLabel>
          <Card className="grid grid-cols-3 gap-4 p-5 sm:grid-cols-5">
            {([["Cintura", ultima.cintura], ["Cadera", ultima.cadera], ["Pecho", ultima.pecho], ["Brazo", ultima.brazo], ["Muslo", ultima.muslo]] as const)
              .filter(([, v]) => v != null)
              .map(([label, v]) => (
                <Metric key={label} label={label} value={fmtNum(v!, 0)} />
              ))}
          </Card>
        </section>
      )}

      {/* Histórico */}
      {mediciones.length > 0 && (
        <section>
          <SectionLabel>Histórico de mediciones</SectionLabel>
          <Card className="divide-y divide-border p-0">
            {mediciones.slice(0, 24).map((m) => (
              <div key={m.fecha} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-baseline gap-3">
                  <span className="text-sm font-medium tabular">{fmtFechaCorta(m.fecha)}</span>
                  <span className="text-sm tabular text-weight">{fmtPeso(m.peso)} kg</span>
                  {m.grasaPct != null && <span className="text-sm tabular text-body">{fmtNum(m.grasaPct, 1)}%</span>}
                </div>
                <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" onClick={() => borrarMedicion(m.fecha)} aria-label="Eliminar">
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}

function RangoGrasa({ valor, rango }: { valor: number; rango: { min: number; max: number; atleta: number } }) {
  const escala = Math.max(rango.max + 12, valor + 4);
  const pos = Math.min(100, (valor / escala) * 100);
  const zonaMin = (rango.min / escala) * 100;
  const zonaMax = (rango.max / escala) * 100;
  return (
    <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-secondary">
      <div className="absolute inset-y-0 rounded-full bg-weight/30" style={{ left: `${zonaMin}%`, width: `${zonaMax - zonaMin}%` }} />
      <div className={cn("absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-body")} style={{ left: `${pos}%` }} />
    </div>
  );
}
