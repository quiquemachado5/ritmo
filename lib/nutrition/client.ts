"use client";

import type { AnalisisNutricional, CorreccionNutricional } from "./types";

/** Envía la descripción al servidor y devuelve el análisis nutricional. */
export async function analizarComida(texto: string, correcciones: CorreccionNutricional[] = []): Promise<AnalisisNutricional> {
  const res = await fetch("/api/nutricion", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texto, correcciones: correcciones.slice(0, 25) }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "No se pudo analizar la comida.");
  }
  return (await res.json()) as AnalisisNutricional;
}
