/* Copia de seguridad local de los datos del usuario.
   Es su activo irremplazable (años de registro). Guardamos una instantánea
   rodante en localStorage cada vez que cambian los datos, de modo que si la
   nube falla o la sesión se pierde, siempre hay una copia recuperable en el
   dispositivo. Independiente de Supabase a propósito. */

import { registrarDiagnostico } from "./observability";
import { limpiarBorradores } from "./drafts";
import { limpiarAuditoriaLocal } from "./model-audit/storage";
import { limpiarAuditoriaDocumental } from "./model-audit/documentary";

const BACKUP_KEY = "ritmo:backup";
const LAST_EXPORT_KEY = "ritmo:lastExport";

function clave(base: string, userId: string): string {
  return `${base}:${userId}`;
}

export interface BackupSnapshot {
  at: string; // ISO
  data: unknown;
}

export function guardarBackupLocal(data: unknown, userId: string | null): void {
  if (!userId) return;
  try {
    localStorage.removeItem(BACKUP_KEY);
    const anterior = localStorage.getItem(clave(BACKUP_KEY, userId));
    if (anterior) localStorage.setItem(clave(BACKUP_KEY + ":previous", userId), anterior);
    localStorage.setItem(clave(BACKUP_KEY, userId), JSON.stringify({ at: new Date().toISOString(), data }));
  } catch {
    registrarDiagnostico("sync", "warning", "copia local no disponible");
  }
}

export function leerBackupLocal(userId: string | null): BackupSnapshot | null {
  if (!userId) return null;
  try {
    localStorage.removeItem(BACKUP_KEY);
    const raw = localStorage.getItem(clave(BACKUP_KEY, userId));
    return raw ? (JSON.parse(raw) as BackupSnapshot) : null;
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
