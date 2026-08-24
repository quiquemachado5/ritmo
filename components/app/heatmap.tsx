"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { TOTAL_HABITOS } from "@/lib/model/config";
import { nivelDia } from "@/lib/model/metrics";
import { diaSemanaLunes, hoy, sumarDias } from "@/lib/model/dates";
import { fmtFechaCorta } from "@/lib/format";
import type { Estado } from "@/lib/model/types";

const NIVEL_COLOR = [
  "bg-secondary",
  "bg-primary/25",
  "bg-primary/45",
  "bg-primary/70",
  "bg-primary",
];

/** Mapa de calor de constancia, estilo GitHub Contributions. */
export function Heatmap({
  estado,
  semanas,
  semanasMinimas = 26,
}: {
  estado: Estado;
  /** Nº fijo de semanas. Si se omite, abarca todo el historial registrado. */
  semanas?: number;
  semanasMinimas?: number;
}) {
  const scroller = React.useRef<HTMLDivElement>(null);

  const { columnas, meses, totalSemanas } = React.useMemo(() => {
    const hoyISO = hoy();

    // Sin `semanas` explícitas, el mapa arranca en el primer día registrado:
    // recortarlo a una ventana fija escondía el histórico importado.
    let nSemanas = semanas;
    if (nSemanas == null) {
      const fechas = Object.keys(estado.dias || {}).filter((f) => f <= hoyISO).sort();
      const primera = fechas[0];
      const dias = primera
        ? Math.round((Date.parse(`${hoyISO}T00:00:00Z`) - Date.parse(`${primera}T00:00:00Z`)) / 86_400_000)
        : 0;
      nSemanas = Math.max(semanasMinimas, Math.ceil((dias + diaSemanaLunes(hoyISO) + 1) / 7));
    }

    // Retrocede hasta el lunes de hace `nSemanas` semanas.
    const diasAtras = (nSemanas - 1) * 7 + diaSemanaLunes(hoyISO);
    const inicio = sumarDias(hoyISO, -diasAtras);

    const cols: Array<Array<{ fecha: string; nivel: number; futuro: boolean; cumplidos: number } | null>> = [];
    const etiquetasMes: Array<{ col: number; label: string }> = [];
    let cursor = inicio;
    for (let s = 0; s < nSemanas; s++) {
      const col: Array<{ fecha: string; nivel: number; futuro: boolean; cumplidos: number } | null> = [];
      for (let dow = 0; dow < 7; dow++) {
        const fecha = cursor;
        const dia = estado.dias[fecha];
        const futuro = fecha > hoyISO;
        const cumplidos = Object.values(dia?.habitos || {}).filter((v) => v === true).length;
        col.push({ fecha, nivel: nivelDia(dia?.habitos, TOTAL_HABITOS), futuro, cumplidos });
        if (dow === 0) {
          const mes = new Date(fecha).getMonth();
          const prev = etiquetasMes[etiquetasMes.length - 1];
          const label = new Intl.DateTimeFormat("es-ES", { month: "short" }).format(new Date(fecha));
          if (!prev || prev.label !== label) etiquetasMes.push({ col: s, label });
        }
        cursor = sumarDias(cursor, 1);
      }
      cols.push(col);
    }
    return { columnas: cols, meses: etiquetasMes, totalSemanas: nSemanas };
  }, [estado, semanas, semanasMinimas]);

  // Abre mostrando lo más reciente; el histórico queda a la izquierda.
  React.useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [totalSemanas]);

  return (
    <div
      ref={scroller}
      className="overflow-x-auto pb-2 [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]"
    >
      <div className="inline-flex flex-col gap-1">
        <div className="flex gap-[3px] pl-0 text-[0.6rem] text-muted-foreground">
          {columnas.map((_, i) => {
            const m = meses.find((x) => x.col === i);
            return (
              <div key={i} className="w-[13px] text-left">
                {m ? m.label : ""}
              </div>
            );
          })}
        </div>
        <div className="flex gap-[3px]">
          {columnas.map((col, i) => (
            <div key={i} className="flex flex-col gap-[3px]">
              {col.map((cell, j) =>
                cell && !cell.futuro ? (
                  <div
                    key={j}
                    title={`${fmtFechaCorta(cell.fecha)} · ${cell.cumplidos}/${TOTAL_HABITOS} hábitos`}
                    className={cn("size-[13px] rounded-[3px]", NIVEL_COLOR[cell.nivel])}
                  />
                ) : (
                  <div key={j} className="size-[13px] rounded-[3px] bg-transparent" />
                ),
              )}
            </div>
          ))}
        </div>
        <div className="mt-1 flex items-center justify-end gap-1.5 text-[0.65rem] text-muted-foreground">
          <span>menos</span>
          {NIVEL_COLOR.map((c, i) => (
            <span key={i} className={cn("size-[11px] rounded-[3px]", c)} />
          ))}
          <span>más</span>
        </div>
      </div>
    </div>
  );
}
