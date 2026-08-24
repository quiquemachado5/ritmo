"use client";

import * as React from "react";
import { toast } from "sonner";
import { PERFIL_DEFECTO } from "@/lib/model/config";
import type { Comida, Composicion, Dia, Estado, Perfil } from "@/lib/model/types";
import { createClient } from "@/lib/supabase/client";
import { CloudAdapter } from "./cloud";
import type { Adapter, Modo, StoreData } from "./types";

function clonar<T>(v: T): T {
  return typeof structuredClone === "function" ? structuredClone(v) : JSON.parse(JSON.stringify(v));
}

/** ¿El día quedó sin ningún dato? Entonces se borra en lugar de guardar un hueco. */
function diaVacio(dia: Dia | undefined): boolean {
  if (!dia) return true;
  const sinHabitos = !Object.values(dia.habitos || {}).some((v) => v === true);
  const sinNumeros = (["peso", "kcalConsumidas", "kcalQuemadas", "grasaPct"] as const).every(
    (k) => dia[k] === undefined || dia[k] === null,
  );
  const sinComidas = !dia.comidas || dia.comidas.length === 0;
  const sinNotas = !dia.notas || !String(dia.notas).trim();
  return sinHabitos && sinNumeros && sinComidas && sinNotas;
}

export function sumaKcalComidas(comidas: Comida[] | undefined): number | null {
  if (!comidas || comidas.length === 0) return null;
  return Math.round(comidas.reduce((a, c) => a + (c.kcal || 0), 0));
}

export interface RitmoContextValue {
  estado: Estado;
  modo: Modo;
  cargando: boolean;
  sincronizando: boolean;
  userEmail: string | null;
  dia: (fecha: string) => Dia;
  medicion: (fecha: string) => Composicion | null;
  alternarHabito: (fecha: string, clave: string) => Promise<void>;
  actualizarDia: (fecha: string, campos: Partial<Dia>) => Promise<void>;
  registrarComida: (fecha: string, comida: Comida) => Promise<void>;
  borrarComida: (fecha: string, id: string) => Promise<void>;
  guardarMedicion: (m: Composicion) => Promise<void>;
  borrarMedicion: (fecha: string) => Promise<void>;
  actualizarPerfil: (campos: Partial<Perfil>) => Promise<void>;
  exportar: () => object;
  importar: (datos: Partial<StoreData>) => Promise<void>;
  recargar: () => Promise<void>;
  cerrarSesion: () => Promise<void>;
}

const Ctx = React.createContext<RitmoContextValue | null>(null);

export function useRitmo(): RitmoContextValue {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useRitmo debe usarse dentro de <DataProvider>");
  return v;
}

const VACIO: StoreData = { perfil: { ...PERFIL_DEFECTO }, dias: {}, composicion: [] };

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = React.useState<StoreData>(VACIO);
  const [version, setVersion] = React.useState(0);
  const [modo, setModo] = React.useState<Modo>("local");
  const [cargando, setCargando] = React.useState(true);
  const [sincronizando, setSincronizando] = React.useState(false);
  const [userEmail, setUserEmail] = React.useState<string | null>(null);

  const adapterRef = React.useRef<Adapter | null>(null);
  const dataRef = React.useRef<StoreData>(data);
  dataRef.current = data;

  const aplicar = React.useCallback((next: StoreData) => {
    setData(next);
    setVersion((v) => v + 1);
  }, []);

  const recargar = React.useCallback(async () => {
    if (!adapterRef.current) return;
    try {
      aplicar(await adapterRef.current.load());
    } catch (e) {
      console.error("Fallo al recargar", e);
    }
  }, [aplicar]);

  React.useEffect(() => {
    let vivo = true;
    let desuscribir: (() => void) | undefined;

    (async () => {
      let adapter: Adapter;
      let modoDetectado: Modo = "nube";
      let email: string | null = null;

      // RITMO requiere Supabase y sesión activa (la redirección a login ocurre en middleware.ts)
      try {
        const client = createClient();
        const { data: sesion } = await client.auth.getUser();
        if (!sesion.user) {
          throw new Error("Sesión de Supabase requerida");
        }
        adapter = new CloudAdapter(client, sesion.user.id);
        email = sesion.user.email ?? null;
      } catch (e) {
        console.error("Fallo al inicializar Supabase", e);
        toast.error("Error de autenticación. Por favor, inicia sesión de nuevo.");
        // Fallback seguro: mostrar pantalla de error sin usar localStorage
        throw e;
      }

      adapterRef.current = adapter;
      try {
        const cargado = await adapter.load();
        if (!vivo) return;
        aplicar(cargado);
        setModo(modoDetectado);
        setUserEmail(email);
      } catch (e) {
        console.error("Fallo al cargar datos", e);
        toast.error("No se pudieron cargar los datos.");
      } finally {
        if (vivo) setCargando(false);
      }

      desuscribir = adapter.subscribe?.(() => {
        void recargar();
      });
    })();

    return () => {
      vivo = false;
      desuscribir?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Escritura optimista: aplica en memoria, persiste, y revierte si falla. */
  const commit = React.useCallback(
    async (
      mutar: (draft: StoreData) => void,
      persistir: (draft: StoreData, adapter: Adapter) => Promise<void>,
      errMsg: string,
    ) => {
      const adapter = adapterRef.current;
      if (!adapter) return;
      const prev = dataRef.current;
      const draft = clonar(prev);
      mutar(draft);
      aplicar(draft);
      setSincronizando(true);
      try {
        await persistir(draft, adapter);
      } catch (e) {
        console.error(errMsg, e);
        aplicar(prev);
        toast.error(errMsg);
      } finally {
        setSincronizando(false);
      }
    },
    [aplicar],
  );

  const dia = React.useCallback(
    (fecha: string): Dia => dataRef.current.dias[fecha] || { fecha, habitos: {} },
    [],
  );
  const medicion = React.useCallback(
    (fecha: string): Composicion | null => dataRef.current.composicion.find((m) => m.fecha === fecha) || null,
    [],
  );

  const alternarHabito = React.useCallback(
    async (fecha: string, clave: string) => {
      const actual = dataRef.current.dias[fecha] || { fecha, habitos: {} };
      const siguiente: Dia = clonar(actual);
      siguiente.fecha = fecha;
      siguiente.habitos = { ...(siguiente.habitos || {}) };
      if (siguiente.habitos[clave]) delete siguiente.habitos[clave];
      else siguiente.habitos[clave] = true;
      const borrar = diaVacio(siguiente);
      await commit(
        (d) => {
          if (borrar) delete d.dias[fecha];
          else d.dias[fecha] = siguiente;
        },
        (d, a) => (borrar ? a.borrarDia(fecha) : a.guardarDia(d.dias[fecha])),
        "No se pudo guardar el hábito.",
      );
    },
    [commit],
  );

  const actualizarDia = React.useCallback(
    async (fecha: string, campos: Partial<Dia>) => {
      const siguiente: Dia = clonar(dataRef.current.dias[fecha] || { fecha, habitos: {} });
      siguiente.fecha = fecha;
      siguiente.habitos = siguiente.habitos || {};
      const ref = siguiente as unknown as Record<string, unknown>;
      for (const [k, v] of Object.entries(campos)) {
        if (v === null || v === undefined || v === "") delete ref[k];
        else ref[k] = v;
      }
      // Las comidas mandan sobre las calorías consumidas del día.
      const sumaComidas = sumaKcalComidas(siguiente.comidas);
      if (sumaComidas !== null) siguiente.kcalConsumidas = sumaComidas;
      const borrar = diaVacio(siguiente);
      await commit(
        (d) => {
          if (borrar) delete d.dias[fecha];
          else d.dias[fecha] = siguiente;
        },
        (d, a) => (borrar ? a.borrarDia(fecha) : a.guardarDia(d.dias[fecha])),
        "No se pudieron guardar los datos del día.",
      );
    },
    [commit],
  );

  const registrarComida = React.useCallback(
    async (fecha: string, comida: Comida) => {
      const base = clonar(dataRef.current.dias[fecha] || { fecha, habitos: {} });
      const comidas = [...(base.comidas || []), comida];
      await actualizarDia(fecha, { comidas });
    },
    [actualizarDia],
  );

  const borrarComida = React.useCallback(
    async (fecha: string, id: string) => {
      const base = dataRef.current.dias[fecha];
      const comidas = (base?.comidas || []).filter((c) => c.id !== id);
      await actualizarDia(fecha, { comidas });
    },
    [actualizarDia],
  );

  const guardarMedicion = React.useCallback(
    async (m: Composicion) => {
      const existente = dataRef.current.composicion.find((x) => x.fecha === m.fecha);
      const fusionada: Composicion = { ...(existente || {}), ...m };
      await commit(
        (d) => {
          const i = d.composicion.findIndex((x) => x.fecha === m.fecha);
          if (i >= 0) d.composicion[i] = fusionada;
          else d.composicion.push(fusionada);
          d.composicion.sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
        },
        (_d, a) => a.guardarMedicion(fusionada),
        "No se pudo guardar la medición.",
      );
      // El peso de una medición es también el peso del día: historial único.
      if (typeof fusionada.peso === "number") {
        await actualizarDia(m.fecha, { peso: fusionada.peso });
      }
    },
    [commit, actualizarDia],
  );

  const borrarMedicion = React.useCallback(
    async (fecha: string) => {
      await commit(
        (d) => {
          d.composicion = d.composicion.filter((x) => x.fecha !== fecha);
        },
        (_d, a) => a.borrarMedicion(fecha),
        "No se pudo borrar la medición.",
      );
    },
    [commit],
  );

  const actualizarPerfil = React.useCallback(
    async (campos: Partial<Perfil>) => {
      const siguiente = { ...dataRef.current.perfil, ...campos };
      await commit(
        (d) => {
          d.perfil = siguiente;
        },
        (d, a) => a.guardarPerfil(d.perfil),
        "No se pudo guardar el perfil.",
      );
    },
    [commit],
  );

  const exportar = React.useCallback(
    () => ({
      version: 1,
      app: "ritmo",
      exportado: new Date().toISOString(),
      perfil: dataRef.current.perfil,
      dias: dataRef.current.dias,
      composicion: dataRef.current.composicion,
    }),
    [],
  );

  const importar = React.useCallback(
    async (datos: Partial<StoreData>) => {
      const prev = dataRef.current;
      const dias = { ...prev.dias, ...(datos.dias || {}) };
      const porFecha = new Map(prev.composicion.map((m) => [m.fecha, m] as const));
      for (const m of datos.composicion || []) porFecha.set(m.fecha, { ...(porFecha.get(m.fecha) || {}), ...m });
      const composicion = [...porFecha.values()].sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
      const perfil = { ...prev.perfil, ...(datos.perfil || {}) };
      const next: StoreData = { perfil, dias, composicion };
      aplicar(next);
      setSincronizando(true);
      try {
        if (adapterRef.current?.sembrar) await adapterRef.current.sembrar(next);
        else {
          for (const d of Object.values(dias)) await adapterRef.current?.guardarDia(d);
        }
        toast.success("Datos importados.");
      } catch (e) {
        console.error("Fallo al importar", e);
        aplicar(prev);
        toast.error("No se pudieron importar los datos.");
      } finally {
        setSincronizando(false);
      }
    },
    [aplicar],
  );

  const cerrarSesion = React.useCallback(async () => {
    const client = createClient();
    await client.auth.signOut();
    window.location.href = "/login";
  }, []);

  const estado = React.useMemo<Estado>(
    () => ({ perfil: data.perfil, dias: data.dias, composicion: data.composicion, version }),
    [data, version],
  );

  const value = React.useMemo<RitmoContextValue>(
    () => ({
      estado,
      modo,
      cargando,
      sincronizando,
      userEmail,
      dia,
      medicion,
      alternarHabito,
      actualizarDia,
      registrarComida,
      borrarComida,
      guardarMedicion,
      borrarMedicion,
      actualizarPerfil,
      exportar,
      importar,
      recargar,
      cerrarSesion,
    }),
    [estado, modo, cargando, sincronizando, userEmail, dia, medicion, alternarHabito, actualizarDia, registrarComida, borrarComida, guardarMedicion, borrarMedicion, actualizarPerfil, exportar, importar, recargar, cerrarSesion],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
