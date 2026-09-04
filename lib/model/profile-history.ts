import type { Estado, Perfil } from "./types";

const cache = new WeakMap<NonNullable<Estado["perfilHistorial"]>, NonNullable<Estado["perfilHistorial"]>>();

/** JSONB cambia el orden de claves; eso no es un cambio de configuración. */
export function perfilesEquivalentes(a: Perfil, b: Perfil): boolean {
  const ordenar = (v: unknown): unknown => Array.isArray(v) ? v.map(ordenar)
    : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).filter(([, value]) => value !== undefined).sort(([x], [y]) => x.localeCompare(y)).map(([k, value]) => [k, ordenar(value)])) : v;
  return JSON.stringify(ordenar(a)) === JSON.stringify(ordenar(b));
}

/**
 * La última configuración observada ese día. Antes de la primera versión se
 * mantiene el supuesto inicial, no el perfil actual: editar ajustes mañana no
 * vuelve a interpretar el año pasado. No se afirma conocer aquel perfil.
 */
export function configuracionEnFecha(estado: Estado, fecha: string): { perfil: Perfil; documentada: boolean } {
  const versiones = estado.perfilHistorial;
  if (!versiones?.length) return { perfil: estado.perfil, documentada: false };
  let ordenadas = cache.get(versiones);
  if (!ordenadas) {
    ordenadas = [...versiones].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
    cache.set(versiones, ordenadas);
  }
  const vigente = ordenadas.findLast((v) => (v.effectiveDate ?? v.effectiveFrom.slice(0, 10)) <= fecha);
  return { perfil: (vigente ?? ordenadas[0]).perfil, documentada: Boolean(vigente) };
}

export function perfilEnFecha(estado: Estado, fecha: string): Perfil {
  return configuracionEnFecha(estado, fecha).perfil;
}
