"use client";

import * as React from "react";
import { hoy } from "@/lib/model/dates";
import type { Comida } from "@/lib/model/types";

export type QuickTab = "comida" | "peso" | "habitos";

interface QuickLogState {
  abierto: boolean;
  tab: QuickTab;
  fecha: string;
  /** Comida que se está editando (null = alta nueva). */
  comidaEdit: Comida | null;
  abrir: (tab?: QuickTab, fecha?: string) => void;
  /** Abre el panel de comida en modo edición, precargado. */
  editarComidaEn: (fecha: string, comida: Comida) => void;
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
  const [comidaEdit, setComidaEdit] = React.useState<Comida | null>(null);

  const abrir = React.useCallback((t: QuickTab = "comida", f?: string) => {
    setTab(t);
    setFecha(f ?? hoy());
    setComidaEdit(null);
    setAbierto(true);
  }, []);

  const editarComidaEn = React.useCallback((f: string, comida: Comida) => {
    setTab("comida");
    setFecha(f);
    setComidaEdit(comida);
    setAbierto(true);
  }, []);

  const cerrar = React.useCallback(() => {
    setAbierto(false);
    setComidaEdit(null);
  }, []);

  const value = React.useMemo(
    () => ({ abierto, tab, fecha, comidaEdit, abrir, editarComidaEn, cerrar, setTab }),
    [abierto, tab, fecha, comidaEdit, abrir, editarComidaEn, cerrar],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
