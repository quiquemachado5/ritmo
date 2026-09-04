import { fechaValida, jsonSeguro, objeto, preferenciasPerfilValidas } from "../store/validation";
import type { AuditoriaModelo } from "./types";

const texto = (v: unknown, max = 100) => typeof v === "string" && v.length > 0 && v.length <= max;
const numero = (v: unknown, min: number, max: number) => typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const timestamp = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v) && v.length <= 40 && Number.isFinite(Date.parse(v));

/** Un documento importado nunca se convierte en una emisión sellada. */
export function validarAuditoriaImportada(v: unknown): v is AuditoriaModelo {
  if (!objeto(v) || !jsonSeguro(v) || !Array.isArray(v.configuraciones) || !Array.isArray(v.predicciones)
    || v.configuraciones.length > 5000 || v.predicciones.length > 20000) return false;
  return v.configuraciones.every((c) => objeto(c) && texto(c.id) && timestamp(c.effectiveFrom)
    && (c.effectiveDate === undefined || fechaValida(c.effectiveDate)) && objeto(c.perfil) && preferenciasPerfilValidas(c.perfil)
    && numero(c.perfil.edad, 18, 120) && numero(c.perfil.alturaCm, 100, 250)
    && numero(c.perfil.kcalObjetivo, 800, 6000) && numero(c.perfil.factorActividad, 1, 2.5)
    && ["hombre", "mujer"].includes(String(c.perfil.sexo)))
    && v.predicciones.every((p) => objeto(p) && texto(p.id) && timestamp(p.emitidaEn)
      && fechaValida(p.fechaEmision) && fechaValida(p.fechaObjetivo) && fechaValida(p.fechaBase)
      && p.fechaObjetivo > p.fechaEmision && p.fechaBase <= p.fechaEmision
      && [1, 3, 7, 30].includes(Number(p.horizonteDias)) && typeof p.horizonteDias === "number"
      && numero(p.peso, 20, 500) && numero(p.minimo, 0, 500) && numero(p.maximo, 20, 600)
      && Number(p.minimo) <= Number(p.peso) && Number(p.peso) <= Number(p.maximo)
      && numero(p.pesoBase, 20, 500) && texto(p.versionModelo, 80) && texto(p.configuracionId)
      && Number.isInteger(p.diasUtilizados) && numero(p.diasUtilizados, 0, 100000)
      && Number.isInteger(p.pesajesUtilizados) && numero(p.pesajesUtilizados, 1, 100000));
}
