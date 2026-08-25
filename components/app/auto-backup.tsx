"use client";

import * as React from "react";
import { useRitmo } from "@/lib/store/provider";
import { guardarBackupLocal } from "@/lib/backup";

/** Guarda una copia local (localStorage) cada vez que cambian los datos, con
    un pequeño debounce. Silencioso: es una red de seguridad, no una función
    visible. */
export function AutoBackup() {
  const { estado, cargando } = useRitmo();

  React.useEffect(() => {
    if (cargando) return;
    const id = setTimeout(() => {
      guardarBackupLocal({
        version: 1,
        app: "ritmo",
        exportado: new Date().toISOString(),
        perfil: estado.perfil,
        dias: estado.dias,
        composicion: estado.composicion,
      });
    }, 2000);
    return () => clearTimeout(id);
  }, [estado, cargando]);

  return null;
}
