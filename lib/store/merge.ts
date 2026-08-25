import type { Composicion } from "@/lib/model/types";
import type { StoreData } from "./types";

/**
 * Fusiona los datos de un import sobre el estado actual, SIN destruir nada que
 * el archivo no contenga. Función pura: misma entrada → misma salida, sin
 * efectos. Es la pieza crítica de la importación, por eso vive aislada y con
 * tests propios.
 *
 * Reglas:
 * - dias: se combinan por fecha; un día del import reemplaza al mismo día
 *   previo, pero los días previos que el import no menciona se conservan.
 * - composicion: se combina por fecha; los campos del import se fusionan sobre
 *   la medición previa de esa fecha (no la sustituye entera), y se ordena por
 *   fecha ascendente.
 * - perfil: los campos del import pisan los previos; el resto se conserva.
 */
export function fusionarImport(prev: StoreData, datos: Partial<StoreData>): StoreData {
  const dias = { ...prev.dias, ...(datos.dias || {}) };

  const porFecha = new Map<string, Composicion>(prev.composicion.map((m) => [m.fecha, m] as const));
  for (const m of datos.composicion || []) {
    porFecha.set(m.fecha, { ...(porFecha.get(m.fecha) || {}), ...m });
  }
  const composicion = [...porFecha.values()].sort((a, b) => (a.fecha < b.fecha ? -1 : 1));

  const perfil = { ...prev.perfil, ...(datos.perfil || {}) };

  return { perfil, dias, composicion };
}
