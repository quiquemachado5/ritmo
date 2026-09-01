import type { StoreData } from "./types";
import { BACKUP_FORMAT_VERSION, DATABASE_MIGRATION_VERSION } from "../version";

export interface ArchivoRitmo extends Partial<StoreData> {
  version?: number;
  app?: string;
  exportado?: string;
  schemaVersion?: string;
}

export interface ResumenImportacion {
  valido: boolean;
  error?: string;
  version: number | null;
  exportado: string | null;
  schemaVersion: string | null;
  diasNuevos: number;
  diasCoincidentes: number;
  medicionesNuevas: number;
  medicionesCoincidentes: number;
  comidas: number;
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Valida el envoltorio antes de mutar nada y explica qué se fusionará. */
export function analizarImportacion(valor: unknown, actual: StoreData): ResumenImportacion {
  const vacio: ResumenImportacion = { valido: false, version: null, exportado: null, schemaVersion: null, diasNuevos: 0, diasCoincidentes: 0, medicionesNuevas: 0, medicionesCoincidentes: 0, comidas: 0 };
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return { ...vacio, error: "El archivo no contiene un respaldo válido de RITMO." };
  const archivo = valor as ArchivoRitmo;
  if (archivo.app && archivo.app !== "ritmo") return { ...vacio, error: "Este archivo no parece pertenecer a RITMO." };
  if (archivo.version !== undefined && (!Number.isInteger(archivo.version) || archivo.version < 1 || archivo.version > BACKUP_FORMAT_VERSION)) return { ...vacio, error: "La versión de este respaldo no es compatible todavía." };
  if (archivo.schemaVersion !== undefined && typeof archivo.schemaVersion !== "string") return { ...vacio, error: "La versión de datos del respaldo no es válida." };
  if (archivo.schemaVersion && archivo.schemaVersion > DATABASE_MIGRATION_VERSION) return { ...vacio, error: "Este respaldo fue creado con una versión de RITMO más reciente." };
  if (archivo.dias !== undefined && (!archivo.dias || typeof archivo.dias !== "object" || Array.isArray(archivo.dias))) return { ...vacio, error: "El bloque de días del archivo no tiene un formato válido." };
  if (archivo.composicion !== undefined && !Array.isArray(archivo.composicion)) return { ...vacio, error: "El bloque de mediciones del archivo no tiene un formato válido." };

  const dias = Object.values(archivo.dias || {}).filter((d) => d && typeof d === "object" && FECHA.test((d as { fecha?: string }).fecha ?? ""));
  const fechasDia = new Set(dias.map((d) => (d as { fecha: string }).fecha));
  const mediciones = (archivo.composicion || []).filter((m) => m && typeof m === "object" && FECHA.test((m as { fecha?: string }).fecha ?? ""));
  const fechasMedicion = new Set(mediciones.map((m) => (m as { fecha: string }).fecha));

  return {
    valido: true,
    version: archivo.version ?? null,
    exportado: typeof archivo.exportado === "string" ? archivo.exportado : null,
    schemaVersion: typeof archivo.schemaVersion === "string" ? archivo.schemaVersion : null,
    diasNuevos: [...fechasDia].filter((f) => !actual.dias[f]).length,
    diasCoincidentes: [...fechasDia].filter((f) => Boolean(actual.dias[f])).length,
    medicionesNuevas: [...fechasMedicion].filter((f) => !actual.composicion.some((m) => m.fecha === f)).length,
    medicionesCoincidentes: [...fechasMedicion].filter((f) => actual.composicion.some((m) => m.fecha === f)).length,
    comidas: dias.reduce((n, d) => n + (((d as { comidas?: unknown[] }).comidas?.length) ?? 0), 0),
  };
}
