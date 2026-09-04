"use client";

import * as React from "react";
import { useRitmo } from "@/lib/store/provider";
import { guardarBackupLocal, subirBackupNube } from "@/lib/backup";
import { useMealPrefs } from "@/lib/meal-prefs";
import { registrarDiagnostico } from "@/lib/observability";

/** Copia de seguridad automática cada vez que cambian los datos (con debounce):
    siempre en localStorage (instantáneo, offline) y, como mucho una vez cada
    12 h, también en Supabase Storage. Silencioso: red de seguridad, no función
    visible. */
export function AutoBackup() {
  const { estado, auditoriaModelo, exportar, cargando, cargaValida, sincronizando, userId } = useRitmo();
  const preferencias = useMealPrefs();

  React.useEffect(() => {
    if (cargando || !cargaValida || sincronizando || !userId) return;
    const id = setTimeout(() => {
      try {
        const snapshot = exportar();
        guardarBackupLocal(snapshot, userId);
        void subirBackupNube(snapshot, userId);
      } catch { registrarDiagnostico("sync", "warning", "copia documental no disponible; se conserva el respaldo anterior"); }
    }, 2000);
    return () => clearTimeout(id);
  }, [estado, auditoriaModelo, exportar, cargando, cargaValida, sincronizando, userId, preferencias]);

  return null;
}
