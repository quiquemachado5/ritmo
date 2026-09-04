"use client";

import { createClient } from "../supabase/client";
import { hoy } from "../model/dates";
import { pesajes, proyeccionPesoConfiable } from "../model/analytics";
import type { ConfiguracionModeloVersion, Estado, Perfil } from "../model/types";
import { VERSION_MODELO_AUDITADO } from "./evaluation";
import type { AuditoriaModelo, PrediccionEmitida } from "./types";
import { guardarAuditoriaLocal as guardarLocal, leerAuditoriaLocal, limpiarAuditoriaLocal } from "./storage";
export { leerAuditoriaLocal, limpiarAuditoriaLocal } from "./storage";

const zonaLocal = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

async function verificarCuenta(userId: string) {
  const client = createClient();
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  if (data.user?.id !== userId) throw new Error("La cuenta ha cambiado. Vuelve a abrir Progreso con tu sesión actual.");
  const { data: sesion, error: errorSesion } = await client.auth.getSession();
  if (errorSesion) throw errorSesion;
  if (sesion.session?.user.id !== userId) throw new Error("La cuenta ha cambiado antes de verificar el historial.");
  // Fijar la identidad de esta operación: el singleton puede cambiar de sesión
  // mientras el SDK resuelve su token. Nunca enviar un perfil de A como B.
  return { client, authorization: `Bearer ${sesion.session.access_token}` };
}

type Fila = Record<string, unknown>;
function configuracion(row: Fila, userId: string): ConfiguracionModeloVersion {
  if (row.user_id !== userId) throw new Error("El historial recibido no pertenece a esta cuenta.");
  return { id: String(row.id), effectiveFrom: String(row.effective_from), effectiveDate: String(row.effective_date), perfil: row.perfil as Perfil };
}
function prediccion(row: Fila, userId: string): PrediccionEmitida {
  if (row.user_id !== userId) throw new Error("La predicción recibida no pertenece a esta cuenta.");
  return {
    id: String(row.id), emitidaEn: String(row.emitida_en), fechaEmision: String(row.fecha_emision),
    fechaObjetivo: String(row.fecha_objetivo), horizonteDias: Number(row.horizonte_dias) as PrediccionEmitida["horizonteDias"],
    peso: Number(row.peso), minimo: Number(row.minimo), maximo: Number(row.maximo), pesoBase: Number(row.peso_base),
    fechaBase: String(row.fecha_base), versionModelo: String(row.version_modelo), configuracionId: String(row.configuracion_id),
    diasUtilizados: Number(row.dias_utilizados), pesajesUtilizados: Number(row.pesajes_utilizados),
  };
}

/** Una carga por sesión; ninguna información se mezcla entre identidades. */
export async function cargarAuditoria(userId: string): Promise<AuditoriaModelo> {
  const { client, authorization } = await verificarCuenta(userId);
  const paginas = async (tabla: string, orden: string) => {
    const filas: Fila[] = [];
    for (let desde = 0; ; desde += 500) {
      const { data, error } = await client.from(tabla).select("*").eq("user_id", userId).order(orden).order("id").range(desde, desde + 499).setHeader("Authorization", authorization);
      if (error) throw error;
      filas.push(...(data || []));
      if (!data || data.length < 500) return filas;
    }
  };
  const [configs, forecasts] = await Promise.all([paginas("historial_modelo", "effective_from"), paginas("predicciones_modelo", "emitida_en")]);
  await verificarCuenta(userId);
  const data = { configuraciones: configs.map((r) => configuracion(r, userId)), predicciones: forecasts.map((r) => prediccion(r, userId)) };
  guardarLocal(userId, data);
  return data;
}

export async function registrarConfiguracion(userId: string, perfil: Perfil): Promise<ConfiguracionModeloVersion[]> {
  const { client, authorization } = await verificarCuenta(userId);
  const { data, error } = await client.rpc("model_audit_snapshot", { p_perfil: perfil, p_zona: zonaLocal() }).setHeader("Authorization", authorization);
  if (error) throw error;
  await verificarCuenta(userId);
  const fila = Array.isArray(data) ? data[0] : data;
  if (!fila || typeof fila !== "object") throw new Error("La configuración no se ha confirmado. Reintenta con conexión.");
  const version = configuracion(fila as Fila, userId);
  const anterior = leerAuditoriaLocal(userId);
  const configuraciones = [...anterior.configuraciones.filter((c) => c.id !== version.id), version].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  guardarLocal(userId, { ...anterior, configuraciones });
  return configuraciones;
}

/**
 * Una emisión por día y horizonte. El servidor ignora revisiones posteriores.
 * Sin red no se fabrica un sello: se emitirá una nueva predicción al reconectar,
 * nunca una de ayer después de conocer la báscula.
 */
export async function emitirPredicciones(userId: string, estado: Estado, zona = zonaLocal()): Promise<PrediccionEmitida[]> {
  const fecha = hoy();
  const anterior = leerAuditoriaLocal(userId);
  if (anterior.predicciones.filter((p) => p.fechaEmision === fecha).length >= 4) return anterior.predicciones;
  const puntos = pesajes(estado).filter((p) => p.fecha <= fecha);
  const base = puntos.at(-1);
  if (!base) return anterior.predicciones;
  // Ni un pesaje ni hábitos de fechas futuras pueden filtrarse al pronóstico.
  const observado: Estado = { ...estado, dias: Object.fromEntries(Object.entries(estado.dias).filter(([f]) => f <= fecha)), composicion: estado.composicion.filter((c) => c.fecha <= fecha) };
  const modelo = proyeccionPesoConfiable(observado);
  const config = estado.perfilHistorial?.at(-1);
  if (!config) throw new Error("Verifica la configuración del modelo antes de guardar predicciones.");
  const forecasts = ([ [1, modelo.manana], [3, modelo.tresDias], [7, modelo.semana], [30, modelo.mes] ] as const)
    .flatMap(([horizonteDias, intervalo]) => intervalo ? [{
      horizonteDias, peso: intervalo.peso, minimo: intervalo.minimo, maximo: intervalo.maximo,
      pesoBase: base.peso, fechaBase: base.fecha, versionModelo: VERSION_MODELO_AUDITADO,
      diasUtilizados: Object.keys(observado.dias).length, pesajesUtilizados: puntos.length,
    }] : []);
  if (!forecasts.length) return anterior.predicciones;
  const { client, authorization } = await verificarCuenta(userId);
  const { data, error } = await client.rpc("model_audit_forecast", { p_fecha: fecha, p_zona: zona, p_predicciones: forecasts, p_configuracion: config.id }).setHeader("Authorization", authorization);
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error("El servidor no ha confirmado las predicciones. Reintenta con conexión.");
  await verificarCuenta(userId);
  const nuevas = (data as Fila[]).map((r) => prediccion(r, userId));
  const ids = new Set(nuevas.map((p) => p.id));
  const actual = leerAuditoriaLocal(userId);
  const predicciones = [...actual.predicciones.filter((p) => !ids.has(p.id)), ...nuevas].sort((a, b) => a.emitidaEn.localeCompare(b.emitidaEn));
  guardarLocal(userId, { ...actual, predicciones });
  return predicciones;
}

export async function borrarAuditoria(userId: string): Promise<void> {
  const { client, authorization } = await verificarCuenta(userId);
  const { error } = await client.rpc("clear_my_model_audit").setHeader("Authorization", authorization);
  if (error) throw error;
  limpiarAuditoriaLocal(userId);
}
