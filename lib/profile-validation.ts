import type { Perfil } from "./model/types";

/** Límites de formato y almacenamiento; no son recomendaciones nutricionales. */
export const PROFILE_LIMITS = {
  edad: [18, 120], alturaCm: [100, 250], pesoObjetivo: [30, 300],
  kcalObjetivo: [800, 6000], proteinaObjetivo: [0.5, 4], factorActividad: [1, 2.5],
} as const;
export type ErroresPerfil = Partial<Record<keyof Perfil, string>>;
export function erroresPerfil(perfil: Perfil): ErroresPerfil {
  const errores: ErroresPerfil = {};
  const etiquetas = { edad: "Edad", alturaCm: "Altura", pesoObjetivo: "Peso objetivo", kcalObjetivo: "Calorías objetivo", proteinaObjetivo: "Proteína (g/kg)", factorActividad: "Actividad" };
  for (const campo of Object.keys(PROFILE_LIMITS) as Array<keyof typeof PROFILE_LIMITS>) {
    const v = perfil[campo];
    if (v == null && (campo === "pesoObjetivo" || campo === "proteinaObjetivo")) continue;
    const [min, max] = PROFILE_LIMITS[campo];
    if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) errores[campo] = `${etiquetas[campo]}: introduce un valor entre ${min} y ${max}.`;
  }
  for (const campo of ["edad", "alturaCm", "kcalObjetivo"] as const) {
    if (!errores[campo] && !Number.isInteger(perfil[campo])) errores[campo] = `${etiquetas[campo]}: introduce un número entero.`;
  }
  if (!["hombre", "mujer"].includes(perfil.sexo)) errores.sexo = "Selecciona el sexo utilizado para el cálculo.";
  if (perfil.objetivo && !["perder", "mantener", "ganar"].includes(perfil.objetivo)) errores.objetivo = "Selecciona un objetivo válido.";
  if ((perfil.nombre?.length ?? 0) > 80) errores.nombre = "El nombre no puede superar los 80 caracteres.";
  return errores;
}
export function validarPerfil(perfil: Perfil): string | null {
  return Object.values(erroresPerfil(perfil))[0] ?? null;
}
