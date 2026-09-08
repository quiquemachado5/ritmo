"use client";

import * as React from "react";
import { ChevronDown, RefreshCw } from "lucide-react";
import { useRitmo } from "@/lib/store/provider";
import { evaluarPredicciones } from "@/lib/model-audit/evaluation";
import { hoy } from "@/lib/model/dates";
import { habitosModelo } from "@/lib/model/config";
import { fmtFechaCorta, fmtNum, fmtPeso } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/app/primitives";
import { evaluarCicloModelos } from "@/lib/model-audit/lifecycle";

/** Detalle opcional dentro de la sección de confianza; no añade otra tarjeta. */
export function ModelAudit() {
  const { estado, auditoriaModelo, errorAuditoria, reintentarAuditoria } = useRitmo();
  const [reintentando, setReintentando] = React.useState(false);
  const [visibles, setVisibles] = React.useState(5);
  const ciclo = React.useMemo(() => evaluarCicloModelos(estado, auditoriaModelo.predicciones, hoy()), [estado, auditoriaModelo.predicciones]);
  const evaluacion = React.useMemo(() => evaluarPredicciones(estado, auditoriaModelo.predicciones, hoy(), ciclo.versionActiva), [estado, auditoriaModelo.predicciones, ciclo.versionActiva]);
  const configuraciones = [...auditoriaModelo.configuraciones].reverse();
  const primera = auditoriaModelo.configuraciones[0];
  async function reintentar() {
    setReintentando(true);
    try { await reintentarAuditoria(); } finally { setReintentando(false); }
  }
  return (
    <div className="border-t border-border px-5 py-5 sm:px-6">
      <h3 className="font-display text-base font-bold">Lo que predijo antes de pesarte</h3>
      <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted-foreground">Guardamos la primera predicción de cada día para mañana, 3, 7 y 30 días. No cambia al añadir un pesaje ni al editar tus hábitos.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Chip tone={ciclo.estado === "activo" ? "weight" : ciclo.estado === "revertido" ? "warning" : "muted"}>
          {ciclo.estado === "activo" ? "Candidato activado" : ciclo.estado === "revertido" ? "Reversión automática" : "Candidato en sombra"}
        </Chip>
        <span>{ciclo.motivo}</span>
      </div>

      {errorAuditoria && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-warning-wash p-3 text-sm text-warning-ink" role="status">
        <p className="min-w-0 flex-1 basis-56">No se ha podido verificar el historial en la nube. Las cifras guardadas en este dispositivo pueden estar desactualizadas; las nuevas emisiones requieren conexión.</p>
        <Button variant="outline" className="min-h-11" disabled={reintentando} onClick={() => void reintentar()}><RefreshCw className="size-4" />{reintentando ? "Comprobando…" : "Reintentar"}</Button>
      </div>}

      {evaluacion.casos > 0 ? <>
        <p className="mt-3 text-xs text-muted-foreground">
          Modelo actual: <span className="font-semibold text-foreground">{evaluacion.actual.casos ? `${fmtPeso(evaluacion.actual.maeKg, 2)} kg MAE en ${evaluacion.actual.casos} comparaciones` : "aún sin pesajes evaluables"}</span>. El resumen inferior conserva versiones anteriores sin mezclarlas con esta cifra.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Error real de pronósticos emitidos antes del pesaje, separado por horizonte</caption>
            <thead className="text-xs text-muted-foreground"><tr className="border-b border-border"><th scope="col" className="pb-2 font-medium">Antelación</th><th scope="col" className="pb-2 text-right font-medium">Pesajes</th><th scope="col" className="pb-2 pl-3 text-right font-medium">Error medio</th><th scope="col" className="pb-2 pl-3 text-right font-medium">En rango</th></tr></thead>
            <tbody className="divide-y divide-border">
              {evaluacion.horizontes.map((h) => <tr key={h.dias}><th scope="row" className="py-2.5 font-medium">{h.dias === 1 ? "1 día" : `${h.dias} días`}</th><td className="py-2.5 text-right tabular-nums">{h.casos || "—"}</td><td className="py-2.5 pl-3 text-right font-semibold tabular-nums">{h.maeKg == null ? "—" : `${fmtPeso(h.maeKg, 2)} kg`}</td><td className="py-2.5 pl-3 text-right tabular-nums">{h.coberturaPct == null ? "—" : `${fmtNum(h.coberturaPct)}%`}</td></tr>)}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Error medio = diferencia absoluta con la báscula. En rango = pesajes dentro del intervalo que se guardó entonces; no garantiza aciertos futuros. Un mismo pesaje puede contrastar varios horizontes.</p>
        <details className="mt-2 border-b border-border pb-1">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium">Comparaciones recientes<ChevronDown className="size-4" /></summary>
          <ul className="divide-y divide-border text-sm">
            {evaluacion.evaluadas.slice(0, visibles).map((p) => <li key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 py-2.5">
              <span className="font-medium">{fmtFechaCorta(p.fechaObjetivo)} <span className="font-normal text-muted-foreground">· a {p.horizonteDias} {p.horizonteDias === 1 ? "día" : "días"}</span></span>
              <span className="text-right tabular-nums">{fmtPeso(p.peso)} <span className="text-muted-foreground">→</span> <strong>{fmtPeso(p.pesoReal)} kg</strong></span>
              <span className="col-span-2 text-xs leading-relaxed text-muted-foreground">Emitida el {fmtFechaCorta(p.fechaEmision)} · rango {fmtPeso(p.minimo)}–{fmtPeso(p.maximo)} kg · {p.pesajesUtilizados} pesajes y {p.diasUtilizados} días disponibles. {p.versionModelo}</span>
            </li>)}
          </ul>
          {evaluacion.evaluadas.length > visibles && <Button variant="ghost" className="min-h-11" onClick={() => setVisibles((v) => v + 10)}>Ver más comparaciones</Button>}
        </details>
      </> : <p className="mt-3 text-sm text-muted-foreground">{auditoriaModelo.predicciones.length ? "Ya hay pronósticos guardados. Registra un peso en su fecha para ver aquí el error real." : "Al abrir RITMO con conexión y un pesaje registrado se guarda el primer pronóstico. Su precisión se podrá medir con tus próximos pesajes."}</p>}
      {(evaluacion.pendientes > 0 || evaluacion.sinPesaje > 0) && <p className="mt-3 text-xs text-muted-foreground">{evaluacion.pendientes} pendientes de su fecha · {evaluacion.sinPesaje} sin pesaje en la fecha exacta, excluidos. Sin interpolaciones.</p>}

      <details className="mt-3 border-t border-border">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium">Configuración a lo largo del tiempo <span className="flex shrink-0 items-center gap-2 text-muted-foreground">{configuraciones.length}<ChevronDown className="size-4" /></span></summary>
        <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{primera ? `El historial se documenta desde el ${fmtFechaCorta(primera.effectiveDate ?? primera.effectiveFrom.slice(0, 10))}. Para fechas anteriores se conserva el supuesto inicial, pero su configuración real no está documentada. Los cambios nuevos no reescriben ese pasado.` : "El historial comienza al verificar tu configuración con conexión. No se inventarán ajustes anteriores."} Si cambias ajustes varias veces en un día, los cálculos diarios usan la última versión de ese día.</p>
        <ul className="divide-y divide-border">
          {configuraciones.slice(0, 10).map((c) => <li key={c.id} className="py-2.5 text-sm">
            <p className="font-medium">Desde {fmtFechaCorta(c.effectiveDate ?? c.effectiveFrom.slice(0, 10))} <span className="font-normal text-muted-foreground">· {fmtNum(c.perfil.kcalObjetivo)} kcal objetivo · {habitosModelo(c.perfil).length} hábitos</span></p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{c.perfil.edad} años · {c.perfil.alturaCm} cm · {c.perfil.sexo} · actividad ×{fmtNum(c.perfil.factorActividad, 3)}. Hábitos: {habitosModelo(c.perfil).map((h) => h.etiqueta).join(", ")}.</p>
          </li>)}
        </ul>
        {configuraciones.length > 10 && <p className="mt-2 text-xs text-muted-foreground">Últimas 10 versiones. La exportación de Ajustes conserva el historial completo.</p>}
      </details>
    </div>
  );
}
