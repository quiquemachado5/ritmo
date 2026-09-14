/** Validadores puros para archivos externos: nunca confían en una aserción TS. */
import { metadataIngredienteValida } from "../nutrition/catalog";
export function objeto(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}
const numero = (v: unknown, max = 12000) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max;
const texto = (v: unknown, max = 2500) => typeof v === "string" && v.length <= max;
const lista = (v: unknown, validar: (item: unknown) => boolean) => Array.isArray(v) && v.length <= 20000 && v.every(validar);
export function fechaValida(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T12:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
}
export function jsonSeguro(v: unknown, profundidad = 0): boolean {
  if (profundidad > 12) return false;
  if (v == null || typeof v === "boolean") return true;
  if (typeof v === "string") return v.length <= 10000;
  if (typeof v === "number") return Number.isFinite(v);
  if (Array.isArray(v)) return v.length <= 20000 && v.every(x => jsonSeguro(x, profundidad + 1));
  return objeto(v) && Object.entries(v).every(([k, x]) => !["__proto__", "constructor", "prototype"].includes(k) && jsonSeguro(x, profundidad + 1));
}
function nutrientes(v: unknown) {
  return objeto(v) && [v.kcal, v.proteinas, v.carbohidratos, v.grasas].every(n => numero(n));
}
export function ingredienteValido(v: unknown): boolean {
  return objeto(v) && nutrientes(v) && texto(v.nombre, 500) && (v.cantidad === undefined || texto(v.cantidad, 500))
    && (v.cantidadEstimada === undefined || typeof v.cantidadEstimada === "boolean") && metadataIngredienteValida(v);
}
export function comidaValida(v: unknown, requiereId = true): boolean {
  return objeto(v) && nutrientes(v) && (!requiereId || texto(v.id, 200)) && texto(v.texto)
    && ["desayuno", "comida", "cena", "snack"].includes(String(v.tipo))
    && (v.ingredientes === undefined || lista(v.ingredientes, ingredienteValido))
    && (v.racionesReceta === undefined || (numero(v.racionesReceta, 24) && Number(v.racionesReceta) >= 1))
    && (v.porcionConsumida === undefined || (numero(v.porcionConsumida, 24) && Number(v.porcionConsumida) > 0 && Number(v.porcionConsumida) <= Number(v.racionesReceta ?? 24)));
}
export function preferenciasPerfilValidas(v: unknown): boolean {
  return objeto(v)
    && (v.imputarActiva === undefined || typeof v.imputarActiva === "boolean")
    && (v.imputarDesde === undefined || fechaValida(v.imputarDesde))
    && (v.imputarSuperavitKcal === undefined || numero(v.imputarSuperavitKcal, 6000))
    && (v.habitosDesactivados === undefined || lista(v.habitosDesactivados, x => texto(x, 100)))
    && (v.habitosPersonalizados === undefined || lista(v.habitosPersonalizados, x => objeto(x) && [x.clave, x.etiqueta, x.codigo, x.icono].every(s => texto(s, 100))));
}
export function preferenciasValidas(v: unknown): boolean {
  if (!objeto(v) || !jsonSeguro(v)) return false;
  const catalogo = (x: unknown) => objeto(x) && comidaValida(x, false) && texto(x.clave) && texto(x.creado, 100);
  const parcial = (x: unknown) => objeto(x) && (x.texto === undefined || texto(x.texto)) && [x.kcal, x.proteinas, x.carbohidratos, x.grasas].every(n => n === undefined || numero(n));
  return lista(v.fav, x => texto(x)) && lista(v.hidden, x => texto(x))
    && lista(v.catalog, catalogo) && lista(v.templates, x => objeto(x) && catalogo(x) && texto(x.id, 200) && texto(x.nombre, 500))
    && (v.plan === undefined || lista(v.plan, x => objeto(x) && texto(x.id, 200) && fechaValida(x.fecha) && comidaValida(x.comida) && (x.registrada === undefined || typeof x.registrada === "boolean")))
    && (v.overrides === undefined || (objeto(v.overrides) && Object.values(v.overrides).every(parcial)))
    && (v.nutritionCorrections === undefined || (objeto(v.nutritionCorrections) && Object.values(v.nutritionCorrections).every(x => objeto(x) && ingredienteValido(x) && texto(x.clave) && numero(x.actualizada, Number.MAX_SAFE_INTEGER))))
    && (v.nutritionMemories === undefined || (objeto(v.nutritionMemories) && Object.values(v.nutritionMemories).every(x => objeto(x) && texto(x.clave) && texto(x.texto) && nutrientes(x) && lista(x.items, ingredienteValido) && numero(x.actualizada, Number.MAX_SAFE_INTEGER))))
    && (v.profile === undefined || preferenciasPerfilValidas(v.profile));
}
