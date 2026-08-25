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
