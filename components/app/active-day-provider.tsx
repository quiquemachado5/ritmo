"use client";

import * as React from "react";
import { hoy } from "@/lib/model/dates";
import { useRitmo } from "@/lib/store/provider";

type ActiveDayContextValue = {
  fecha: string;
  seleccionarFecha: (fecha: string) => void;
  volverAHoy: () => void;
};

const ActiveDayContext = React.createContext<ActiveDayContextValue | null>(null);
const ACTIVE_DAY_EVENT = "ritmo:active-day-change";

function esFechaValida(fecha: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(fecha) && fecha <= hoy();
}

function storageKey(userId?: string | null) {
  return `ritmo:active-day:${userId || "local"}`;
}

export function ActiveDayProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useRitmo();
  const fecha = React.useSyncExternalStore(
    React.useCallback((notify) => {
      const onStorage = (event: StorageEvent) => { if (event.key === storageKey(userId)) notify(); };
      window.addEventListener("storage", onStorage);
      window.addEventListener(ACTIVE_DAY_EVENT, notify);
      return () => { window.removeEventListener("storage", onStorage); window.removeEventListener(ACTIVE_DAY_EVENT, notify); };
    }, [userId]),
    React.useCallback(() => {
      const guardada = window.localStorage.getItem(storageKey(userId));
      return guardada && esFechaValida(guardada) ? guardada : hoy();
    }, [userId]),
    hoy,
  );

  const seleccionarFecha = React.useCallback((siguiente: string) => {
    if (!esFechaValida(siguiente)) return;
    window.localStorage.setItem(storageKey(userId), siguiente);
    window.dispatchEvent(new Event(ACTIVE_DAY_EVENT));
  }, [userId]);

  const volverAHoy = React.useCallback(() => seleccionarFecha(hoy()), [seleccionarFecha]);
  const value = React.useMemo(() => ({ fecha, seleccionarFecha, volverAHoy }), [fecha, seleccionarFecha, volverAHoy]);

  return <ActiveDayContext.Provider value={value}>{children}</ActiveDayContext.Provider>;
}

export function useActiveDay() {
  const value = React.useContext(ActiveDayContext);
  if (!value) throw new Error("useActiveDay debe usarse dentro de <ActiveDayProvider>");
  return value;
}
