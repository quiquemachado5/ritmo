"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";

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
  clave: string; // "tipo:texto normalizado"
  texto: string;
  tipo: string;
  kcal: number;
  proteinas: number;
  carbohidratos: number;
  grasas: number;
  creado: string;
}

export interface MealPrefs {
  fav: string[];
  hidden: string[];
  overrides: Record<string, OverrideComida>;
  catalog: ComidaCatalogo[];
  updatedAt: number;
}

const KEY = "ritmo:mealprefs";
const VACIO: MealPrefs = { fav: [], hidden: [], overrides: {}, catalog: [], updatedAt: 0 };

function normalizar(p: Partial<MealPrefs> | null | undefined): MealPrefs {
  return {
    fav: p?.fav ?? [],
    hidden: p?.hidden ?? [],
    overrides: p?.overrides ?? {},
    catalog: p?.catalog ?? [],
    updatedAt: p?.updatedAt ?? 0,
  };
}

function leerLocal(): MealPrefs {
  if (typeof localStorage === "undefined") return VACIO;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? normalizar(JSON.parse(raw)) : VACIO;
  } catch {
    return VACIO;
  }
}

const listeners = new Set<() => void>();
let cache: MealPrefs | null = null;

function snapshot(): MealPrefs {
  if (cache === null) cache = leerLocal();
  return cache;
}

function emitir() {
  listeners.forEach((l) => l());
}

/* ------------------------------------------------------------- sync nube */

let syncIniciado = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;

async function conUsuario<T>(fn: (sb: ReturnType<typeof createClient>, userId: string) => Promise<T>): Promise<T | null> {
  try {
    const sb = createClient();
    const { data } = await sb.auth.getUser();
    if (!data.user) return null;
    return await fn(sb, data.user.id);
  } catch {
    return null;
  }
}

/** Carga inicial desde la nube; si es más nueva, sustituye la local. */
async function cargarNube() {
  await conUsuario(async (sb, userId) => {
    const { data, error } = await sb.from("user_prefs").select("meal_prefs").eq("user_id", userId).maybeSingle();
    if (error || !data?.meal_prefs) return;
    const remota = normalizar(data.meal_prefs as Partial<MealPrefs>);
    const local = snapshot();
    if (remota.updatedAt > local.updatedAt) {
      cache = remota;
      try { localStorage.setItem(KEY, JSON.stringify(remota)); } catch {}
      emitir();
    } else if (local.updatedAt > remota.updatedAt) {
      void empujarNube(); // la local es más nueva: súbela
    }
  });
}

function programarPush() {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => void empujarNube(), 1200);
}

async function empujarNube() {
  const p = snapshot();
  await conUsuario(async (sb, userId) => {
    await sb.from("user_prefs").upsert(
      { user_id: userId, meal_prefs: p, actualizado_en: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  });
}

function escribir(next: Omit<MealPrefs, "updatedAt">) {
  cache = { ...next, updatedAt: Date.now() };
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* cuota / modo privado */
  }
  emitir();
  programarPush();
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
  escribir({ ...p, catalog });
  return clave;
}

export function quitarCatalogo(clave: string) {
  const p = snapshot();
  if (!p.catalog.some((x) => x.clave === clave)) return;
  escribir({ ...p, catalog: p.catalog.filter((x) => x.clave !== clave) });
}

/** Hook reactivo. Dispara la carga inicial desde la nube una sola vez. */
export function useMealPrefs(): MealPrefs {
  React.useEffect(() => {
    if (syncIniciado) return;
    syncIniciado = true;
    void cargarNube();
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => void empujarNube());
    }
  }, []);

  return React.useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    snapshot,
    () => VACIO,
  );
}
