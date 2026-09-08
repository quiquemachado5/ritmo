"use client";

import * as React from "react";

export interface ExperimentosRitmo {
  interfazViva: boolean;
  rescateAutomatico: boolean;
  detectorAvanzado: boolean;
  escenarios: boolean;
  memoriaCorporal: boolean;
}

export const EXPERIMENTOS_POR_DEFECTO: ExperimentosRitmo = {
  interfazViva: true,
  rescateAutomatico: true,
  detectorAvanzado: true,
  escenarios: true,
  memoriaCorporal: true,
};

const EVENTO = "ritmo:experimentos";
const SERIALIZADO_POR_DEFECTO = JSON.stringify(EXPERIMENTOS_POR_DEFECTO);

function clave(userId?: string | null) {
  return `ritmo:experimentos:${userId || "local"}`;
}

function normalizar(valor: unknown): ExperimentosRitmo {
  const parcial = valor && typeof valor === "object" ? valor as Partial<ExperimentosRitmo> : {};
  return Object.fromEntries(
    Object.entries(EXPERIMENTOS_POR_DEFECTO).map(([campo, porDefecto]) => [campo, typeof parcial[campo as keyof ExperimentosRitmo] === "boolean" ? parcial[campo as keyof ExperimentosRitmo] : porDefecto]),
  ) as unknown as ExperimentosRitmo;
}

function leerSerializado(userId?: string | null) {
  if (typeof window === "undefined") return SERIALIZADO_POR_DEFECTO;
  return window.localStorage.getItem(clave(userId)) ?? SERIALIZADO_POR_DEFECTO;
}

export function guardarExperimentos(userId: string | null | undefined, valor: ExperimentosRitmo) {
  window.localStorage.setItem(clave(userId), JSON.stringify(normalizar(valor)));
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: { userId: userId || "local" } }));
}

export function useExperimentos(userId?: string | null) {
  const snapshot = React.useSyncExternalStore(
    React.useCallback((actualizar) => {
      const onStorage = (event: StorageEvent) => { if (event.key === clave(userId)) actualizar(); };
      const onLocal = (event: Event) => {
        if ((event as CustomEvent<{ userId?: string }>).detail?.userId === (userId || "local")) actualizar();
      };
      window.addEventListener("storage", onStorage);
      window.addEventListener(EVENTO, onLocal);
      return () => { window.removeEventListener("storage", onStorage); window.removeEventListener(EVENTO, onLocal); };
    }, [userId]),
    React.useCallback(() => leerSerializado(userId), [userId]),
    () => SERIALIZADO_POR_DEFECTO,
  );
  return React.useMemo(() => {
    try { return normalizar(JSON.parse(snapshot)); }
    catch { return EXPERIMENTOS_POR_DEFECTO; }
  }, [snapshot]);
}
