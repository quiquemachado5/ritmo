"use client";

import * as React from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { registrarDiagnostico } from "@/lib/observability";
import type { Perfil } from "@/lib/model/types";
import type { CorreccionNutricional, ItemNutricional } from "@/lib/nutrition/types";
import { normalizarNombreIngrediente } from "@/lib/nutrition/corrections";
import type { ComidaPlanificada } from "@/lib/nutrition/portions";

/* Preferencias de la biblioteca de comidas, sincronizadas entre dispositivos.
   - Cache inmediata en localStorage (rápida, offline).
   - Sync last-write-wins con Supabase (tabla user_prefs, columna jsonb).
   Contiene: favoritas, comidas ocultas, ediciones (overrides) y catálogo de
   comidas creadas a mano (para tener en la biblioteca sin registrarlas en un
   día). Degrada con elegancia: si la tabla no existe aún o no hay red, todo
   sigue funcionando en local. */

export interface OverrideComida {
  texto?: string;
  kcal?: number;
  proteinas?: number;
  carbohidratos?: number;
  grasas?: number;
}

export interface ComidaCatalogo {
  ingredientes?: ItemNutricional[];
  clave: string; // "tipo:texto normalizado"
  texto: string;
  tipo: string;
  kcal: number;
  proteinas: number;
  carbohidratos: number;
  grasas: number;
  creado: string;
}

/** Una plantilla es una comida reutilizable con nombre propio y macros fijadas. */
export interface PlantillaComida extends ComidaCatalogo {
  id: string;
  nombre: string;
}

export type PreferenciasPerfil = Partial<
  Pick<
    Perfil,
    "imputarActiva" | "imputarDesde" | "imputarSuperavitKcal" | "habitosPersonalizados" | "habitosDesactivados"
  >
>;

export interface MealPrefs {
  /** Solo compatibilidad con copias anteriores; el plan ya no forma parte de la interfaz. */
  plan: ComidaPlanificada[];
  fav: string[];
  hidden: string[];
  overrides: Record<string, OverrideComida>;
  catalog: ComidaCatalogo[];
  templates: PlantillaComida[];
  /** Referencias confirmadas por el usuario para personalizar futuros análisis. */
  nutritionCorrections: Record<string, CorreccionNutricional>;
  /** Ajustes del modelo que no requieren columnas nuevas en Supabase. */
  profile: PreferenciasPerfil;
  updatedAt: number;
}

const KEY_PREFIX = "ritmo:mealprefs";
const VACIO: MealPrefs = { plan: [], fav: [], hidden: [], overrides: {}, catalog: [], templates: [], nutritionCorrections: {}, profile: {}, updatedAt: 0 };
const CLAVES_PERFIL = [
  "imputarActiva",
  "imputarDesde",
  "imputarSuperavitKcal",
  "habitosPersonalizados",
  "habitosDesactivados",
] as const;

function normalizar(p: Partial<MealPrefs> | null | undefined): MealPrefs {
  return {
    plan: p?.plan ?? [],
    fav: p?.fav ?? [],
    hidden: p?.hidden ?? [],
    overrides: p?.overrides ?? {},
    catalog: p?.catalog ?? [],
    templates: p?.templates ?? [],
    nutritionCorrections: p?.nutritionCorrections ?? {},
    profile: p?.profile ?? {},
    updatedAt: p?.updatedAt ?? 0,
  };
}

function claveLocal(userId: string): string {
  return `${KEY_PREFIX}:${userId}`;
}

function leerLocal(userId: string): MealPrefs {
  if (typeof localStorage === "undefined") return VACIO;
  try {
    const raw = localStorage.getItem(claveLocal(userId));
    return raw ? normalizar(JSON.parse(raw)) : VACIO;
  } catch {
    return VACIO;
  }
}

const listeners = new Set<() => void>();
let cache: MealPrefs = VACIO;
let usuarioActivo: string | null = null;
let revisionUsuario = 0;

function snapshot(): MealPrefs {
  return cache;
}

function emitir() {
  listeners.forEach((l) => l());
}

/* ------------------------------------------------------------- sync nube */

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let listenerOnlineIniciado = false;

async function empujarNube(userId = usuarioActivo, prefs = snapshot()): Promise<boolean> {
  if (!userId) return false;
  try {
    const sb = createClient();
    const { error } = await sb.from("user_prefs").upsert(
      { user_id: userId, meal_prefs: prefs, actualizado_en: new Date().toISOString() },
      { onConflict: "user_id" },
    );
    if (error) throw error;
    registrarDiagnostico("sync", "ok", "preferencias sincronizadas");
    return true;
  } catch (error) {
    console.error("No se pudieron sincronizar las preferencias", error);
    registrarDiagnostico("sync", "error", "preferencias no sincronizadas");
    return false;
  }
}

/** Carga inicial desde la nube; si es más nueva, sustituye la local. */
async function cargarNube(userId: string, revision: number) {
  try {
    const sb = createClient();
    const { data, error } = await sb.from("user_prefs").select("meal_prefs").eq("user_id", userId).maybeSingle();
    if (error) throw error;
    if (usuarioActivo !== userId || revisionUsuario !== revision) return;
    const local = snapshot();
    if (!data?.meal_prefs) {
      if (local.updatedAt > 0) await empujarNube(userId, local);
      return;
    }
    const remota = normalizar(data.meal_prefs as Partial<MealPrefs>);
    if (remota.updatedAt > local.updatedAt) {
      cache = remota;
      try { localStorage.setItem(claveLocal(userId), JSON.stringify(remota)); } catch {}
      emitir();
    } else if (local.updatedAt > remota.updatedAt) {
      await empujarNube(userId, local);
    }
  } catch (error) {
    console.error("No se pudieron cargar las preferencias", error);
    registrarDiagnostico("sync", "error", "preferencias no disponibles");
  }
}

function programarPush() {
  if (!usuarioActivo) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => void empujarNube(), 1200);
}

function escribir(next: Omit<MealPrefs, "updatedAt">) {
  if (!usuarioActivo) { toast.error("Inicia sesión para guardar este cambio."); return false; }
  const siguiente = { ...next, updatedAt: Date.now() };
  try { localStorage.setItem(claveLocal(usuarioActivo), JSON.stringify(siguiente)); }
  catch {
    toast.error("No se pudo conservar el cambio en este dispositivo. Libera espacio y reintenta.");
    registrarDiagnostico("sync", "error", "preferencias no conservadas");
    return false;
  }
  cache = siguiente;
  emitir();
  programarPush();
  return true;
}

/**
 * Cambia el ámbito de preferencias al usuario autenticado. Nunca reutiliza la
 * caché global antigua: eso podía mostrar o subir comidas de otra cuenta.
 */
export async function activarPreferenciasUsuario(userId: string | null): Promise<void> {
  const revision = ++revisionUsuario;
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  usuarioActivo = userId;
  // La versión anterior usaba una única clave para todas las cuentas. No se
  // migra porque no es posible demostrar a qué usuario pertenecía.
  try { localStorage.removeItem(KEY_PREFIX); } catch {}
  cache = userId ? leerLocal(userId) : VACIO;
  emitir();
  if (typeof window !== "undefined" && !listenerOnlineIniciado) {
    listenerOnlineIniciado = true;
    window.addEventListener("online", () => void empujarNube());
  }
  if (userId) await cargarNube(userId, revision);
}

export function leerPreferenciasPerfil(): PreferenciasPerfil {
  return structuredClone(snapshot().profile);
}

export function guardarPreferenciasPerfil(campos: Partial<Perfil>) {
  const p = snapshot();
  const profile = { ...p.profile } as Record<string, unknown>;
  let modificado = false;
  for (const clave of CLAVES_PERFIL) {
    if (!Object.prototype.hasOwnProperty.call(campos, clave)) continue;
    modificado = true;
    const valor = campos[clave];
    if (valor === undefined || valor === null) delete profile[clave];
    else profile[clave] = valor;
  }
  if (!modificado) return true;
  return escribir({ ...p, profile: profile as PreferenciasPerfil });
}

/* ---------------------------------------------------------------- acciones */

export function toggleFavorito(clave: string) {
  const p = snapshot();
  const fav = p.fav.includes(clave) ? p.fav.filter((k) => k !== clave) : [...p.fav, clave];
  escribir({ ...p, fav });
}

export function toggleOculta(clave: string) {
  const p = snapshot();
  const hidden = p.hidden.includes(clave) ? p.hidden.filter((k) => k !== clave) : [...p.hidden, clave];
  escribir({ ...p, hidden });
}

export function setOverride(clave: string, data: OverrideComida) {
  const p = snapshot();
  escribir({ ...p, overrides: { ...p.overrides, [clave]: data } });
}

export function quitarOverride(clave: string) {
  const p = snapshot();
  if (!p.overrides[clave]) return;
  const overrides = { ...p.overrides };
  delete overrides[clave];
  escribir({ ...p, overrides });
}

/** Añade una comida al catálogo (biblioteca) sin registrarla en ningún día. */
export function agregarCatalogo(c: Omit<ComidaCatalogo, "clave" | "creado">) {
  const norm = c.texto.trim().toLowerCase().replace(/\s+/g, " ");
  const clave = `${c.tipo}:${norm}`;
  const p = snapshot();
  const catalog = p.catalog.filter((x) => x.clave !== clave);
  catalog.push({ ...c, texto: c.texto.trim(), clave, creado: new Date().toISOString() });
  if (!escribir({ ...p, catalog })) return null;
  return clave;
}

export function quitarCatalogo(clave: string) {
  const p = snapshot();
  if (!p.catalog.some((x) => x.clave === clave)) return;
  escribir({ ...p, catalog: p.catalog.filter((x) => x.clave !== clave) });
}

export function agregarPlantilla(base: Omit<PlantillaComida, "id" | "creado">) {
  const p = snapshot();
  const plantilla: PlantillaComida = { ...base, id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`, creado: new Date().toISOString() };
  if (!escribir({ ...p, templates: [plantilla, ...p.templates.filter((x) => x.nombre !== plantilla.nombre)] })) return null;
  return plantilla;
}

export function quitarPlantilla(id: string) {
  const p = snapshot();
  escribir({ ...p, templates: p.templates.filter((x) => x.id !== id) });
}

export function exportarPreferencias(): MealPrefs { return structuredClone(snapshot()); }
export function importarPreferencias(prefs: MealPrefs) {
  const p = snapshot();
  const unir = <T,>(a: T[], b: T[], clave: (v: T) => string) => [...new Map([...a, ...b].map(v => [clave(v), v])).values()];
  return escribir({ ...p, fav: [...new Set([...p.fav, ...prefs.fav])], hidden: [...new Set([...p.hidden, ...prefs.hidden])],
    catalog: unir(p.catalog, prefs.catalog, c => c.clave), templates: unir(p.templates, prefs.templates, t => t.id),
    plan: unir(p.plan, prefs.plan ?? [], t => t.id), overrides: { ...p.overrides, ...prefs.overrides },
    nutritionCorrections: { ...p.nutritionCorrections, ...prefs.nutritionCorrections }, profile: { ...p.profile, ...prefs.profile } });
}

export function guardarCorreccionesNutricion(items: ItemNutricional[]) {
  if (items.length === 0) return;
  const p = snapshot();
  const nutritionCorrections = { ...p.nutritionCorrections };
  for (const item of items) {
    const clave = normalizarNombreIngrediente(item.nombre);
    if (!clave) continue;
    nutritionCorrections[clave] = { ...item, clave, actualizada: Date.now() };
  }
  const limitadas = Object.fromEntries(
    Object.entries(nutritionCorrections)
      .sort(([, a], [, b]) => b.actualizada - a.actualizada)
      .slice(0, 80),
  );
  escribir({ ...p, nutritionCorrections: limitadas });
}

export function limpiarPreferenciasComidas() {
  cache = VACIO;
  if (usuarioActivo) {
    try { localStorage.removeItem(claveLocal(usuarioActivo)); } catch {}
  }
  try { localStorage.removeItem(KEY_PREFIX); } catch {}
  emitir();
}

/** Hook reactivo; DataProvider establece siempre el usuario propietario. */
export function useMealPrefs(): MealPrefs {
  return React.useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    snapshot,
    () => VACIO,
  );
}
