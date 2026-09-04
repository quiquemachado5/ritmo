"use client";

import type { AnalisisNutricional, CorreccionNutricional } from "./types";
import { EXTERNAL_NUTRITION_ENABLED } from "./policy";

/** Analiza en el dispositivo; solo utiliza el servidor si la política lo permite. */
export async function analizarComida(texto: string, correcciones: CorreccionNutricional[] = []): Promise<AnalisisNutricional> {
  if (!EXTERNAL_NUTRITION_ENABLED) {
    const { analizarLocal } = await import("./local");
    return analizarLocal(texto, correcciones);
  }
  const res = await fetch("/api/nutricion", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texto, correcciones: correcciones.slice(0, 25) }),
    signal: AbortSignal.timeout(55_000),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "No se pudo analizar la comida.");
  }
  return (await res.json()) as AnalisisNutricional;
}
