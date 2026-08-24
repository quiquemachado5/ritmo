"use client";

import * as React from "react";
import { hoy } from "@/lib/model/dates";

export type QuickTab = "comida" | "peso" | "ejercicio" | "habitos" | "medidas";

interface QuickLogState {
  abierto: boolean;
  tab: QuickTab;
  fecha: string;
  abrir: (tab?: QuickTab, fecha?: string) => void;
  cerrar: () => void;
  setTab: (t: QuickTab) => void;
}

const Ctx = React.createContext<QuickLogState | null>(null);

export function useQuickLog(): QuickLogState {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useQuickLog debe usarse dentro de <QuickLogProvider>");
  return v;
}

export function QuickLogProvider({ children }: { children: React.ReactNode }) {
  const [abierto, setAbierto] = React.useState(false);
  const [tab, setTab] = React.useState<QuickTab>("comida");
  const [fecha, setFecha] = React.useState(hoy());

  const abrir = React.useCallback((t: QuickTab = "comida", f?: string) => {
    setTab(t);
    setFecha(f ?? hoy());
    setAbierto(true);
  }, []);
  const cerrar = React.useCallback(() => setAbierto(false), []);

  const value = React.useMemo(
    () => ({ abierto, tab, fecha, abrir, cerrar, setTab }),
    [abierto, tab, fecha, abrir, cerrar],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
