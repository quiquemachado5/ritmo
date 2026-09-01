"use client";

import * as React from "react";

export interface ModoViaje { activo: boolean; etiqueta: string; desde: string; hasta?: string }
const KEY = "ritmo:modo-viaje";
const VACIO: ModoViaje = { activo: false, etiqueta: "Viaje", desde: "" };
const listeners = new Set<() => void>();
const cache = new Map<string, ModoViaje>();

function clave(userId: string) { return `${KEY}:${userId}`; }
function leer(userId: string | null): ModoViaje {
  if (!userId || typeof window === "undefined") return VACIO;
  if (cache.has(userId)) return cache.get(userId)!;
  try {
    // La antigua clave no identificaba al propietario y no se migra.
    localStorage.removeItem(KEY);
    const valor = { ...VACIO, ...(JSON.parse(localStorage.getItem(clave(userId)) || "{}") as Partial<ModoViaje>) };
    cache.set(userId, valor);
    return valor;
  } catch {
    return VACIO;
  }
}
function emitir() { listeners.forEach((fn) => fn()); }
export function guardarModoViaje(modo: ModoViaje, userId: string | null) {
  if (!userId) return;
  cache.set(userId, modo);
  localStorage.setItem(clave(userId), JSON.stringify(modo));
  emitir();
}
export function useModoViaje(userId: string | null) {
  return React.useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    () => leer(userId),
    () => VACIO,
  );
}
