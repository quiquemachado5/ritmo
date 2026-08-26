"use client";

import * as React from "react";

export interface ModoViaje { activo: boolean; etiqueta: string; desde: string; hasta?: string }
const KEY = "ritmo:modo-viaje";
const VACIO: ModoViaje = { activo: false, etiqueta: "Viaje", desde: "" };
const listeners = new Set<() => void>();
let cache: ModoViaje | null = null;

function leer(): ModoViaje { try { return typeof window === "undefined" ? VACIO : { ...VACIO, ...(JSON.parse(localStorage.getItem(KEY) || "{}") as Partial<ModoViaje>) }; } catch { return VACIO; } }
function snap() { if (!cache) cache = leer(); return cache; }
function emitir() { listeners.forEach((fn) => fn()); }
export function guardarModoViaje(modo: ModoViaje) { cache = modo; localStorage.setItem(KEY, JSON.stringify(modo)); emitir(); }
export function useModoViaje() { return React.useSyncExternalStore((fn) => { listeners.add(fn); return () => listeners.delete(fn); }, snap, () => VACIO); }
