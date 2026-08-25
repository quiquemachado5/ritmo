"use client";

import * as React from "react";
import { useRitmo } from "@/lib/store/provider";
import { guardarBackupLocal, subirBackupNube } from "@/lib/backup";

/** Copia de seguridad automática cada vez que cambian los datos (con debounce):
    siempre en localStorage (instantáneo, offline) y, como mucho una vez cada
    12 h, también en Supabase Storage. Silencioso: red de seguridad, no función
    visible. */
export function AutoBackup() {
  const { estado, cargando } = useRitmo();

  React.useEffect(() => {
    if (cargando) return;
    const id = setTimeout(() => {
      const snapshot = {
        version: 1,
        app: "ritmo",
        exportado: new Date().toISOString(),
        perfil: estado.perfil,
        dias: estado.dias,
        composicion: estado.composicion,
      };
      guardarBackupLocal(snapshot);
      void subirBackupNube(snapshot);
    }, 2000);
    return () => clearTimeout(id);
  }, [estado, cargando]);

  return null;
}
