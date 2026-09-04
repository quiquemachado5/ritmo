import { validarAuditoriaImportada } from "./import";
import type { AuditoriaModelo } from "./types";

const clave = (userId: string) => `ritmo:model-documentary:v1:${userId}`;
const vacio = (): AuditoriaModelo => ({ configuraciones: [], predicciones: [] });

/** Copia documental: se exporta, pero NUNCA alimenta la precisión prospectiva. */
export function leerAuditoriaDocumental(userId: string): AuditoriaModelo {
  const raw = localStorage.getItem(clave(userId));
  if (!raw) return vacio();
  const datos: unknown = JSON.parse(raw);
  if (!validarAuditoriaImportada(datos)) throw new Error("No se puede leer la copia documental del modelo.");
  return datos;
}

export function conservarAuditoriaDocumental(userId: string, ...fuentes: unknown[]): void {
  const anterior = leerAuditoriaDocumental(userId);
  const configs = new Map(anterior.configuraciones.map(c => [c.id, c]));
  const forecasts = new Map(anterior.predicciones.map(p => [p.id, p]));
  for (const fuente of fuentes) {
    if (fuente === undefined) continue;
    if (!validarAuditoriaImportada(fuente)) throw new Error("El historial del modelo importado no es válido.");
    for (const c of fuente.configuraciones) if (!configs.has(c.id)) configs.set(c.id, c);
    for (const p of fuente.predicciones) if (!forecasts.has(p.id)) forecasts.set(p.id, p);
  }
  const fusionado = { configuraciones: [...configs.values()], predicciones: [...forecasts.values()] };
  if (!validarAuditoriaImportada(fusionado)) throw new Error("El archivo documental combinado supera el límite de registros.");
  localStorage.setItem(clave(userId), JSON.stringify(fusionado));
}

export function limpiarAuditoriaDocumental(userId: string): void {
  localStorage.removeItem(clave(userId));
}
