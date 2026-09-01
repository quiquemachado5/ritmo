"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { habitosModelo } from "@/lib/model/config";
import { DIAS_SEMANA, diaSemanaLunes, hoy, sumarDias } from "@/lib/model/dates";
import { capitalizar, fmtFechaLarga } from "@/lib/format";
import type { Estado } from "@/lib/model/types";

interface Celda {
  fecha: string;
  nivel: number;
  futuro: boolean;
  cumplidos: number;
  hechos: string[];
  total: number;
}

function etiquetaDia(c: Celda): string {
  const base = `${c.fecha} · ${c.cumplidos}/${c.total} hábitos`;
  return c.hechos.length ? `${base}: ${c.hechos.join(", ")}` : `${base} (ninguno)`;
}

const NIVEL_COLOR = [
  "bg-destructive/35 ring-1 ring-destructive/10",
  "bg-energy/35 ring-1 ring-energy/10",
  "bg-warning/42 ring-1 ring-warning/10",
  "bg-habit/42 ring-1 ring-habit/10",
  "bg-primary/38 ring-1 ring-primary/12",
  "bg-primary/68 ring-1 ring-primary/18",
  "bg-primary ring-1 ring-primary/30",
];

function colorCumplimiento(cumplidos: number, total: number) {
  const max = NIVEL_COLOR.length - 1;
  const nivel = Math.round((cumplidos / Math.max(1, total)) * max);
  return NIVEL_COLOR[Math.max(0, Math.min(max, nivel))];
}

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
  const [activo, setActivo] = React.useState<Celda | null>(null);

  const { columnas, meses, totalSemanas } = React.useMemo(() => {
    const hoyISO = hoy();
    const activos = habitosModelo(estado.perfil);
    const total = Math.max(1, activos.length);

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

    const cols: Array<Array<Celda | null>> = [];
    const etiquetasMes: Array<{ col: number; label: string }> = [];
    let cursor = inicio;
    for (let s = 0; s < nSemanas; s++) {
      const col: Array<Celda | null> = [];
      for (let dow = 0; dow < 7; dow++) {
        const fecha = cursor;
        const dia = estado.dias[fecha];
        const futuro = fecha > hoyISO;
        const hechos = activos.filter((h) => dia?.habitos?.[h.clave] === true).map((h) => h.etiqueta);
        col.push({ fecha, nivel: hechos.length, futuro, cumplidos: hechos.length, hechos, total });
        if (dow === 0) {
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
      className="max-w-full touch-pan-x overflow-x-auto overscroll-x-contain pb-2 [-webkit-overflow-scrolling:touch] [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]"
    >
      <div className="inline-flex min-w-max flex-col gap-2 pr-3">
        <div className="flex gap-1 text-xs text-muted-foreground">
          <div className="mr-2 w-9 shrink-0" />
          {columnas.map((_, i) => {
            const m = meses.find((x) => x.col === i);
            return (
              <div key={i} className="w-5 text-left sm:w-6">
                {m ? m.label : ""}
              </div>
            );
          })}
        </div>
        <div className="flex gap-1">
          {/* Inicial del día de la semana, para orientarse en la cuadrícula. */}
          <div className="mr-2 flex w-9 shrink-0 flex-col gap-1 text-xs leading-5 text-muted-foreground sm:leading-6">
            {DIAS_SEMANA.map((d, j) => (
              <span key={j} className="h-5 sm:h-6">{j % 2 === 0 ? d : ""}</span>
            ))}
          </div>
          {columnas.map((col, i) => (
            <div key={i} className="flex flex-col gap-1">
              {col.map((cell, j) =>
                cell && !cell.futuro ? (
                  <div
                    key={j}
                    tabIndex={0}
                    role="img"
                    aria-label={etiquetaDia(cell)}
                    title={etiquetaDia(cell)}
                    onMouseEnter={() => setActivo(cell)}
                    onFocus={() => setActivo(cell)}
                    onMouseLeave={() => setActivo(null)}
                    onBlur={() => setActivo(null)}
                    className={cn(
                      "size-5 cursor-default rounded-[4px] outline-none transition-shadow sm:size-6",
                      colorCumplimiento(cell.cumplidos, cell.total),
                      activo?.fecha === cell.fecha && "ring-2 ring-foreground/50",
                    )}
                  />
                ) : (
                  <div key={j} className="size-5 rounded-[4px] bg-transparent sm:size-6" />
                ),
              )}
            </div>
          ))}
        </div>

        {/* Detalle del día señalado: el `title` nativo tarda y se pierde. */}
        <div className="min-h-[1.5rem] pt-2 text-sm">
          {activo ? (
            <span>
              <span className="font-medium text-foreground">{capitalizar(fmtFechaLarga(activo.fecha))}</span>
              <span className="text-muted-foreground">
                {" · "}
                {activo.cumplidos}/{activo.total} hábitos
                {activo.hechos.length > 0 && ` · ${activo.hechos.join(", ")}`}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">Pasa el ratón por un día para ver su detalle.</span>
          )}
        </div>
        <div className="mt-2 flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
          <span>menos</span>
          {NIVEL_COLOR.map((c, i) => (
            <span key={i} className={cn("size-4 rounded-[4px]", c)} title={`${i}/${NIVEL_COLOR.length - 1}`} />
          ))}
          <span>más</span>
        </div>
      </div>
    </div>
  );
}
