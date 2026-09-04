"use client";

import * as React from "react";
import { useRitmo } from "@/lib/store/provider";
import { guardarBackupLocal, subirBackupNube } from "@/lib/backup";
import { BACKUP_FORMAT_VERSION, DATABASE_MIGRATION_VERSION } from "@/lib/version";
import { useMealPrefs } from "@/lib/meal-prefs";

/** Copia de seguridad automática cada vez que cambian los datos (con debounce):
    siempre en localStorage (instantáneo, offline) y, como mucho una vez cada
    12 h, también en Supabase Storage. Silencioso: red de seguridad, no función
    visible. */
export function AutoBackup() {
  const { estado, cargando, cargaValida, sincronizando, userId } = useRitmo();
  const preferencias = useMealPrefs();

  React.useEffect(() => {
    if (cargando || !cargaValida || sincronizando || !userId) return;
    const id = setTimeout(() => {
      const snapshot = {
        version: BACKUP_FORMAT_VERSION,
        schemaVersion: DATABASE_MIGRATION_VERSION,
        app: "ritmo",
        exportado: new Date().toISOString(),
        perfil: estado.perfil,
        dias: estado.dias,
        composicion: estado.composicion,
        preferencias,
      };
      guardarBackupLocal(snapshot, userId);
      void subirBackupNube(snapshot, userId);
    }, 2000);
    return () => clearTimeout(id);
  }, [estado, cargando, cargaValida, sincronizando, userId, preferencias]);

  return null;
}
