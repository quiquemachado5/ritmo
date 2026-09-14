import type { StoreData } from "./store/types";
import { hoy } from "./model/dates";
import { sumaKcalComidas } from "./store/day";

export type DataHealthIssueKind = "day-date" | "meal-duplicate" | "meal-total" | "measurement-duplicate" | "weight-conflict" | "future-record";

export interface DataHealthIssue {
  kind: DataHealthIssueKind;
  fecha: string;
  message: string;
  repairable: boolean;
}

export interface DataHealthReport {
  issues: DataHealthIssue[];
  repairable: number;
  review: number;
}

export function analizarSaludDatos(data: StoreData, fechaHoy = hoy()): DataHealthReport {
  const issues: DataHealthIssue[] = [];
  for (const [fecha, dia] of Object.entries(data.dias)) {
    if (dia.fecha !== fecha) issues.push({ kind: "day-date", fecha, message: "La fecha interna del día no coincide con su posición en el historial.", repairable: true });
    const ids = new Set<string>();
    for (const comida of dia.comidas ?? []) {
      if (ids.has(comida.id)) issues.push({ kind: "meal-duplicate", fecha, message: "La misma comida aparece más de una vez.", repairable: true });
      ids.add(comida.id);
    }
    const total = sumaKcalComidas(dia.comidas);
    if (total != null && Math.abs((dia.kcalConsumidas ?? 0) - total) >= 1) {
      issues.push({ kind: "meal-total", fecha, message: "El total del día no coincide con la suma de sus comidas.", repairable: true });
    }
    if (fecha > fechaHoy) issues.push({ kind: "future-record", fecha, message: "Hay un registro fechado en el futuro.", repairable: false });
  }

  const mediciones = new Map<string, number>();
  for (const medicion of data.composicion) mediciones.set(medicion.fecha, (mediciones.get(medicion.fecha) ?? 0) + 1);
  for (const [fecha, cantidad] of mediciones) {
    if (cantidad > 1) issues.push({ kind: "measurement-duplicate", fecha, message: `${cantidad} mediciones comparten la misma fecha.`, repairable: true });
    const pesoDia = data.dias[fecha]?.peso;
    const pesoMedicion = [...data.composicion].reverse().find((medicion) => medicion.fecha === fecha)?.peso;
    if (pesoDia != null && pesoMedicion != null && Math.abs(pesoDia - pesoMedicion) >= 0.05) {
      issues.push({ kind: "weight-conflict", fecha, message: "El peso del día y la medición corporal son distintos; elige cuál es correcto.", repairable: false });
    }
    if (fecha > fechaHoy) issues.push({ kind: "future-record", fecha, message: "Hay una medición fechada en el futuro.", repairable: false });
  }

  return { issues, repairable: issues.filter((issue) => issue.repairable).length, review: issues.filter((issue) => !issue.repairable).length };
}

/** Corrige solo duplicados y totales que pueden reconstruirse sin una decisión humana. */
export function repararSaludDatos(data: StoreData, fechaHoy = hoy()) {
  const report = analizarSaludDatos(data, fechaHoy);
  const next = structuredClone(data);
  for (const [fecha, dia] of Object.entries(next.dias)) {
    dia.fecha = fecha;
    if (dia.comidas?.length) {
      dia.comidas = [...new Map(dia.comidas.map((comida) => [comida.id, comida])).values()];
      dia.kcalConsumidas = sumaKcalComidas(dia.comidas) ?? undefined;
    }
  }
  const composicion = new Map<string, StoreData["composicion"][number]>();
  for (const medicion of next.composicion) composicion.set(medicion.fecha, { ...(composicion.get(medicion.fecha) ?? {}), ...medicion });
  next.composicion = [...composicion.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
  return { data: next, changes: report.repairable, report };
}
