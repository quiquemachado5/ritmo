"use client";

import * as React from "react";

/* Preferencias de la biblioteca de comidas, sobre la agregación derivada del
   histórico. Viven en localStorage (app personal): marcar favoritas, ocultar
   entradas y editar los valores "canónicos" de una comida sin tocar el
   registro diario. Clave de cada comida = "tipo:texto normalizado". */

export interface OverrideComida {
  texto?: string;
  kcal?: number;
  proteinas?: number;
  carbohidratos?: number;
  grasas?: number;
}

export interface MealPrefs {
  fav: string[];
  hidden: string[];
  overrides: Record<string, OverrideComida>;
}

const KEY = "ritmo:mealprefs";
const VACIO: MealPrefs = { fav: [], hidden: [], overrides: {} };

function leer(): MealPrefs {
  if (typeof localStorage === "undefined") return VACIO;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return VACIO;
    const p = JSON.parse(raw) as Partial<MealPrefs>;
    return { fav: p.fav ?? [], hidden: p.hidden ?? [], overrides: p.overrides ?? {} };
  } catch {
    return VACIO;
  }
}

const listeners = new Set<() => void>();
let cache: MealPrefs | null = null;

function snapshot(): MealPrefs {
  if (cache === null) cache = leer();
  return cache;
}

function escribir(next: MealPrefs) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* cuota / modo privado */
  }
  listeners.forEach((l) => l());
}

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

export function mostrarOculta(clave: string) {
  const p = snapshot();
  if (!p.hidden.includes(clave)) return;
  escribir({ ...p, hidden: p.hidden.filter((k) => k !== clave) });
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

/** Hook reactivo: se re-renderiza al cambiar cualquier preferencia. */
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
