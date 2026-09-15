import type { StoreData } from "./types";
import { BACKUP_FORMAT_VERSION, DATABASE_MIGRATION_VERSION } from "../version";
import { comidaValida, fechaValida, jsonSeguro, objeto, preferenciasValidas, preferenciasPerfilValidas } from "./validation";
import { validarPerfil } from "../profile-validation";
import { validarAuditoriaImportada } from "../model-audit/import";
import type { AuditoriaModelo } from "../model-audit/types";

export interface ArchivoRitmo extends Partial<StoreData> {
  auditoriaModelo?: AuditoriaModelo;
  auditoriaDocumental?: AuditoriaModelo;
  preferencias?: import("../meal-prefs").MealPrefs;
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
// Límites del esquema de almacenamiento. Validar el archivo entero evita
// descubrir estos errores después de haber escrito parte de la importación.
const LIMITES_MEDICION: Record<string, readonly [number, number]> = {
  peso: [25, 400], grasaPct: [2, 70], masaMuscularKg: [10, 200], imc: [8, 90],
  grasaVisceral: [1, 30], metabBasalKcal: [800, 4000], gastoDiarioKcal: [900, 8000],
  masaOseaKg: [1, 10], aguaPct: [20, 80], cintura: [30, 250], cadera: [30, 250],
  pecho: [30, 250], brazo: [10, 100], muslo: [20, 120], cuello: [20, 80],
};
const enRango = (n: unknown, min: number, max: number) => typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;

/** Valida el envoltorio antes de mutar nada y explica qué se fusionará. */
export function analizarImportacion(valor: unknown, actual: StoreData): ResumenImportacion {
  const vacio: ResumenImportacion = { valido: false, version: null, exportado: null, schemaVersion: null, diasNuevos: 0, diasCoincidentes: 0, medicionesNuevas: 0, medicionesCoincidentes: 0, comidas: 0 };
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return { ...vacio, error: "El archivo no contiene un respaldo válido de RITMO." };
  if (!jsonSeguro(valor)) return { ...vacio, error: "El respaldo contiene valores o estructuras no válidos." };
  const archivo = valor as ArchivoRitmo;
  if ([archivo.auditoriaModelo, archivo.auditoriaDocumental].some(v => v !== undefined && !validarAuditoriaImportada(v))) return { ...vacio, error: "El historial del modelo no tiene un formato válido." };
  if (archivo.perfil !== undefined && (!objeto(archivo.perfil) || validarPerfil({ ...actual.perfil, ...archivo.perfil }) || !preferenciasPerfilValidas(archivo.perfil))) return { ...vacio, error: "Revisa los valores del perfil en el respaldo." };
  if (archivo.app && archivo.app !== "ritmo") return { ...vacio, error: "Este archivo no parece pertenecer a RITMO." };
  if (archivo.version !== undefined && (!Number.isInteger(archivo.version) || archivo.version < 1 || archivo.version > BACKUP_FORMAT_VERSION)) return { ...vacio, error: "La versión de este respaldo no es compatible todavía." };
  if (archivo.schemaVersion !== undefined && typeof archivo.schemaVersion !== "string") return { ...vacio, error: "La versión de datos del respaldo no es válida." };
  if (archivo.schemaVersion && archivo.schemaVersion > DATABASE_MIGRATION_VERSION) return { ...vacio, error: "Este respaldo fue creado con una versión de RITMO más reciente." };
  if ([archivo.perfil, archivo.dias, archivo.composicion, archivo.preferencias, archivo.auditoriaModelo, archivo.auditoriaDocumental].every(v => v === undefined)) return { ...vacio, error: "El archivo no contiene datos de RITMO para importar." };
  if (archivo.dias !== undefined && (!archivo.dias || typeof archivo.dias !== "object" || Array.isArray(archivo.dias))) return { ...vacio, error: "El bloque de días del archivo no tiene un formato válido." };
  if (archivo.composicion !== undefined && !Array.isArray(archivo.composicion)) return { ...vacio, error: "El bloque de mediciones del archivo no tiene un formato válido." };
  if (Object.keys(archivo.dias ?? {}).length > 20000 || (archivo.composicion?.length ?? 0) > 20000) return { ...vacio, error: "El respaldo supera el número de registros permitido." };
  for (const [fecha, dia] of Object.entries(archivo.dias ?? {})) {
    if (!fechaValida(fecha) || !dia || dia.fecha !== fecha || !dia.habitos || typeof dia.habitos !== "object" || Array.isArray(dia.habitos)
      || Object.values(dia.habitos).some(v => typeof v !== "boolean") || (dia.notas?.length ?? 0) > 2000
      || (dia.notas !== undefined && typeof dia.notas !== "string")
      || (dia.peso !== undefined && !enRango(dia.peso, 25, 400))
      || (dia.grasaPct !== undefined && !enRango(dia.grasaPct, 2, 70))
      || (dia.pasos !== undefined && (!enRango(dia.pasos, 0, 200000) || !Number.isInteger(dia.pasos)))
      || (dia.suenoMinutos !== undefined && (!enRango(dia.suenoMinutos, 0, 1440) || !Number.isInteger(dia.suenoMinutos)))
      || (dia.entrenamientoMinutos !== undefined && (!enRango(dia.entrenamientoMinutos, 0, 1440) || !Number.isInteger(dia.entrenamientoMinutos)))
      || [dia.kcalConsumidas, dia.kcalQuemadas].some(n => n !== undefined && (!enRango(n, 0, 12000) || !Number.isInteger(n)))
      || (dia.comidas !== undefined && (!Array.isArray(dia.comidas) || dia.comidas.length > 100))) return { ...vacio, error: `Revisa el formato del día ${fecha.slice(0, 10)}.` };
    for (const comida of dia.comidas ?? []) {
      if (!comidaValida(comida)) return { ...vacio, error: `Una comida del ${fecha} tiene valores no válidos.` };
    }
  }
  if (archivo.composicion?.some(m => !m || !fechaValida(m.fecha) || !enRango(m.peso, 25, 400) || Object.entries(m).some(([k, n]) => k !== "fecha" && (
    typeof n !== "number" || !Number.isFinite(n)
    || (LIMITES_MEDICION[k] && !enRango(n, ...LIMITES_MEDICION[k]))
    || (["grasaVisceral", "metabBasalKcal", "gastoDiarioKcal"].includes(k) && !Number.isInteger(n))
  )))) return { ...vacio, error: "Hay mediciones con fecha o valores fuera de los límites de almacenamiento." };
  const prefs = archivo.preferencias;
  if (prefs !== undefined && !preferenciasValidas(prefs)) return { ...vacio, error: "Las preferencias del respaldo no tienen un formato válido." };

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
