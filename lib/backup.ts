/* Copia de seguridad local de los datos del usuario.
   Es su activo irremplazable (años de registro). Guardamos una instantánea
   rodante en localStorage cada vez que cambian los datos, de modo que si la
   nube falla o la sesión se pierde, siempre hay una copia recuperable en el
   dispositivo. Independiente de Supabase a propósito. */

import { registrarDiagnostico } from "./observability";
import { limpiarBorradores } from "./drafts";
import { limpiarAuditoriaLocal } from "./model-audit/storage";
import { limpiarAuditoriaDocumental } from "./model-audit/documentary";
import { analizarImportacion } from "./store/import";
import type { StoreData } from "./store/types";

const BACKUP_KEY = "ritmo:backup";
const LAST_EXPORT_KEY = "ritmo:lastExport";
const RESTORE_DRILL_KEY = "ritmo:restoreDrill";

function clave(base: string, userId: string): string {
  return `${base}:${userId}`;
}

export interface BackupSnapshot {
  at: string; // ISO
  data: unknown;
}

export interface RestoreDrillResult {
  at: string;
  ok: boolean;
  local: boolean;
  cloud: boolean;
  detail: string;
}

/** Recorre la misma validación que una importación, pero sin modificar datos. */
export function validarRestauracionLocal(snapshot: BackupSnapshot | null, actual: StoreData): boolean {
  if (!snapshot || !snapshot.data || typeof snapshot.data !== "object") return false;
  try {
    const copiaAislada: unknown = JSON.parse(JSON.stringify(snapshot.data));
    return analizarImportacion(copiaAislada, actual).valido;
  } catch {
    return false;
  }
}

export function leerSimulacroRestauracion(userId: string | null): RestoreDrillResult | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(clave(RESTORE_DRILL_KEY, userId));
    if (!raw) return null;
    const valor = JSON.parse(raw) as RestoreDrillResult;
    return valor && typeof valor.at === "string" && typeof valor.ok === "boolean" ? valor : null;
  } catch { return null; }
}

function guardarSimulacro(userId: string, resultado: RestoreDrillResult) {
  try {
    localStorage.setItem(clave(RESTORE_DRILL_KEY, userId), JSON.stringify(resultado));
    window.dispatchEvent(new CustomEvent("ritmo:backup-drill", { detail: userId }));
  } catch { registrarDiagnostico("sync", "warning", "resultado del simulacro no disponible en el dispositivo"); }
}

/**
 * Simulacro semanal: deserializa y valida la copia local y, si está disponible,
 * descarga el último objeto privado de Storage y lo valida sin restaurarlo.
 */
export async function ejecutarSimulacroRestauracion(actual: StoreData, userId: string, forzar = false): Promise<RestoreDrillResult> {
  const previo = leerSimulacroRestauracion(userId);
  if (!forzar && previo && Date.now() - Date.parse(previo.at) < 7 * 86400000) return previo;
  const at = new Date().toISOString();
  try {
    const local = validarRestauracionLocal(leerBackupLocal(userId), actual);
    if (!local) throw new Error("La copia local no supera la validación de restauración.");
    let cloud = false;
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const sb = createClient();
      const { data: usuario } = await sb.auth.getUser();
      if (usuario.user?.id === userId) {
        const { data, error } = await sb.storage.from("backups").download(`${userId}/latest.json`);
        if (!error && data) {
          const remoto: unknown = JSON.parse(await data.text());
          cloud = analizarImportacion(remoto, actual).valido;
        }
      }
    } catch { /* La copia local sigue siendo restaurable aunque Storage no responda. */ }
    const resultado: RestoreDrillResult = {
      at, ok: true, local: true, cloud,
      detail: cloud ? "Copia local y copia privada en la nube verificadas." : "Copia local verificada; la nube no estaba disponible para esta prueba.",
    };
    guardarSimulacro(userId, resultado);
    registrarDiagnostico("sync", "ok", cloud ? "simulacro de restauración local y nube" : "simulacro de restauración local");
    return resultado;
  } catch {
    const resultado: RestoreDrillResult = { at, ok: false, local: false, cloud: false, detail: "La copia no superó la prueba. Genera una exportación manual." };
    guardarSimulacro(userId, resultado);
    registrarDiagnostico("sync", "error", "simulacro de restauración fallido");
    return resultado;
  }
}

export function guardarBackupLocal(data: unknown, userId: string | null): void {
  if (!userId) return;
  try {
    localStorage.removeItem(BACKUP_KEY);
    const siguiente = JSON.stringify({ at: new Date().toISOString(), data });
    const anterior = localStorage.getItem(clave(BACKUP_KEY, userId));
    if (anterior && deserializarBackup(anterior)) {
      try { localStorage.setItem(clave(BACKUP_KEY + ":previous", userId), anterior); }
      catch { /* Si no cabe otra copia, todavía puede caber la actualización. */ }
    }
    localStorage.setItem(clave(BACKUP_KEY, userId), siguiente);
  } catch {
    registrarDiagnostico("sync", "warning", "copia local no disponible");
  }
}

function deserializarBackup(raw: string | null): BackupSnapshot | null {
  if (!raw) return null;
  try {
    const valor: unknown = JSON.parse(raw);
    if (!valor || typeof valor !== "object" || !("at" in valor) || !("data" in valor)) return null;
    if (typeof valor.at !== "string" || !Number.isFinite(Date.parse(valor.at)) || !valor.data || typeof valor.data !== "object" || Array.isArray(valor.data)) return null;
    return valor as BackupSnapshot;
  } catch { return null; }
}

export function leerBackupLocal(userId: string | null): BackupSnapshot | null {
  if (!userId) return null;
  try {
    localStorage.removeItem(BACKUP_KEY);
    return deserializarBackup(localStorage.getItem(clave(BACKUP_KEY, userId)))
      ?? deserializarBackup(localStorage.getItem(clave(BACKUP_KEY + ":previous", userId)));
  } catch {
    return null;
  }
}

export function marcarExportacion(userId: string | null): void {
  if (!userId) return;
  try {
    localStorage.removeItem(LAST_EXPORT_KEY);
    localStorage.setItem(clave(LAST_EXPORT_KEY, userId), new Date().toISOString());
  } catch {
    /* ignore */
  }
}

export function ultimaExportacion(userId: string | null): Date | null {
  if (!userId) return null;
  try {
    localStorage.removeItem(LAST_EXPORT_KEY);
    const raw = localStorage.getItem(clave(LAST_EXPORT_KEY, userId));
    return raw ? new Date(raw) : null;
  } catch {
    return null;
  }
}

/** Días desde la última exportación manual (null si nunca). */
export function diasDesdeExportacion(userId: string | null): number | null {
  const d = ultimaExportacion(userId);
  if (!d) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

export function limpiarDatosLocales(userId: string | null): void {
  if (userId) limpiarBorradores(userId);
  try {
    localStorage.removeItem(BACKUP_KEY);
    localStorage.removeItem(LAST_EXPORT_KEY);
    localStorage.removeItem(CLOUD_MARK);
    if (userId) {
      limpiarAuditoriaLocal(userId);
      limpiarAuditoriaDocumental(userId);
      localStorage.removeItem(clave(BACKUP_KEY, userId));
      localStorage.removeItem(clave(BACKUP_KEY + ":previous", userId));
      localStorage.removeItem(clave(LAST_EXPORT_KEY, userId));
      localStorage.removeItem(clave(CLOUD_MARK, userId));
      localStorage.removeItem(clave(RESTORE_DRILL_KEY, userId));
    }
  } catch {}
}

/* ------------------------------------------------------------- backup nube */

const CLOUD_MARK = "ritmo:lastCloudBackup";

/** Días desde el último backup subido a Supabase Storage (null si nunca). */
function horasDesdeCloud(userId: string): number {
  try {
    localStorage.removeItem(CLOUD_MARK);
    const raw = localStorage.getItem(clave(CLOUD_MARK, userId));
    if (!raw) return Infinity;
    return (Date.now() - new Date(raw).getTime()) / 3_600_000;
  } catch {
    return Infinity;
  }
}

/**
 * Sube una copia JSON al bucket privado `backups` de Supabase Storage, como
 * mucho una vez cada `minHoras`. Guarda dos objetos: `latest.json` (siempre
 * sobrescrito) y uno con fecha. Degrada en silencio si no hay bucket/red.
 * Import dinámico del cliente para no cargar Supabase salvo cuando toca.
 */
export async function subirBackupNube(data: unknown, userId: string, minHoras = 12): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const { createClient } = await import("@/lib/supabase/client");
    const sb = createClient();
    const { data: u } = await sb.auth.getUser();
    if (!u.user || u.user.id !== userId) return;
    if (horasDesdeCloud(u.user.id) < minHoras) return;
    const cuerpo = new Blob([JSON.stringify(data)], { type: "application/json" });
    const fecha = new Date().toISOString().slice(0, 10);
    const base = u.user.id;
    const [ultima, diaria] = await Promise.all([
      sb.storage.from("backups").upload(`${base}/latest.json`, cuerpo, { upsert: true, contentType: "application/json" }),
      sb.storage.from("backups").upload(`${base}/ritmo-${fecha}.json`, cuerpo, { upsert: true, contentType: "application/json" }),
    ]);
    if (ultima.error) throw ultima.error;
    if (diaria.error) throw diaria.error;
    localStorage.setItem(clave(CLOUD_MARK, u.user.id), new Date().toISOString());
    registrarDiagnostico("sync", "ok", "copia de seguridad en nube");
  } catch {
    registrarDiagnostico("sync", "warning", "copia de seguridad en nube pendiente");
    /* sin bucket, sin red o sin permisos: la copia local sigue vigente */
  }
}
