"use client";

import * as React from "react";
import { toast } from "sonner";
import { PERFIL_DEFECTO } from "@/lib/model/config";
import { perfilesEquivalentes } from "@/lib/model/profile-history";
import type { Comida, Composicion, Dia, Estado, Perfil } from "@/lib/model/types";
import { createClient } from "@/lib/supabase/client";
import { CloudAdapter } from "./cloud";
import { QueuedAdapter } from "./queued";
import type { Adapter, Modo, StoreData } from "./types";
import { fusionarImport } from "./merge";
import { analizarImportacion, type ArchivoRitmo } from "./import";
import { registrarDiagnostico, configurarDiagnosticoUsuario } from "@/lib/observability";
import { recalcularKcalComidas } from "./day";
import { BACKUP_FORMAT_VERSION, DATABASE_MIGRATION_VERSION } from "@/lib/version";
import { cargarAuditoria, emitirPredicciones, leerAuditoriaLocal, limpiarAuditoriaLocal, registrarConfiguracion } from "@/lib/model-audit/client";
import type { AuditoriaModelo } from "@/lib/model-audit/types";
import { conservarAuditoriaDocumental, leerAuditoriaDocumental, limpiarAuditoriaDocumental } from "@/lib/model-audit/documentary";
import { hoy } from "@/lib/model/dates";
import {
  activarPreferenciasUsuario,
  guardarPreferenciasPerfil,
  leerPreferenciasPerfil,
  exportarPreferencias,
  importarPreferencias,
} from "@/lib/meal-prefs";
import { repararSaludDatos } from "@/lib/data-health";

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

export interface RitmoContextValue {
  estado: Estado;
  auditoriaModelo: AuditoriaModelo;
  errorAuditoria: boolean;
  reintentarAuditoria: () => Promise<void>;
  modo: Modo;
  cargando: boolean;
  cargaValida: boolean;
  errorCarga: boolean;
  sincronizando: boolean;
  userId: string | null;
  userEmail: string | null;
  dia: (fecha: string) => Dia;
  medicion: (fecha: string) => Composicion | null;
  alternarHabito: (fecha: string, clave: string) => Promise<boolean>;
  actualizarDia: (fecha: string, campos: Partial<Dia>) => Promise<boolean>;
  registrarComida: (fecha: string, comida: Comida) => Promise<boolean>;
  editarComida: (fecha: string, comida: Comida) => Promise<boolean>;
  borrarComida: (fecha: string, id: string) => Promise<boolean>;
  guardarMedicion: (m: Composicion) => Promise<boolean>;
  borrarMedicion: (fecha: string) => Promise<boolean>;
  actualizarPerfil: (campos: Partial<Perfil>) => Promise<boolean>;
  exportar: () => ArchivoRitmo & StoreData;
  importar: (datos: Partial<StoreData>) => Promise<void>;
  repararDatos: () => Promise<number>;
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
const AUDITORIA_VACIA: AuditoriaModelo = { configuraciones: [], predicciones: [] };

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = React.useState<StoreData>(VACIO);
  const [version, setVersion] = React.useState(0);
  const [modo, setModo] = React.useState<Modo>("local");
  const [cargando, setCargando] = React.useState(true);
  const [cargaValida, setCargaValida] = React.useState(false);
  const [errorCarga, setErrorCarga] = React.useState(false);
  const cargaValidaRef = React.useRef(false);
  const [sincronizando, setSincronizando] = React.useState(false);
  const [userEmail, setUserEmail] = React.useState<string | null>(null);
  const [authUserId, setAuthUserId] = React.useState<string | null | undefined>(undefined);
  const [supabase] = React.useState(createClient);
  const [auditoriaModelo, setAuditoriaModelo] = React.useState<AuditoriaModelo>(AUDITORIA_VACIA);
  const [errorAuditoria, setErrorAuditoria] = React.useState(false);
  const auditoriaRef = React.useRef(AUDITORIA_VACIA);
  const auditoriaCargada = React.useRef<string | null>(null);
  const colaAuditoria = React.useRef<Promise<void>>(Promise.resolve());
  const [fechaAuditoria, setFechaAuditoria] = React.useState(hoy);

  const adapterRef = React.useRef<Adapter | null>(null);
  const dataRef = React.useRef<StoreData>(data);
  const revisionRef = React.useRef(0);
  const escriturasRef = React.useRef(0);

  const aplicar = React.useCallback((next: StoreData) => {
    const normalizado = {
      perfil: { ...PERFIL_DEFECTO, ...(next.perfil || {}) },
      dias: next.dias || {},
      composicion: next.composicion || [],
    };
    // Mantén la referencia operativa al día de forma síncrona. Así dos toques
    // rápidos no parten del mismo estado obsoleto y no se pisan entre sí.
    dataRef.current = normalizado;
    setData(normalizado);
    setVersion((v) => v + 1);
  }, []);

  const recargar = React.useCallback(async () => {
    const adapter = adapterRef.current;
    const revision = revisionRef.current;
    if (!adapter) { window.location.reload(); return; }
    if (escriturasRef.current > 0) return;
    try {
      const cargado = await adapter.load();
      if (adapterRef.current !== adapter || revisionRef.current !== revision || escriturasRef.current > 0) return;
      aplicar({
        ...cargado,
        perfil: { ...cargado.perfil, ...leerPreferenciasPerfil() },
      });
      cargaValidaRef.current = true;
      setCargaValida(true);
      setErrorCarga(false);
    } catch (e) {
      console.error("Fallo al recargar", e);
      registrarDiagnostico("sync", "error", "recarga fallida");
    }
  }, [aplicar]);

  const actualizarAuditoria = React.useCallback((forzar: boolean) => {
    const adapter = adapterRef.current;
    const userId = authUserId;
    const vigente = () => Boolean(userId && adapter && adapterRef.current === adapter && cargaValidaRef.current);
    const tarea = async () => {
      if (!vigente() || !userId || !dataRef.current.perfil.onboardingCompleto) return;
      try {
        if (forzar || auditoriaCargada.current !== userId) {
          await cargarAuditoria(userId);
          if (!vigente()) return;
          auditoriaCargada.current = userId;
        }
        const observado: Estado = { ...clonar(dataRef.current), version: revisionRef.current };
        const perfil = observado.perfil;
        const anterior = leerAuditoriaLocal(userId);
        const ultima = anterior.configuraciones.at(-1);
        const configuraciones = ultima && perfilesEquivalentes(ultima.perfil, perfil)
          ? anterior.configuraciones : await registrarConfiguracion(userId, perfil);
        if (!vigente()) return;
        // Perfil, hábitos y pesos pertenecen al mismo instante. Una edición
        // durante el guardado del snapshot no mezcla ajustes nuevos y antiguos.
        observado.perfilHistorial = configuraciones;
        await emitirPredicciones(userId, observado);
        if (!vigente()) return;
        const audit = leerAuditoriaLocal(userId);
        auditoriaRef.current = audit;
        setAuditoriaModelo(audit);
        setErrorAuditoria(false);
      } catch {
        if (!vigente() || !userId) return;
        // Una caída de la auditoría nunca debe bloquear Hoy ni sustituir datos.
        try { const audit = leerAuditoriaLocal(userId); auditoriaRef.current = audit; setAuditoriaModelo(audit); } catch { /* Copia dañada: recuperar del servidor al reintentar. */ }
        setErrorAuditoria(true);
        registrarDiagnostico("sync", "warning", "historial del modelo pendiente de sincronizar");
      }
    };
    colaAuditoria.current = colaAuditoria.current.then(tarea, tarea);
    return colaAuditoria.current;
  }, [authUserId]);
  const reintentarAuditoria = React.useCallback(() => actualizarAuditoria(true), [actualizarAuditoria]);
  const perfilAuditable = JSON.stringify(data.perfil);
  const tienePesajes = data.composicion.length > 0 || Object.values(data.dias).some(d => typeof d.peso === "number");
  React.useEffect(() => {
    if (cargando || !cargaValida || sincronizando) return;
    const timer = setTimeout(() => { void actualizarAuditoria(false); }, 750);
    return () => clearTimeout(timer);
  }, [actualizarAuditoria, cargando, cargaValida, sincronizando, perfilAuditable, tienePesajes, fechaAuditoria]);
  React.useEffect(() => {
    const comprobar = () => setFechaAuditoria(hoy());
    const reconectar = () => { comprobar(); void actualizarAuditoria(true); };
    const timer = setInterval(comprobar, 60_000);
    window.addEventListener("focus", comprobar);
    window.addEventListener("online", reconectar);
    return () => { clearInterval(timer); window.removeEventListener("focus", comprobar); window.removeEventListener("online", reconectar); };
  }, [actualizarAuditoria]);

  // Escucha el cambio de identidad, no solo el primer montaje. Así no se
  // conserva en memoria el perfil de la cuenta anterior tras cerrar sesión.
  React.useEffect(() => {
    const client = supabase;
    let vivo = true;
    let identidadCambiada = false;
    void client.auth.getUser().then(({ data }) => {
      if (vivo && !identidadCambiada) setAuthUserId(data.user?.id ?? null);
    }).catch(() => { if (vivo && !identidadCambiada) { setErrorCarga(true); setCargando(false); } });
    const { data: listener } = client.auth.onAuthStateChange((_evento, session) => {
      if (!vivo) return;
      if (_evento !== "INITIAL_SESSION") identidadCambiada = true;
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
      configurarDiagnosticoUsuario(authUserId);
      // Mientras se resuelve la cuenta nueva, no mostramos ni datos ni estado
      // de onboarding de la anterior.
      adapterRef.current?.dispose?.();
      adapterRef.current = null;
      auditoriaCargada.current = null;
      auditoriaRef.current = AUDITORIA_VACIA;
      setAuditoriaModelo(AUDITORIA_VACIA);
      setErrorAuditoria(false);
      aplicar(clonar(VACIO));
      setUserEmail(null);
      setCargando(true);
      cargaValidaRef.current = false;
      setCargaValida(false);
      setErrorCarga(false);
      revisionRef.current += 1;
      if (!authUserId) {
        await activarPreferenciasUsuario(null);
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
        if (!vivo) return;
        if (!sesion.user || sesion.user.id !== authUserId) {
          throw new Error("Sesión de Supabase requerida");
        }
        // Envuelto en la cola offline: los cambios sin red se guardan y se
        // sincronizan al reconectar, en vez de perderse o revertirse.
        adapter = new QueuedAdapter(new CloudAdapter(client, sesion.user.id), sesion.user.id);
        email = sesion.user.email ?? null;
        await activarPreferenciasUsuario(sesion.user.id);
        if (!vivo) { adapter.dispose?.(); return; }
      } catch (e) {
        console.error("Fallo al inicializar Supabase", e);
        registrarDiagnostico("auth", "error", "inicio de sesión no disponible");
        if (vivo) {
          setCargando(false);
          setErrorCarga(true);
          toast.error("Error de autenticación. Por favor, inicia sesión de nuevo.");
        }
        return;
      }

      adapterRef.current = adapter;
      try {
        const cargado = await adapter.load();
        if (!vivo) return;
        aplicar({
          ...cargado,
          perfil: { ...cargado.perfil, ...leerPreferenciasPerfil() },
        });
        setModo(modoDetectado);
        cargaValidaRef.current = true;
        setCargaValida(true);
        setUserEmail(email);
        registrarDiagnostico("auth", "ok", "sesión restaurada");
      } catch (e) {
        if (!vivo) return;
        console.error("Fallo al cargar datos", e);
        registrarDiagnostico("sync", "error", "carga inicial fallida");
        toast.error("No se pudieron cargar los datos.");
        setErrorCarga(true);
      } finally {
        if (vivo) setCargando(false);
      }

      if (!vivo) return;
      let refresco: ReturnType<typeof setTimeout>;
      const cancelar = adapter.subscribe?.(() => {
        clearTimeout(refresco);
        refresco = setTimeout(() => { void recargar(); }, 400);
      });
      desuscribir = () => { clearTimeout(refresco); cancelar?.(); adapter.dispose?.(); };
    })();

    return () => {
      vivo = false;
      desuscribir?.();
    };
  }, [authUserId, aplicar, recargar, supabase]);

  /** Escritura optimista: aplica en memoria, persiste, y revierte si falla. */
  const commit = React.useCallback(
    async (
      mutar: (draft: StoreData) => void,
      persistir: (draft: StoreData, adapter: Adapter) => Promise<void>,
      errMsg: string,
    ): Promise<boolean> => {
      const adapter = adapterRef.current;
      if (!adapter || !cargaValidaRef.current) {
        toast.error("Espera a que carguen tus datos antes de guardar.");
        return false;
      }
      const prev = dataRef.current;
      const draft = clonar(prev);
      const revision = ++revisionRef.current;
      mutar(draft);
      aplicar(draft);
      escriturasRef.current += 1;
      setSincronizando(true);
      try {
        await persistir(draft, adapter);
        registrarDiagnostico("sync", "ok", "cambio guardado");
        return adapterRef.current === adapter;
      } catch (e) {
        console.error(errMsg, e);
        registrarDiagnostico("sync", "error", "cambio no sincronizado");
        // Si ya hubo otra escritura posterior, su borrador contiene este
        // cambio y no debemos destruirla restaurando un snapshot antiguo.
        if (adapterRef.current === adapter && revisionRef.current === revision) aplicar(prev);
        toast.error(errMsg);
        return false;
      } finally {
        escriturasRef.current = Math.max(0, escriturasRef.current - 1);
        setSincronizando(escriturasRef.current > 0);
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
      return commit(
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
      let siguiente: Dia = clonar(dataRef.current.dias[fecha] || { fecha, habitos: {} });
      siguiente.fecha = fecha;
      siguiente.habitos = siguiente.habitos || {};
      const ref = siguiente as unknown as Record<string, unknown>;
      for (const [k, v] of Object.entries(campos)) {
        if (v === null || v === undefined || v === "") delete ref[k];
        else ref[k] = v;
      }
      // Las comidas mandan sobre las calorías consumidas del día. Solo
      // recalculamos cuando esta operación toca comidas: al borrar la última,
      // también desaparece el total anterior en vez de quedar como dato zombi.
      siguiente = recalcularKcalComidas(
        siguiente,
        Object.prototype.hasOwnProperty.call(campos, "comidas"),
      );
      const borrar = diaVacio(siguiente);
      return commit(
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
      const comidas = [...(base.comidas || []).filter(c => c.id !== comida.id), comida];
      return actualizarDia(fecha, { comidas });
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
      return actualizarDia(fecha, { comidas });
    },
    [actualizarDia],
  );

  const borrarComida = React.useCallback(
    async (fecha: string, id: string) => {
      const base = dataRef.current.dias[fecha];
      const comidas = (base?.comidas || []).filter((c) => c.id !== id);
      return actualizarDia(fecha, { comidas });
    },
    [actualizarDia],
  );

  const guardarMedicion = React.useCallback(
    async (m: Composicion) => {
      const existente = dataRef.current.composicion.find((x) => x.fecha === m.fecha);
      const fusionada: Composicion = { ...(existente || {}), ...m };
      const guardada = await commit(
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
      if (guardada && typeof fusionada.peso === "number") {
        return actualizarDia(m.fecha, { peso: fusionada.peso });
      }
      return guardada;
    },
    [commit, actualizarDia],
  );

  const borrarMedicion = React.useCallback(
    async (fecha: string) => {
      const borrada = await commit(
        (d) => {
          d.composicion = d.composicion.filter((x) => x.fecha !== fecha);
        },
        (_d, a) => a.borrarMedicion(fecha),
        "No se pudo borrar la medición.",
      );
      // Una medición y el peso diario son dos vistas del mismo registro.
      // Evita que un pesaje borrado siga alimentando calendario y predicción.
      return borrada ? actualizarDia(fecha, { peso: undefined }) : false;
    },
    [commit, actualizarDia],
  );

  const actualizarPerfil = React.useCallback(
    async (campos: Partial<Perfil>) => {
      const siguiente = { ...dataRef.current.perfil, ...campos };
      const guardado = await commit(
        (d) => {
          d.perfil = siguiente;
        },
        (d, a) => a.guardarPerfil(d.perfil),
        "No se pudo guardar el perfil.",
      );
      return guardado && guardarPreferenciasPerfil(campos);
    },
    [commit],
  );

  const exportar = React.useCallback(
    () => ({
      version: BACKUP_FORMAT_VERSION,
      schemaVersion: DATABASE_MIGRATION_VERSION,
      app: "ritmo",
      exportado: new Date().toISOString(),
      perfil: dataRef.current.perfil,
      dias: dataRef.current.dias,
      composicion: dataRef.current.composicion,
      preferencias: exportarPreferencias(),
      auditoriaModelo: auditoriaRef.current,
      auditoriaDocumental: authUserId ? leerAuditoriaDocumental(authUserId) : AUDITORIA_VACIA,
    }),
    [authUserId],
  );

  const importar = React.useCallback(
    async (datos: Partial<StoreData>) => {
      const prev = dataRef.current;
      const adapter = adapterRef.current;
      if (!adapter || !cargaValidaRef.current) throw new Error("Carga tus datos antes de importar.");
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
        if (adapter.sembrar) await adapter.sembrar(next);
        else {
          for (const d of Object.values(dias)) {
            if (adapterRef.current !== adapter) throw new Error("La cuenta cambió durante la importación.");
            await adapter.guardarDia(d);
          }
        }
        if (adapterRef.current !== adapter) throw new Error("La cuenta cambió durante la importación.");
        if (!guardarPreferenciasPerfil(next.perfil)) throw new Error("No se pudieron conservar los ajustes del perfil.");
        if ((datos as ArchivoRitmo).preferencias && !importarPreferencias((datos as ArchivoRitmo).preferencias!)) throw new Error("No se pudo conservar la biblioteca importada.");
        if (authUserId) conservarAuditoriaDocumental(authUserId, (datos as ArchivoRitmo).auditoriaModelo, (datos as ArchivoRitmo).auditoriaDocumental);
        registrarDiagnostico("import", "ok", "respaldo fusionado");
        toast.success("Datos importados.");
      } catch (e) {
        console.error("Fallo al importar", e);
        registrarDiagnostico("import", "error", "falló la importación");
        if (adapterRef.current === adapter) aplicar(prev);
        toast.error("No se pudieron importar los datos.");
        throw e;
      } finally {
        setSincronizando(false);
      }
    },
    [aplicar, authUserId],
  );

  const repararDatos = React.useCallback(async () => {
    const reparacion = repararSaludDatos(dataRef.current);
    if (reparacion.changes === 0) return 0;
    const ok = await commit(
      (draft) => {
        draft.perfil = reparacion.data.perfil;
        draft.dias = reparacion.data.dias;
        draft.composicion = reparacion.data.composicion;
      },
      async (_draft, adapter) => {
        if (!adapter.sembrar) throw new Error("La reparación segura no está disponible en esta cuenta.");
        await adapter.sembrar(reparacion.data);
      },
      "No se pudieron reparar los datos. No se ha perdido ningún registro.",
    );
    if (ok) {
      toast.success(`${reparacion.changes} ${reparacion.changes === 1 ? "ajuste reparado" : "ajustes reparados"}.`);
      return reparacion.changes;
    }
    return 0;
  }, [commit]);

  const cerrarSesion = React.useCallback(async () => {
    cargaValidaRef.current = false;
    setCargaValida(false);
    adapterRef.current?.dispose?.();
    adapterRef.current = null;
    auditoriaRef.current = AUDITORIA_VACIA;
    setAuditoriaModelo(AUDITORIA_VACIA);
    await activarPreferenciasUsuario(null);
    aplicar(clonar(VACIO));
    setUserEmail(null);
    registrarDiagnostico("auth", "ok", "sesión cerrada");
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) {
      registrarDiagnostico("auth", "error", "cierre de sesión fallido");
      toast.error("No se pudo cerrar la sesión. Vuelve a intentarlo.");
      window.location.reload();
      return;
    }
    window.location.replace("/login");
  }, [aplicar, supabase]);

  const borrarDatos = React.useCallback(async () => {
    const adapter = adapterRef.current;
    if (!adapter?.borrarTodo) throw new Error("No se pudo preparar el borrado de datos.");
    // Desactiva nuevas copias antes de empezar a borrar, no después.
    cargaValidaRef.current = false;
    setCargaValida(false);
    try {
      await colaAuditoria.current;
      await adapter.borrarTodo();
      if (adapterRef.current === adapter) {
        if (authUserId) { limpiarAuditoriaLocal(authUserId); limpiarAuditoriaDocumental(authUserId); }
        auditoriaRef.current = AUDITORIA_VACIA;
        setAuditoriaModelo(AUDITORIA_VACIA);
        aplicar(clonar(VACIO));
      }
    } catch (error) {
      if (adapterRef.current === adapter) setErrorCarga(true);
      throw error;
    }
  }, [aplicar, authUserId]);

  const estado = React.useMemo<Estado>(
    () => ({ perfil: data.perfil, dias: data.dias, composicion: data.composicion, perfilHistorial: auditoriaModelo.configuraciones, version }),
    [data, version, auditoriaModelo.configuraciones],
  );

  const value = React.useMemo<RitmoContextValue>(
    () => ({
      estado,
      auditoriaModelo,
      errorAuditoria,
      reintentarAuditoria,
      modo,
      cargando,
      cargaValida,
      errorCarga,
      sincronizando,
      userId: authUserId ?? null,
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
      repararDatos,
      recargar,
      cerrarSesion,
      borrarDatos,
    }),
    [estado, auditoriaModelo, errorAuditoria, reintentarAuditoria, modo, cargando, cargaValida, errorCarga, sincronizando, authUserId, userEmail, dia, medicion, alternarHabito, actualizarDia, registrarComida, editarComida, borrarComida, guardarMedicion, borrarMedicion, actualizarPerfil, exportar, importar, repararDatos, recargar, cerrarSesion, borrarDatos],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
