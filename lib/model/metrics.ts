/* ============================================================================
   METRICS — toda la matemática de RITMO.

   Portado íntegro del modelo de la app anterior (era su mayor activo). Funciones
   PURAS: sin DOM, sin estado global, sin efectos. Reciben datos y devuelven
   datos, por eso se pueden testear en aislamiento.

   Convención de signos, consistente en todo el proyecto:
     balance > 0  → superávit  → el peso tiende a subir
     balance < 0  → déficit    → el peso tiende a bajar
   ========================================================================= */

import { TOTAL_HABITOS } from "./config";
import { balanceCalibradoPorHabitos } from "./calibration";
import type { EnergiaDia, Habitos, PesoIntervalo, Sexo } from "./types";

/** Equivalente energético de 1 kg de tejido adiposo (regla de Wishnofsky). */
export const KCAL_POR_KG = 7700;

/** Devuelve `n` si es un número real utilizable, y `null` en cualquier otro caso. */
export function num(n: unknown): number | null {
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function redondear(n: number, decimales: number): number {
  const f = 10 ** decimales;
  return Math.round((n + Number.EPSILON) * f) / f;
}

/* ---------------------------------------------------------------- BALANCE */

/** Balance Calórico Neto = Calorías consumidas − Calorías quemadas. */
export function balanceNeto(kcalConsumidas: unknown, kcalQuemadas: unknown): number | null {
  const inn = num(kcalConsumidas);
  const out = num(kcalQuemadas);
  if (inn === null || out === null) return null;
  return inn - out;
}

/** Déficit calórico: el balance con el signo invertido (positivo = estás en déficit). */
export function deficitCalorico(kcalConsumidas: unknown, kcalQuemadas: unknown): number | null {
  const b = balanceNeto(kcalConsumidas, kcalQuemadas);
  return b === null ? null : -b;
}

/** Kilos de tejido que representa una cantidad de energía. */
export function kcalAKg(kcal: unknown): number | null {
  const k = num(kcal);
  return k === null ? null : k / KCAL_POR_KG;
}

/* -------------------------------------------------------------- PREDICCIÓN */

/** Predicción de Peso = Peso Actual + (Balance Neto / 7700). */
export function prediccionPeso(pesoActual: unknown, balance: unknown): number | null {
  const p = num(pesoActual);
  const b = num(balance);
  if (p === null || b === null) return null;
  return p + b / KCAL_POR_KG;
}

/** Proyección a N días manteniendo un balance diario constante. */
export function proyeccionPeso(pesoActual: unknown, balanceDiario: unknown, dias: unknown): number | null {
  const b = num(balanceDiario);
  const d = num(dias);
  if (b === null || d === null) return null;
  return prediccionPeso(pesoActual, b * d);
}

/** Días necesarios para alcanzar un peso objetivo con un balance diario dado. */
export function diasHastaObjetivo(
  pesoActual: unknown,
  pesoObjetivo: unknown,
  balanceDiario: unknown,
): number | null {
  const p = num(pesoActual);
  const o = num(pesoObjetivo);
  const b = num(balanceDiario);
  if (p === null || o === null || b === null || b === 0) return null;
  const kgFaltantes = o - p;
  const kgPorDia = b / KCAL_POR_KG;
  const dias = kgFaltantes / kgPorDia;
  return dias > 0 && Number.isFinite(dias) ? dias : null;
}

/* ------------------------------------------------- COMPOSICIÓN CORPORAL */

export function masaGrasaKg(peso: unknown, grasaPct: unknown): number | null {
  const p = num(peso);
  const g = num(grasaPct);
  if (p === null || g === null) return null;
  return redondear(p * (g / 100), 2);
}

export function masaMagraKg(peso: unknown, grasaPct: unknown): number | null {
  const p = num(peso);
  const mg = masaGrasaKg(peso, grasaPct);
  if (p === null || mg === null) return null;
  return redondear(p - mg, 2);
}

export interface DesgloseComposicion {
  pesoKg: number;
  grasaPct: number;
  magraPct: number;
  grasaKg: number;
  magraKg: number;
}

export function composicion(peso: unknown, grasaPct: unknown): DesgloseComposicion | null {
  const grasaKg = masaGrasaKg(peso, grasaPct);
  const magraKg = masaMagraKg(peso, grasaPct);
  const p = num(peso);
  const g = num(grasaPct);
  if (grasaKg === null || magraKg === null || p === null || g === null) return null;
  return {
    pesoKg: redondear(p, 2),
    grasaPct: redondear(g, 1),
    magraPct: redondear(100 - g, 1),
    grasaKg,
    magraKg,
  };
}

/** Índice de Masa Corporal. La altura se pasa en centímetros. */
export function imc(peso: unknown, alturaCm: unknown): number | null {
  const p = num(peso);
  const h = num(alturaCm);
  if (p === null || h === null || h <= 0) return null;
  const m = h / 100;
  return redondear(p / (m * m), 1);
}

/** FFMI — índice de masa libre de grasa (no penaliza el músculo como el IMC). */
export function ffmi(peso: unknown, grasaPct: unknown, alturaCm: unknown): number | null {
  const magra = masaMagraKg(peso, grasaPct);
  const h = num(alturaCm);
  if (magra === null || h === null || h <= 0) return null;
  const m = h / 100;
  return redondear(magra / (m * m), 1);
}

export type TonoCategoria = "good" | "warn" | "bad";
export interface CategoriaIMC {
  clave: string;
  etiqueta: string;
  tono: TonoCategoria;
}

export function categoriaIMC(valor: unknown): CategoriaIMC | null {
  const v = num(valor);
  if (v === null) return null;
  if (v < 18.5) return { clave: "bajo", etiqueta: "Bajo peso", tono: "warn" };
  if (v < 25) return { clave: "normal", etiqueta: "Normopeso", tono: "good" };
  if (v < 30) return { clave: "sobrepeso", etiqueta: "Sobrepeso", tono: "warn" };
  if (v < 35) return { clave: "obesidad1", etiqueta: "Obesidad I", tono: "bad" };
  if (v < 40) return { clave: "obesidad2", etiqueta: "Obesidad II", tono: "bad" };
  return { clave: "obesidad3", etiqueta: "Obesidad III", tono: "bad" };
}

/** Rango saludable de grasa corporal (ACE) según sexo. */
export function rangoGrasa(sexo: Sexo): { min: number; max: number; atleta: number } {
  return sexo === "mujer"
    ? { min: 21, max: 32, atleta: 20 }
    : { min: 8, max: 19, atleta: 13 };
}

/* ------------------------------------------------------------------ SERIES */

/** Media móvil simple. Rellena las posiciones sin ventana completa con la media disponible. */
export function mediaMovil(valores: Array<number | null | undefined>, ventana = 7): Array<number | null> {
  if (!Array.isArray(valores) || valores.length === 0) return [];
  const salida: Array<number | null> = [];
  for (let i = 0; i < valores.length; i++) {
    const desde = Math.max(0, i - ventana + 1);
    const trozo = valores.slice(desde, i + 1).filter((v): v is number => num(v) !== null);
    salida.push(trozo.length ? trozo.reduce((a, b) => a + b, 0) / trozo.length : null);
  }
  return salida;
}

export interface Regresion {
  pendiente: number;
  intercepto: number;
  r2: number;
  n: number;
}

/** Regresión lineal por mínimos cuadrados sobre puntos {x, y}. */
export function regresionLineal(puntos: Array<{ x: number; y: number }>): Regresion | null {
  const p = (puntos || []).filter((d) => num(d.x) !== null && num(d.y) !== null);
  const n = p.length;
  if (n < 2) return null;

  const sumX = p.reduce((a, d) => a + d.x, 0);
  const sumY = p.reduce((a, d) => a + d.y, 0);
  const mediaX = sumX / n;
  const mediaY = sumY / n;

  let sxy = 0;
  let sxx = 0;
  for (const d of p) {
    sxy += (d.x - mediaX) * (d.y - mediaY);
    sxx += (d.x - mediaX) ** 2;
  }
  if (sxx === 0) return null;

  const pendiente = sxy / sxx;
  const intercepto = mediaY - pendiente * mediaX;

  let ssRes = 0;
  let ssTot = 0;
  for (const d of p) {
    ssRes += (d.y - (pendiente * d.x + intercepto)) ** 2;
    ssTot += (d.y - mediaY) ** 2;
  }
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

  return { pendiente, intercepto, r2, n };
}

/** Tendencia de peso en kg/semana. Negativa = estás perdiendo peso. */
export function tendenciaSemanal(pesajes: Array<{ dia: number; peso: number }>): { kgSemana: number; r2: number; n: number } | null {
  const r = regresionLineal((pesajes || []).map((p) => ({ x: p.dia, y: p.peso })));
  if (!r) return null;
  return { kgSemana: redondear(r.pendiente * 7, 3), r2: redondear(r.r2, 3), n: r.n };
}

/** Mediana de una serie numérica. */
function mediana(valores: Array<number | null | undefined>): number | null {
  const ordenados = (valores || []).filter((v): v is number => num(v) !== null).sort((a, b) => a - b);
  if (ordenados.length === 0) return null;
  const centro = Math.floor(ordenados.length / 2);
  return ordenados.length % 2
    ? ordenados[centro]
    : (ordenados[centro - 1] + ordenados[centro]) / 2;
}

export type CalidadModelo = "alta" | "media" | "inicial";

export interface TendenciaRobusta {
  pendiente: number;
  kgSemana: number;
  intercepto: number;
  dispersion: number;
  errorPendiente: number;
  puntos: number;
  spanDias: number;
  ultimoDia: number;
  calidad: CalidadModelo;
}

/**
 * Tendencia robusta de peso mediante la pendiente mediana de Theil–Sen.
 *
 * La báscula recoge agua, sal, digestión y hora de pesaje además de tejido.
 * Por eso la proyección no sigue el último número ni una suma de calorías:
 * busca la dirección común de varios pesajes reales y trata los valores aislados
 * como ruido. Si no hay al menos tres pesajes repartidos en dos semanas,
 * devuelve null en lugar de aparentar certeza.
 */
export function tendenciaRobustaPeso(
  pesajes: Array<{ dia: number; peso: number }>,
  { ventanaDias = 56, minDias = 14 }: { ventanaDias?: number; minDias?: number } = {},
): TendenciaRobusta | null {
  const todos = (pesajes || [])
    .filter((p) => num(p.dia) !== null && num(p.peso) !== null)
    .sort((a, b) => a.dia - b.dia);
  if (todos.length < 3) return null;

  const ultimo = todos[todos.length - 1];
  const recientes = todos.filter((p) => p.dia >= ultimo.dia - ventanaDias);
  const puntos = recientes.length >= 3 ? recientes : todos;
  const spanDias = puntos[puntos.length - 1].dia - puntos[0].dia;
  if (spanDias < minDias) return null;

  const pendientes: number[] = [];
  for (let i = 0; i < puntos.length - 1; i++) {
    for (let j = i + 1; j < puntos.length; j++) {
      const dias = puntos[j].dia - puntos[i].dia;
      if (dias > 0) pendientes.push((puntos[j].peso - puntos[i].peso) / dias);
    }
  }
  const pendiente = mediana(pendientes);
  if (pendiente === null) return null;

  const intercepto = mediana(puntos.map((p) => p.peso - pendiente * p.dia)) as number;
  const residuos = puntos.map((p) => p.peso - (intercepto + pendiente * p.dia));
  const mad = mediana(residuos.map((r) => Math.abs(r))) ?? 0;
  const dispersion = 1.4826 * mad;
  const mediaDia = puntos.reduce((suma, p) => suma + p.dia, 0) / puntos.length;
  const sxx = puntos.reduce((suma, p) => suma + (p.dia - mediaDia) ** 2, 0);
  const errorPendiente = sxx > 0 ? dispersion / Math.sqrt(sxx) : 0;

  const calidad: CalidadModelo =
    puntos.length >= 8 && spanDias >= 42 && dispersion <= 0.65
      ? "alta"
      : puntos.length >= 5 && spanDias >= 28 && dispersion <= 0.9
        ? "media"
        : "inicial";

  return {
    pendiente,
    kgSemana: redondear(pendiente * 7, 3),
    intercepto,
    dispersion,
    errorPendiente,
    puntos: puntos.length,
    spanDias,
    ultimoDia: ultimo.dia,
    calidad,
  };
}

export interface PrediccionTendencia extends PesoIntervalo {
  diasDesdeUltimo: number;
  modelo: TendenciaRobusta;
}

/** Predicción de tendencia con un intervalo orientativo del 80 %. */
export function prediccionTendenciaPeso(
  pesajes: Array<{ dia: number; peso: number }>,
  diaDestino: unknown,
  opciones: { ventanaDias?: number; minDias?: number } = {},
): PrediccionTendencia | null {
  const destino = num(diaDestino);
  if (destino === null) return null;
  const modelo = tendenciaRobustaPeso(pesajes, opciones);
  if (!modelo) return null;

  const distancia = Math.max(0, destino - modelo.ultimoDia);
  const peso = modelo.intercepto + modelo.pendiente * destino;
  const incertidumbre = Math.sqrt(
    modelo.dispersion ** 2 + (modelo.errorPendiente * distancia) ** 2,
  );
  const margen = Math.max(0.25, 1.282 * incertidumbre);

  return {
    peso: redondear(peso, 2),
    minimo: redondear(peso - margen, 2),
    maximo: redondear(peso + margen, 2),
    margen: redondear(margen, 2),
    diasDesdeUltimo: distancia,
    modelo,
  };
}

/**
 * TDEE observado: el gasto que explica el cambio de peso real dado lo comido.
 *   ΔPeso · 7700 = ΣConsumidas − ΣGastadas  ⇒  TDEE = mediaConsumidas − (ΔPeso · 7700) / nDías
 */
export function tdeeObservado(d: {
  pesoInicial: number;
  pesoFinal: number;
  dias: number;
  kcalMediaConsumida: number;
}): number | null {
  const pi = num(d && d.pesoInicial);
  const pf = num(d && d.pesoFinal);
  const dias = num(d && d.dias);
  const media = num(d && d.kcalMediaConsumida);
  if (pi === null || pf === null || media === null || dias === null || dias <= 0) return null;
  const deltaKcal = (pf - pi) * KCAL_POR_KG;
  return redondear(media - deltaKcal / dias, 0);
}

/** TDEE teórico: Mifflin-St Jeor (basal) × factor de actividad. */
export function tdeeTeorico({
  peso,
  alturaCm,
  edad,
  sexo,
  factorActividad = 1.375,
}: {
  peso: unknown;
  alturaCm: unknown;
  edad: unknown;
  sexo?: Sexo;
  factorActividad?: number;
}): number | null {
  const p = num(peso);
  const h = num(alturaCm);
  const e = num(edad);
  if (p === null || h === null || e === null) return null;
  const base = 10 * p + 6.25 * h - 5 * e + (sexo === "mujer" ? -161 : 5);
  return redondear(base * factorActividad, 0);
}

/** Metabolismo basal (Mifflin-St Jeor), sin factor de actividad. */
export function metabolismoBasal(args: { peso: unknown; alturaCm: unknown; edad: unknown; sexo?: Sexo }): number | null {
  return tdeeTeorico({ ...args, factorActividad: 1 });
}

export interface FactorActividad {
  clave: string;
  etiqueta: string;
  factor: number;
  detalle: string;
}

export const FACTORES_ACTIVIDAD: FactorActividad[] = [
  { clave: "sedentario", etiqueta: "Sedentario", factor: 1.2, detalle: "Trabajo de oficina, sin ejercicio" },
  { clave: "ligero", etiqueta: "Ligero", factor: 1.375, detalle: "Ejercicio 1–3 días por semana" },
  { clave: "moderado", etiqueta: "Moderado", factor: 1.55, detalle: "Ejercicio 3–5 días por semana" },
  { clave: "alto", etiqueta: "Alto", factor: 1.725, detalle: "Ejercicio 6–7 días por semana" },
  { clave: "muyAlto", etiqueta: "Muy alto", factor: 1.9, detalle: "Trabajo físico o doble sesión" },
];

/* -------------------------------------------------------------- ADHERENCIA */

/** Porcentaje de hábitos cumplidos en un día. */
export function adherenciaDia(habitos: Habitos | undefined, totalHabitos: number): number {
  const total = num(totalHabitos);
  if (!total || total <= 0) return 0;
  const hechos = Object.values(habitos || {}).filter((v) => v === true).length;
  return redondear((hechos / total) * 100, 1);
}

/** Nivel de intensidad 0–4 para el mapa de calor del calendario. */
export function nivelDia(habitos: Habitos | undefined, totalHabitos: number): number {
  const hechos = Object.values(habitos || {}).filter((v) => v === true).length;
  if (hechos === 0) return 0;
  const ratio = hechos / (totalHabitos || 1);
  if (ratio >= 1) return 4;
  if (ratio >= 0.75) return 3;
  if (ratio >= 0.5) return 2;
  return 1;
}

/** Racha actual: días consecutivos hacia atrás que alcanzan el umbral. */
export interface Racha {
  longitud: number;
  desde: string | null;
  hasta: string | null;
}

const RACHA_VACIA: Racha = { longitud: 0, desde: null, hasta: null };

/** Días de diferencia entre dos fechas ISO (b − a). */
function distanciaDias(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/**
 * Tramos de días CONSECUTIVOS en el calendario que alcanzan el umbral.
 *
 * Recorrer el array de días registrados no basta: un hueco sin registrar rompe
 * la racha aunque los días de alrededor sí cuenten, y antes se saltaba porque
 * simplemente no estaba en la lista.
 */
function tramos(dias: Array<{ fecha: string; cumplidos: number }>, umbral: number): Racha[] {
  const validos = (Array.isArray(dias) ? dias : [])
    .filter((d) => d.cumplidos >= umbral)
    .sort((a, b) => (a.fecha < b.fecha ? -1 : 1));

  const salida: Racha[] = [];
  for (const d of validos) {
    const ultimo = salida[salida.length - 1];
    if (ultimo && distanciaDias(ultimo.hasta as string, d.fecha) === 1) {
      ultimo.hasta = d.fecha;
      ultimo.longitud++;
    } else {
      salida.push({ longitud: 1, desde: d.fecha, hasta: d.fecha });
    }
  }
  return salida;
}

/**
 * Racha en curso: días consecutivos que llegan hasta hoy (o hasta ayer, para no
 * darla por rota mientras el día todavía se está registrando).
 */
export function rachaActual(
  dias: Array<{ fecha: string; cumplidos: number }>,
  umbral = TOTAL_HABITOS,
  hoyISO?: string,
): Racha {
  const hoy = hoyISO ?? new Date().toISOString().slice(0, 10);
  const ultimo = tramos(dias, umbral).pop();
  if (!ultimo) return RACHA_VACIA;
  return distanciaDias(ultimo.hasta as string, hoy) <= 1 ? ultimo : RACHA_VACIA;
}

/**
 * Racha más larga registrada en todo el historial, con sus fechas.
 * En caso de empate gana la más reciente: es la que resulta útil enseñar.
 */
export function mejorRacha(
  dias: Array<{ fecha: string; cumplidos: number }>,
  umbral = TOTAL_HABITOS,
): Racha {
  return tramos(dias, umbral).reduce((mejor, t) => (t.longitud >= mejor.longitud ? t : mejor), RACHA_VACIA);
}

/* ------------------------------------------------------- ESTIMACIÓN KCAL */

/**
 * Estimación de calorías consumidas a partir de los hábitos marcados.
 * Solo respaldo para días históricos sin registro numérico de calorías.
 */
export function estimarKcalConsumidas(
  habitos: Habitos | undefined,
  kcalObjetivo = 1350,
  habitosActivos?: string[],
): { kcal: number; plan: string; estimado: true } {
  const h = habitos || {};
  const objetivo = num(kcalObjetivo) === null ? 1350 : kcalObjetivo;
  const diaControlado = Math.min(objetivo, 1450);
  const usaPerfil = Boolean(habitosActivos?.length);
  const claves = usaPerfil ? habitosActivos! : Object.keys(h);
  const total = usaPerfil ? claves.length : TOTAL_HABITOS;
  const cumplidos = claves.filter((clave) => h[clave] === true).length;
  // Los hábitos describen el nivel de control del día. En pérdida de peso, un
  // día perfecto no equivale a "solo lo registrado": RITMO usa una ingesta
  // controlada de referencia y desplaza hacia superávit cuando faltan hábitos.
  const ajustePorHabitoFaltante = usaPerfil
    ? Math.round(850 * (1 - Math.min(1, cumplidos / total)) ** 1.15)
    : ([0, 850, 650, 450, 300, 150, 0][Math.min(6, cumplidos)] ?? 0);
  const kcal = diaControlado + ajustePorHabitoFaltante;
  const plan = `${cumplidos}/${total} hábitos`;
  return { kcal, plan, estimado: true };
}

/** Estimación de gasto: TDEE de referencia con ajuste por entrenamiento. */
export function estimarKcalQuemadas(
  habitos: Habitos | undefined,
  tdeeBase = 2450,
): { kcal: number; estimado: true } {
  const base = num(tdeeBase) === null ? 2450 : tdeeBase;
  const deporte = (habitos || {}).deporte === true;
  return { kcal: redondear(base + (deporte ? 320 : 0), 0), estimado: true };
}

/* ---------------------------------------------------------------- RESUMEN */

export interface OpcionesEnergia {
  kcalObjetivo?: number;
  tdeeBase?: number;
  imputacion?: { activa: boolean; desde: string; superavitKcal: number } | null;
  habitosActivos?: string[];
}

/** Energía resuelta de un día: valores explícitos si existen; si no, estimación. */
export function energiaDia(
  dia: { fecha?: string; habitos?: Habitos; peso?: number; kcalConsumidas?: number; kcalQuemadas?: number; comidas?: Array<{ tipo?: string }> },
  opciones: OpcionesEnergia = {},
): EnergiaDia {
  const { kcalObjetivo = 1350, tdeeBase = 2450, imputacion = null, habitosActivos } = opciones;
  const d = dia || {};

  const inExplicito = num(d.kcalConsumidas);
  const outExplicito = num(d.kcalQuemadas);
  const clavesHabitos = habitosActivos?.length ? habitosActivos : undefined;
  const sinHabitosMarcados = clavesHabitos
    ? !clavesHabitos.some((clave) => d.habitos?.[clave] === true)
    : !Object.values(d.habitos || {}).some((valor) => valor === true);
  // Si faltan registros de comida, la suma guardada es solo un mínimo. No se
  // bloquea el día: los hábitos completan la estimación energética.
  const ingestaIncompleta = Boolean(d.comidas?.length) && !d.comidas!.some((comida) => comida.tipo === "cena");

  const sinRegistro =
    inExplicito === null &&
    outExplicito === null &&
    num(d.peso) === null &&
    !Object.values(d.habitos || {}).some((v) => v === true);

  // Cero hábitos no es neutral: el modelo lo trata como un día de superávit
  // conservador. De esta forma jamás se transforma un día sin adherencia en
  // un déficit por haber registrado solo una parte de la comida.
  if (sinHabitosMarcados && !sinRegistro) {
    const quemadas = outExplicito ?? tdeeBase;
    const superavit = imputacion?.superavitKcal ?? 500;
    const consumidas = Math.max(inExplicito ?? 0, quemadas + superavit);
    return {
      consumidas,
      quemadas,
      balance: consumidas - quemadas,
      deficit: quemadas - consumidas,
      deltaKg: kcalAKg(consumidas - quemadas),
      estimado: true,
      consumidasEstimadas: true,
      quemadasEstimadas: outExplicito === null,
      ingestaIncompleta,
      sinHabitosMarcados: true,
      sinRegistro,
      imputado: sinRegistro,
    };
  }

  if (sinRegistro && imputacion && imputacion.activa && d.fecha && d.fecha >= imputacion.desde) {
    const quemadas = tdeeBase;
    const consumidas = tdeeBase + imputacion.superavitKcal;
    return {
      consumidas,
      quemadas,
      balance: imputacion.superavitKcal,
      deficit: -imputacion.superavitKcal,
      deltaKg: kcalAKg(imputacion.superavitKcal),
      estimado: true,
      consumidasEstimadas: true,
      quemadasEstimadas: true,
      ingestaIncompleta: false,
      sinHabitosMarcados,
      sinRegistro: true,
      imputado: true,
    };
  }

  const estimacionIngesta = estimarKcalConsumidas(d.habitos, kcalObjetivo, clavesHabitos);
  const inn =
    inExplicito !== null && !ingestaIncompleta
      ? { kcal: inExplicito, estimado: false as const }
      : inExplicito !== null
        ? { kcal: Math.max(inExplicito, estimacionIngesta.kcal), estimado: true as const }
        : estimacionIngesta;

  const out =
    outExplicito !== null
      ? { kcal: outExplicito, estimado: false as const }
      : estimarKcalQuemadas(d.habitos, tdeeBase);

  const cumplidosActivos = clavesHabitos
    ? clavesHabitos.filter((clave) => d.habitos?.[clave] === true).length
    : Object.values(d.habitos || {}).filter((v) => v === true).length;
  const totalActivos = clavesHabitos?.length ?? TOTAL_HABITOS;
  const ratioHabitos = totalActivos > 0 ? cumplidosActivos / totalActivos : 0;
  const balanceHistorico = inn.estimado && out.estimado
    ? balanceCalibradoPorHabitos(cumplidosActivos, totalActivos)
    : null;
  const consumoAjustado = balanceHistorico !== null
    ? Math.max(inn.kcal, out.kcal + balanceHistorico)
    : inn.kcal;
  const balance = balanceHistorico !== null
    ? consumoAjustado - out.kcal
    : balanceNeto(consumoAjustado, out.kcal) as number;

  return {
    consumidas: consumoAjustado,
    quemadas: out.kcal,
    balance,
    deficit: -balance,
    deltaKg: kcalAKg(balance),
    estimado: inn.estimado || out.estimado,
    consumidasEstimadas: inn.estimado,
    quemadasEstimadas: out.estimado,
    ingestaIncompleta,
    sinHabitosMarcados,
    sinRegistro,
    imputado: false,
  };
}

/* --------------------------------------------------------- MACROS (RITMO) */

/**
 * Reparto de macros objetivo a partir de kcal, peso y objetivo.
 * Proteína anclada a g/kg (protege masa magra), grasa como % de kcal, resto
 * hidratos. Es un punto de partida editable, no una prescripción.
 */
export function macrosObjetivo({
  kcal,
  pesoKg,
  objetivo = "perder",
  proteinaGkg,
}: {
  kcal: number;
  pesoKg: number | null;
  objetivo?: "perder" | "mantener" | "ganar";
  proteinaGkg?: number;
}): { kcal: number; proteinas: number; carbohidratos: number; grasas: number } {
  const gkg = proteinaGkg ?? (objetivo === "perder" ? 2.0 : objetivo === "ganar" ? 1.8 : 1.6);
  const proteinas = pesoKg ? Math.round(pesoKg * gkg) : Math.round((kcal * 0.3) / 4);
  const grasasKcal = kcal * 0.28;
  const grasas = Math.round(grasasKcal / 9);
  const restanteKcal = Math.max(0, kcal - proteinas * 4 - grasas * 9);
  const carbohidratos = Math.round(restanteKcal / 4);
  return { kcal, proteinas, carbohidratos, grasas };
}
