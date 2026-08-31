"use client";

import * as React from "react";
import { toast } from "sonner";
import { PERFIL_DEFECTO } from "@/lib/model/config";
import type { Comida, Composicion, Dia, Estado, Perfil } from "@/lib/model/types";
import { createClient } from "@/lib/supabase/client";
import { CloudAdapter } from "./cloud";
import { QueuedAdapter } from "./queued";
import type { Adapter, Modo, StoreData } from "./types";
import { fusionarImport } from "./merge";
import { analizarImportacion } from "./import";
import { registrarDiagnostico } from "@/lib/observability";

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
  editarComida: (fecha: string, comida: Comida) => Promise<void>;
  borrarComida: (fecha: string, id: string) => Promise<void>;
  guardarMedicion: (m: Composicion) => Promise<void>;
  borrarMedicion: (fecha: string) => Promise<void>;
  actualizarPerfil: (campos: Partial<Perfil>) => Promise<void>;
  exportar: () => object;
  importar: (datos: Partial<StoreData>) => Promise<void>;
  recargar: () => Promise<void>;
  cerrarSesion: () => Promise<void>;
  borrarDatos: () => Promise<void>;
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
  const [authUserId, setAuthUserId] = React.useState<string | null | undefined>(undefined);
  const [supabase] = React.useState(createClient);

  const adapterRef = React.useRef<Adapter | null>(null);
  const dataRef = React.useRef<StoreData>(data);
  dataRef.current = data;

  const aplicar = React.useCallback((next: StoreData) => {
    setData({
      perfil: { ...PERFIL_DEFECTO, ...(next.perfil || {}) },
      dias: next.dias || {},
      composicion: next.composicion || [],
    });
    setVersion((v) => v + 1);
  }, []);

  const recargar = React.useCallback(async () => {
    if (!adapterRef.current) return;
    try {
      aplicar(await adapterRef.current.load());
    } catch (e) {
      console.error("Fallo al recargar", e);
      registrarDiagnostico("sync", "error", "recarga fallida");
    }
  }, [aplicar]);

  // Escucha el cambio de identidad, no solo el primer montaje. Así no se
  // conserva en memoria el perfil de la cuenta anterior tras cerrar sesión.
  React.useEffect(() => {
    const client = supabase;
    let vivo = true;
    void client.auth.getUser().then(({ data }) => {
      if (vivo) setAuthUserId(data.user?.id ?? null);
    });
    const { data: listener } = client.auth.onAuthStateChange((_evento, session) => {
      setAuthUserId(session?.user?.id ?? null);
    });
    return () => {
      vivo = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  React.useEffect(() => {
    let vivo = true;
    let desuscribir: (() => void) | undefined;

    (async () => {
      if (authUserId === undefined) return;
      // Mientras se resuelve la cuenta nueva, no mostramos ni datos ni estado
      // de onboarding de la anterior.
      adapterRef.current?.dispose?.();
      adapterRef.current = null;
      aplicar(clonar(VACIO));
      setUserEmail(null);
      setCargando(true);
      if (!authUserId) {
        if (vivo) setCargando(false);
        return;
      }
      let adapter: Adapter;
      const modoDetectado: Modo = "nube";
      let email: string | null = null;

      // RITMO requiere Supabase y sesión activa (la redirección a login ocurre en middleware.ts)
      try {
        const client = supabase;
        const { data: sesion } = await client.auth.getUser();
        if (!sesion.user || sesion.user.id !== authUserId) {
          throw new Error("Sesión de Supabase requerida");
        }
        // Envuelto en la cola offline: los cambios sin red se guardan y se
        // sincronizan al reconectar, en vez de perderse o revertirse.
        adapter = new QueuedAdapter(new CloudAdapter(client, sesion.user.id), sesion.user.id);
        email = sesion.user.email ?? null;
      } catch (e) {
        console.error("Fallo al inicializar Supabase", e);
        registrarDiagnostico("auth", "error", "inicio de sesión no disponible");
        if (vivo) {
          setCargando(false);
          toast.error("Error de autenticación. Por favor, inicia sesión de nuevo.");
        }
        return;
      }

      adapterRef.current = adapter;
      try {
        const cargado = await adapter.load();
        if (!vivo) return;
        aplicar(cargado);
        setModo(modoDetectado);
        setUserEmail(email);
        registrarDiagnostico("auth", "ok", "sesión restaurada");
      } catch (e) {
        console.error("Fallo al cargar datos", e);
        registrarDiagnostico("sync", "error", "carga inicial fallida");
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
  }, [authUserId, aplicar, recargar, supabase]);

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
        registrarDiagnostico("sync", "ok", "cambio guardado");
      } catch (e) {
        console.error(errMsg, e);
        registrarDiagnostico("sync", "error", "cambio no sincronizado");
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

  const editarComida = React.useCallback(
    async (fecha: string, comida: Comida) => {
      const base = clonar(dataRef.current.dias[fecha] || { fecha, habitos: {} });
      const previas = base.comidas || [];
      const existe = previas.some((c) => c.id === comida.id);
      // Si existe, reemplaza en su sitio; si no (p. ej. día cambiado), añade.
      const comidas = existe
        ? previas.map((c) => (c.id === comida.id ? comida : c))
        : [...previas, comida];
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
      const analisis = analizarImportacion(datos, prev);
      if (!analisis.valido) {
        registrarDiagnostico("import", "warning", analisis.error);
        throw new Error(analisis.error);
      }
      const next = fusionarImport(prev, datos);
      const { dias } = next;
      aplicar(next);
      setSincronizando(true);
      try {
        if (adapterRef.current?.sembrar) await adapterRef.current.sembrar(next);
        else {
          for (const d of Object.values(dias)) await adapterRef.current?.guardarDia(d);
        }
        registrarDiagnostico("import", "ok", "respaldo fusionado");
        toast.success("Datos importados.");
      } catch (e) {
        console.error("Fallo al importar", e);
        registrarDiagnostico("import", "error", "falló la importación");
        aplicar(prev);
        toast.error("No se pudieron importar los datos.");
      } finally {
        setSincronizando(false);
      }
    },
    [aplicar],
  );

  const cerrarSesion = React.useCallback(async () => {
    adapterRef.current?.dispose?.();
    adapterRef.current = null;
    aplicar(clonar(VACIO));
    setUserEmail(null);
    registrarDiagnostico("auth", "ok", "sesión cerrada");
    await supabase.auth.signOut({ scope: "local" });
    window.location.replace("/login");
  }, [aplicar, supabase]);

  const borrarDatos = React.useCallback(async () => {
    if (!adapterRef.current?.borrarTodo) throw new Error("No se pudo preparar el borrado de datos.");
    await adapterRef.current.borrarTodo();
    aplicar(clonar(VACIO));
  }, [aplicar]);

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
      editarComida,
      borrarComida,
      guardarMedicion,
      borrarMedicion,
      actualizarPerfil,
      exportar,
      importar,
      recargar,
      cerrarSesion,
      borrarDatos,
    }),
    [estado, modo, cargando, sincronizando, userEmail, dia, medicion, alternarHabito, actualizarDia, registrarComida, editarComida, borrarComida, guardarMedicion, borrarMedicion, actualizarPerfil, exportar, importar, recargar, cerrarSesion, borrarDatos],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
