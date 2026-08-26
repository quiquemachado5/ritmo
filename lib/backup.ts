/* Copia de seguridad local de los datos del usuario.
   Es su activo irremplazable (años de registro). Guardamos una instantánea
   rodante en localStorage cada vez que cambian los datos, de modo que si la
   nube falla o la sesión se pierde, siempre hay una copia recuperable en el
   dispositivo. Independiente de Supabase a propósito. */

const BACKUP_KEY = "ritmo:backup";
const LAST_EXPORT_KEY = "ritmo:lastExport";

export interface BackupSnapshot {
  at: string; // ISO
  data: unknown;
}

export function guardarBackupLocal(data: unknown): void {
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify({ at: new Date().toISOString(), data }));
  } catch {
    /* cuota llena o modo privado: no es crítico */
  }
}

export function leerBackupLocal(): BackupSnapshot | null {
  try {
    const raw = localStorage.getItem(BACKUP_KEY);
    return raw ? (JSON.parse(raw) as BackupSnapshot) : null;
  } catch {
    return null;
  }
}

export function marcarExportacion(): void {
  try {
    localStorage.setItem(LAST_EXPORT_KEY, new Date().toISOString());
  } catch {
    /* ignore */
  }
}

export function ultimaExportacion(): Date | null {
  try {
    const raw = localStorage.getItem(LAST_EXPORT_KEY);
    return raw ? new Date(raw) : null;
  } catch {
    return null;
  }
}

/** Días desde la última exportación manual (null si nunca). */
export function diasDesdeExportacion(): number | null {
  const d = ultimaExportacion();
  if (!d) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

export function limpiarDatosLocales(): void {
  try { localStorage.removeItem(BACKUP_KEY); localStorage.removeItem(LAST_EXPORT_KEY); localStorage.removeItem(CLOUD_MARK); } catch {}
}

/* ------------------------------------------------------------- backup nube */

const CLOUD_MARK = "ritmo:lastCloudBackup";

/** Días desde el último backup subido a Supabase Storage (null si nunca). */
function horasDesdeCloud(): number {
  try {
    const raw = localStorage.getItem(CLOUD_MARK);
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
export async function subirBackupNube(data: unknown, minHoras = 12): Promise<void> {
  if (typeof window === "undefined") return;
  if (horasDesdeCloud() < minHoras) return;
  try {
    const { createClient } = await import("@/lib/supabase/client");
    const sb = createClient();
    const { data: u } = await sb.auth.getUser();
    if (!u.user) return;
    const cuerpo = new Blob([JSON.stringify(data)], { type: "application/json" });
    const fecha = new Date().toISOString().slice(0, 10);
    const base = u.user.id;
    await sb.storage.from("backups").upload(`${base}/latest.json`, cuerpo, { upsert: true, contentType: "application/json" });
    await sb.storage.from("backups").upload(`${base}/ritmo-${fecha}.json`, cuerpo, { upsert: true, contentType: "application/json" });
    localStorage.setItem(CLOUD_MARK, new Date().toISOString());
  } catch {
    /* sin bucket, sin red o sin permisos: la copia local sigue vigente */
  }
}
