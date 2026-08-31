/* ============================================================================
   ANALYTICS — derivaciones sobre el estado completo (portado íntegro).

   Combina los datos crudos con `metrics` para producir todo lo que pintan las
   vistas. Sigue siendo puro: recibe el estado, devuelve un resumen.
   ========================================================================= */

import * as M from "./metrics";
import { diaAbsoluto, diasEntre, hoy, sumarDias } from "./dates";
import { habitosModelo, totalHabitosPerfil } from "./config";
import type {
  Comida,
  Composicion,
  Dia,
  EnergiaDia,
  Estado,
  Pesaje,
  PesoIntervalo,
  ReglaImputacion,
  TipoComida,
} from "./types";

/** Días como array ordenado por fecha ascendente. */
export function diasOrdenados(estado: Estado): Dia[] {
  return Object.values(estado.dias || {}).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
}

/** Solo los días con peso registrado, ordenados. */
export function pesajes(estado: Estado): Pesaje[] {
  // Un pesaje puede vivir en `dias` (registro rápido) o en `composicion`
  // (medición completa). El historial es la unión de ambos: si sólo se mirara
  // uno, las básculas registradas por el otro camino desaparecerían del
  // historial y de la tendencia.
  const porFecha = new Map<string, number>();
  for (const c of estado.composicion || []) {
    if (M.num(c.peso) !== null) porFecha.set(c.fecha, c.peso);
  }
  for (const d of diasOrdenados(estado)) {
    if (M.num(d.peso) !== null) porFecha.set(d.fecha, d.peso as number);
  }
  return [...porFecha.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([fecha, peso]) => ({ fecha, peso, dia: diaAbsoluto(fecha) }));
}

/** Último peso conocido, sea de un día de registro o de una medición. */
export function pesoActual(estado: Estado): Pesaje | null {
  const p = pesajes(estado);
  const ultimoDia = p.length ? p[p.length - 1] : null;

  const comps = (estado.composicion || [])
    .filter((c) => M.num(c.peso) !== null)
    .sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  const ultimaComp = comps.length ? comps[comps.length - 1] : null;

  if (!ultimoDia && !ultimaComp) return null;
  if (!ultimaComp) return ultimoDia;
  if (!ultimoDia)
    return { fecha: ultimaComp.fecha, peso: ultimaComp.peso, dia: diaAbsoluto(ultimaComp.fecha) };
  return ultimaComp.fecha > ultimoDia.fecha
    ? { fecha: ultimaComp.fecha, peso: ultimaComp.peso, dia: diaAbsoluto(ultimaComp.fecha) }
    : ultimoDia;
}

/** Última medición que incluya porcentaje de grasa. */
export function ultimaComposicion(estado: Estado): Composicion | null {
  const comps = (estado.composicion || [])
    .filter((c) => M.num(c.grasaPct) !== null && M.num(c.peso) !== null)
    .sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  return comps.length ? comps[comps.length - 1] : null;
}

/** Configuración de imputación derivada del perfil del usuario. */
export function reglaImputacion(estado: Estado): ReglaImputacion {
  const p = estado.perfil || ({} as Estado["perfil"]);
  return {
    activa: p.imputarActiva !== false,
    desde: p.imputarDesde || "2026-07-01",
    superavitKcal: M.num(p.imputarSuperavitKcal) ?? 500,
  };
}

/** Energía de un día concreto, con los parámetros del perfil aplicados. */
export function energiaDe(estado: Estado, fecha: string): EnergiaDia {
  const dia = (estado.dias || {})[fecha] || { fecha, habitos: {} };
  const perfil = estado.perfil || ({} as Estado["perfil"]);
  return M.energiaDia(
    { ...dia, fecha },
    {
      kcalObjetivo: perfil.kcalObjetivo,
      tdeeBase: tdeeVigente(estado),
      imputacion: reglaImputacion(estado),
      habitosActivos: habitosModelo(perfil).map((h) => h.clave),
    },
  );
}

/** Días de un intervalo que aportan información: los registrados y los imputados. */
export function diasEvaluables(estado: Estado, desde: string, hasta: string): Array<{ fecha: string; energia: EnergiaDia }> {
  const salida: Array<{ fecha: string; energia: EnergiaDia }> = [];
  let cursor = desde;
  let guarda = 0;
  while (cursor <= hasta && guarda++ < 5000) {
    const e = energiaDe(estado, cursor);
    if (!e.sinRegistro || e.imputado) salida.push({ fecha: cursor, energia: e });
    cursor = sumarDias(cursor, 1);
  }
  return salida;
}

export interface Arrastre {
  dias: number;
  diasImputados: number;
  diasRegistrados: number;
  balanceTotal: number;
  deltaKg: number;
  pesoBase: number;
  pesoEstimado: number;
  fechaBase: string;
}

/** ARRASTRE ACUMULADO — energía ya ocurrida que la báscula aún no ha reflejado. */
export function arrastre(estado: Estado): Arrastre | null {
  const ultimo = pesoActual(estado);
  if (!ultimo) return null;

  const desde = sumarDias(ultimo.fecha, 1);
  const hasta = hoy();
  if (desde > hasta) {
    return {
      dias: 0,
      diasImputados: 0,
      diasRegistrados: 0,
      balanceTotal: 0,
      deltaKg: 0,
      pesoBase: ultimo.peso,
      pesoEstimado: ultimo.peso,
      fechaBase: ultimo.fecha,
    };
  }

  const evaluables = diasEvaluables(estado, desde, hasta);
  const balanceTotal = evaluables.reduce((a, d) => a + d.energia.balance, 0);
  const imputados = evaluables.filter((d) => d.energia.imputado);
  const deltaKg = balanceTotal / M.KCAL_POR_KG;

  return {
    dias: diasEntre(ultimo.fecha, hasta),
    diasImputados: imputados.length,
    diasRegistrados: evaluables.length - imputados.length,
    balanceTotal,
    deltaKg: Math.round(deltaKg * 100) / 100,
    pesoBase: ultimo.peso,
    fechaBase: ultimo.fecha,
    pesoEstimado: Math.round((ultimo.peso + deltaKg) * 100) / 100,
  };
}

export interface PuntoPesoDiario {
  fecha: string;
  /** Peso de báscula, sólo los días que lo hay. */
  real: number | null;
  /** Estimación del modelo para ese día, todos los días. */
  estimado: number;
}

/**
 * Serie DIARIA de peso: real donde hay báscula, estimado siempre.
 *
 * El estimado arranca en el primer pesaje y va acumulando el balance energético
 * de cada día. Cuando aparece una báscula nueva, la serie se re-ancla en ella:
 * ese salto es justo lo que el modelo aprende. Al ser diaria, la línea llega
 * hasta hoy en vez de pararse en el último pesaje.
 */
export function seriePesoDiaria(estado: Estado, desde: string, hasta: string): PuntoPesoDiario[] {
  const p = pesajes(estado);
  if (!p.length) return [];

  const porFecha = new Map(p.map((x) => [x.fecha, x.peso]));
  const salida: PuntoPesoDiario[] = [];
  let ancla = p[0].peso;
  let cursor = p[0].fecha;
  let guarda = 0;

  while (cursor <= hasta && guarda++ < 20_000) {
    const real = porFecha.get(cursor) ?? null;

    // El primer día es el propio pesaje inicial: no hay nada que acumular.
    if (salida.length > 0) {
      const e = energiaDe(estado, cursor);
      if (!e.sinRegistro || e.imputado) ancla += e.balance / M.KCAL_POR_KG;
    }

    const estimado = Math.round(ancla * 100) / 100;
    if (cursor >= desde) salida.push({ fecha: cursor, real, estimado });

    // Una báscula real manda sobre la estimación a partir de aquí.
    if (real !== null) ancla = real;
    cursor = sumarDias(cursor, 1);
  }

  return salida;
}

/* Caché del TDEE por versión de estado (evita recomputar en el arrastre). */
const cacheTdee = new WeakMap<Estado, { version: number; valor: number }>();

export function tdeeVigente(estado: Estado): number {
  const guardado = cacheTdee.get(estado);
  if (guardado && guardado.version === estado.version) return guardado.valor;
  const valor = calcularTdeeVigente(estado);
  cacheTdee.set(estado, { version: estado.version ?? 0, valor });
  return valor;
}

function calcularTdeeVigente(estado: Estado): number {
  const observado = tdeeDesdeHistorial(estado);
  if (observado) return observado.kcal;

  const perfil = estado.perfil || ({} as Estado["perfil"]);
  const actual = pesoActual(estado);
  const teorico = M.tdeeTeorico({
    peso: actual ? actual.peso : null,
    alturaCm: perfil.alturaCm,
    edad: perfil.edad,
    sexo: perfil.sexo,
    factorActividad: perfil.factorActividad,
  });
  return teorico ?? 2450;
}

export interface TdeeHistorial {
  kcal: number;
  dias: number;
  desde: string;
  hasta: string;
  muestras: number;
  cobertura: number;
  explicitas: number;
}

/** TDEE calculado a partir de pesos y consumo anotado en una ventana. */
export function tdeeDesdeHistorial(estado: Estado, ventanaDias = 60): TdeeHistorial | null {
  const p = pesajes(estado);
  if (p.length < 2) return null;

  const fin = p[p.length - 1];
  const limite = sumarDias(fin.fecha, -ventanaDias);
  const candidatos = p.filter((x) => x.fecha >= limite);
  if (candidatos.length < 2) return null;

  const inicio = candidatos[0];
  const dias = diasEntre(inicio.fecha, fin.fecha);
  if (dias < 21) return null;

  const enRango = diasOrdenados(estado).filter((d) => d.fecha >= inicio.fecha && d.fecha <= fin.fecha);
  if (enRango.length < 14 || enRango.length / dias < 0.6) return null;
  const explicitas = enRango.filter((d) => M.num(d.kcalConsumidas) !== null).length;
  const perfil = estado.perfil || ({} as Estado["perfil"]);
  const consumos = enRango.map((d) => {
    const explicito = M.num(d.kcalConsumidas);
    return explicito !== null ? explicito : M.estimarKcalConsumidas(d.habitos, perfil.kcalObjetivo, habitosModelo(perfil).map((h) => h.clave)).kcal;
  });
  const media = consumos.reduce((a, b) => a + b, 0) / consumos.length;

  const kcal = M.tdeeObservado({
    pesoInicial: inicio.peso,
    pesoFinal: fin.peso,
    dias,
    kcalMediaConsumida: media,
  });
  if (kcal === null || kcal < 1200 || kcal > 5500) return null;

  return {
    kcal,
    dias,
    desde: inicio.fecha,
    hasta: fin.fecha,
    muestras: enRango.length,
    cobertura: Math.round((enRango.length / (dias + 1)) * 100),
    explicitas,
  };
}

/** Balance medio diario de los últimos N días CON registro. */
export function balanceMedio(estado: Estado, ventanaDias = 14): number | null {
  const evaluables = diasEvaluables(estado, sumarDias(hoy(), -365), hoy()).slice(-ventanaDias);
  if (evaluables.length === 0) return null;
  const suma = evaluables.reduce((a, d) => a + d.energia.balance, 0);
  return suma / evaluables.length;
}

/**
 * Balance reciente que distingue evidencia de suposiciones. Un día con comidas
 * completas pesa más que uno imputado; los hábitos siguen contando, pero no
 * pueden dominar por sí solos un historial con pesajes reales.
 */
export function balanceMedioPonderado(estado: Estado, ventanaDias = 21): number | null {
  let total = 0;
  let pesoTotal = 0;
  for (let i = 0; i < ventanaDias; i++) {
    const fecha = sumarDias(hoy(), -i);
    const dia = estado.dias[fecha];
    const energia = energiaDe(estado, fecha);
    if (energia.sinRegistro && !energia.imputado) continue;
    const activos = habitosModelo(estado.perfil).map((h) => h.clave);
    const habitos = activos.filter((clave) => dia?.habitos?.[clave] === true).length;
    const tieneKcal = M.num(dia?.kcalConsumidas) !== null;
    const peso = energia.imputado ? 0.18 : tieneKcal && !energia.ingestaIncompleta ? 1 : energia.ingestaIncompleta ? 0.62 : 0.35 + (habitos / totalHabitosPerfil(estado.perfil)) * 0.45;
    total += energia.balance * peso;
    pesoTotal += peso;
  }
  return pesoTotal > 0 ? total / pesoTotal : null;
}

/** Tendencia de peso en kg/semana sobre los últimos N días. */
export function tendencia(estado: Estado, ventanaDias = 28) {
  const p = pesajes(estado);
  if (p.length < 2) return null;
  const limite = sumarDias(p[p.length - 1].fecha, -ventanaDias);
  const recientes = p.filter((x) => x.fecha >= limite);
  return M.tendenciaSemanal(recientes.length >= 2 ? recientes : p);
}

function incertidumbreEnergia(energia: EnergiaDia): number {
  if (energia.imputado) return 700;
  if (energia.consumidasEstimadas && energia.quemadasEstimadas) return 450;
  if (energia.estimado) return 300;
  return 160;
}

function redondearPeso(valor: number): number {
  return Math.round(valor * 100) / 100;
}

function pesoConIntervalo(peso: number, errorKcalCuadrado: number): PesoIntervalo {
  const margen = Math.max(0.25, (1.282 * Math.sqrt(errorKcalCuadrado)) / M.KCAL_POR_KG);
  return {
    peso: redondearPeso(peso),
    minimo: redondearPeso(peso - margen),
    maximo: redondearPeso(peso + margen),
    margen: redondearPeso(margen),
  };
}

export interface ModeloProyeccion {
  calidad: M.CalidadModelo;
  puntos: number;
  spanDias: number;
  kgSemana: number;
  calibrado: boolean;
  tdee: number;
  /** La señal energética se contrasta con la tendencia real cuando la hay. */
  equilibrioConBascula: boolean;
}

export interface ProyeccionConfiable {
  disponible: boolean;
  motivo: string | null;
  modelo: ModeloProyeccion | null;
  diasSinPesaje?: number;
  pesajes?: number;
  diasConDato?: number;
  diasImputados?: number;
  diasDesconocidos?: number;
  balanceDiario?: number;
  hoy?: PesoIntervalo;
  manana?: PesoIntervalo;
  tresDias?: PesoIntervalo;
  semana?: PesoIntervalo;
  quincena?: PesoIntervalo;
  mes?: PesoIntervalo;
  proximoPesaje?: string;
}

/** Proyección energética calibrada (el corazón de RITMO). */
export function proyeccionPesoConfiable(estado: Estado): ProyeccionConfiable {
  const puntos = pesajes(estado);
  const ultimo = puntos.length ? puntos[puntos.length - 1] : null;
  if (!ultimo) return { disponible: false, motivo: "sin-pesajes", modelo: null };

  const hoyDia = diaAbsoluto(hoy());
  const diasSinPesaje = Math.max(0, hoyDia - ultimo.dia);
  const tendenciaRobusta = M.tendenciaRobustaPeso(puntos);
  const calibracion = tdeeDesdeHistorial(estado);
  const desde = sumarDias(ultimo.fecha, 1);
  let balanceDesdeBascula = 0;
  let errorKcalCuadrado = (0.25 * M.KCAL_POR_KG) ** 2;
  let diasConDato = 0;
  let diasImputados = 0;
  let diasDesconocidos = 0;

  for (let fecha = desde; fecha <= hoy(); fecha = sumarDias(fecha, 1)) {
    const energia = energiaDe(estado, fecha);
    if (energia.sinRegistro && !energia.imputado) {
      diasDesconocidos++;
      errorKcalCuadrado += 850 ** 2;
      continue;
    }
    balanceDesdeBascula += energia.balance;
    errorKcalCuadrado += incertidumbreEnergia(energia) ** 2;
    diasConDato++;
    if (energia.imputado) diasImputados++;
  }

  const pesoEnergetico = ultimo.peso + balanceDesdeBascula / M.KCAL_POR_KG;
  const tendenciaReciente = tendenciaRobusta && diasSinPesaje <= 21 ? tendenciaRobusta : null;
  const pesoTendencia = tendenciaReciente
    ? tendenciaReciente.intercepto + tendenciaReciente.pendiente * hoyDia
    : null;
  // La báscula robusta corrige suavemente la energía acumulada cuando ambas
  // señales existen. Nunca sustituye el último pesaje ni oculta la divergencia:
  // cuanto más lejos está la báscula, más peso adquiere y más se abre el rango.
  const mezclaBascula = pesoTendencia !== null ? Math.min(0.35, (diasSinPesaje / 21) * 0.35) : 0;
  const pesoHoy = pesoTendencia === null ? pesoEnergetico : pesoEnergetico * (1 - mezclaBascula) + pesoTendencia * mezclaBascula;
  if (pesoTendencia !== null) errorKcalCuadrado += ((pesoEnergetico - pesoTendencia) * M.KCAL_POR_KG * 0.35) ** 2;

  const balanceEnergetico = balanceMedioPonderado(estado, 21) ?? balanceMedio(estado, 14) ?? 0;
  const balanceTendencia = tendenciaReciente ? (tendenciaReciente.kgSemana / 7) * M.KCAL_POR_KG : null;
  // Con al menos tres pesajes repartidos en dos semanas, la pendiente robusta
  // es una segunda fuente de verdad. Se mezcla con prudencia para amortiguar
  // registros de kcal imperfectos sin convertir variaciones de agua en grasa.
  const pesoTendenciaEnBalance = balanceTendencia !== null && tendenciaReciente && tendenciaReciente.puntos >= 3 && tendenciaReciente.spanDias >= 14;
  const mezclaBalance = pesoTendenciaEnBalance ? (calibracion ? 0.45 : 0.25) : 0;
  const balanceDiario = balanceTendencia === null
    ? balanceEnergetico
    : balanceEnergetico * (1 - mezclaBalance) + balanceTendencia * mezclaBalance;
  const evaluablesRecientes = diasEvaluables(estado, sumarDias(hoy(), -13), hoy());
  const errorDiario = evaluablesRecientes.length
    ? evaluablesRecientes.reduce((suma, d) => suma + incertidumbreEnergia(d.energia), 0) / evaluablesRecientes.length
    : 700;
  // Cualquier hábito marcado ya valida el día; cuantos más haya, más sólida es
  // la señal que el modelo usa para su estimación energética.
  let diasConHabitos = 0;
  const clavesActivas = new Set(habitosModelo(estado.perfil).map((h) => h.clave));
  for (let f = sumarDias(hoy(), -27); f <= hoy(); f = sumarDias(f, 1)) {
    const d = (estado.dias || {})[f];
    if (d && Object.entries(d.habitos || {}).some(([clave, v]) => clavesActivas.has(clave) && v === true)) diasConHabitos++;
  }
  const adherenciaHabitos = diasConHabitos / 28;

  const calidad: M.CalidadModelo =
    calibracion && diasSinPesaje <= 14 && diasDesconocidos === 0
      ? "alta"
      : calibracion && (diasSinPesaje <= 42 || (diasSinPesaje <= 56 && adherenciaHabitos >= 0.7))
        ? "media"
        : "inicial";

  const pronosticar = (dias: number) =>
    pesoConIntervalo(
      pesoHoy + (balanceDiario * dias) / M.KCAL_POR_KG,
      errorKcalCuadrado + dias * errorDiario ** 2,
    );
  const ciclosHastaSiguientePesaje = Math.max(1, Math.ceil(diasSinPesaje / 14));

  return {
    disponible: true,
    motivo: null,
    modelo: {
      calidad,
      puntos: puntos.length,
      spanDias: tendenciaRobusta ? tendenciaRobusta.spanDias : 0,
      kgSemana: redondearPeso((balanceDiario * 7) / M.KCAL_POR_KG),
      calibrado: Boolean(calibracion),
      tdee: tdeeVigente(estado),
      equilibrioConBascula: mezclaBalance > 0,
    },
    diasSinPesaje,
    pesajes: puntos.length,
    diasConDato,
    diasImputados,
    diasDesconocidos,
    balanceDiario,
    hoy: pesoConIntervalo(pesoHoy, errorKcalCuadrado),
    manana: pronosticar(1),
    tresDias: pronosticar(3),
    semana: pronosticar(7),
    quincena: pronosticar(14),
    mes: pronosticar(30),
    proximoPesaje: sumarDias(ultimo.fecha, ciclosHastaSiguientePesaje * 14),
  };
}

/** Días con su recuento de hábitos cumplidos, para rachas. */
function diasConCumplidos(estado: Estado): Array<{ fecha: string; cumplidos: number }> {
  const activos = new Set(habitosModelo(estado.perfil).map((h) => h.clave));
  return diasOrdenados(estado).map((d) => ({
    fecha: d.fecha,
    cumplidos: Object.entries(d.habitos || {}).filter(([clave, v]) => activos.has(clave) && v === true).length,
  }));
}

/** Adherencia media (%) en los últimos N días naturales. */
export function adherencia(estado: Estado, ventanaDias = 30): number {
  const desde = sumarDias(hoy(), -ventanaDias + 1);
  const mapa = estado.dias || {};
  let suma = 0;
  for (let i = 0; i < ventanaDias; i++) {
    const fecha = sumarDias(desde, i);
    suma += M.adherenciaDia((mapa[fecha] || {}).habitos, totalHabitosPerfil(estado.perfil));
  }
  return Math.round((suma / ventanaDias) * 10) / 10;
}

/** Cumplimiento por hábito (%) en los últimos N días naturales. */
export function adherenciaPorHabito<T extends { clave: string }>(
  estado: Estado,
  habitos: T[],
  ventanaDias = 30,
): Array<T & { pct: number; hechos: number; total: number }> {
  const desde = sumarDias(hoy(), -ventanaDias + 1);
  const mapa = estado.dias || {};
  return habitos
    .map((h) => {
      let hechos = 0;
      for (let i = 0; i < ventanaDias; i++) {
        if (((mapa[sumarDias(desde, i)] || {}).habitos || {})[h.clave] === true) hechos++;
      }
      return { ...h, pct: Math.round((hechos / ventanaDias) * 1000) / 10, hechos, total: ventanaDias };
    })
    .sort((a, b) => b.pct - a.pct);
}

/** Relación descriptiva (no causal) entre hábitos y balance reciente. */
export function patronesHabitos(estado: Estado, ventanaDias = 28): Array<{ clave: string; con: number; sin: number; diferencia: number; muestra: number }> {
  const salida: Array<{ clave: string; con: number; sin: number; diferencia: number; muestra: number }> = [];
  for (const { clave } of habitosModelo(estado.perfil)) {
    const con: number[] = []; const sin: number[] = [];
    for (let i = 0; i < ventanaDias; i++) {
      const fecha = sumarDias(hoy(), -i); const d = estado.dias[fecha];
      if (!d) continue;
      const e = energiaDe(estado, fecha); if (e.sinRegistro && !e.imputado) continue;
      (d.habitos?.[clave] ? con : sin).push(e.balance);
    }
    if (con.length >= 2 && sin.length >= 2) {
      const media = (v: number[]) => v.reduce((a, n) => a + n, 0) / v.length;
      salida.push({ clave, con: Math.round(media(con)), sin: Math.round(media(sin)), diferencia: Math.round(media(sin) - media(con)), muestra: con.length + sin.length });
    }
  }
  return salida.sort((a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia)).slice(0, 2);
}

/** Serie de peso con media móvil, lista para el gráfico. */
export function seriePeso(estado: Estado, ventanaDias = 120): { puntos: Pesaje[]; suavizado: Pesaje[] } {
  const p = pesajes(estado);
  if (p.length === 0) return { puntos: [], suavizado: [] };
  const limite = sumarDias(p[p.length - 1].fecha, -ventanaDias);
  const visibles = p.filter((x) => x.fecha >= limite);
  const base = visibles.length >= 2 ? visibles : p;
  const suavizado = M.mediaMovil(base.map((x) => x.peso), 5);
  return {
    puntos: base,
    suavizado: base.map((x, i) => ({ ...x, peso: (suavizado[i] ?? x.peso) as number })),
  };
}

/** Serie de balance calórico diario de los últimos N días. */
export function serieBalance(estado: Estado, ventanaDias = 30): Array<{ fecha: string; balance: number | null; imputado: boolean }> {
  const desde = sumarDias(hoy(), -ventanaDias + 1);
  const salida = [];
  for (let i = 0; i < ventanaDias; i++) {
    const fecha = sumarDias(desde, i);
    const e = energiaDe(estado, fecha);
    salida.push({
      fecha,
      balance: e.sinRegistro && !e.imputado ? null : e.balance,
      imputado: e.imputado,
    });
  }
  return salida;
}

/* ------------------------------------------------------------- RESUMEN */

/** Todo lo que necesita el panel principal, en una sola pasada. */
export function resumen(estado: Estado) {
  const perfil = estado.perfil || ({} as Estado["perfil"]);
  const actual = pesoActual(estado);
  const todos = pesajes(estado);
  const inicial = todos.length ? todos[0] : null;

  const energiaHoy = energiaDe(estado, hoy());
  const balanceProm = balanceMedio(estado, 14);
  const tdeeObs = tdeeDesdeHistorial(estado);
  const proyeccionConfiable = proyeccionPesoConfiable(estado);
  const tend = tendencia(estado);

  const comp = ultimaComposicion(estado);
  const desglose = comp ? M.composicion(comp.peso, comp.grasaPct) : null;

  const arr = arrastre(estado);
  const partida = proyeccionConfiable.hoy ? proyeccionConfiable.hoy.peso : actual ? actual.peso : null;
  const imcValor = partida !== null ? M.imc(partida, perfil.alturaCm) : null;

  const balanceTendencia = proyeccionConfiable.disponible ? proyeccionConfiable.balanceDiario ?? null : null;
  const diasObjetivo =
    partida !== null && balanceTendencia !== null
      ? M.diasHastaObjetivo(partida, perfil.pesoObjetivo, balanceTendencia)
      : null;

  const cumplidos = diasConCumplidos(estado);

  return {
    peso: {
      actual: actual ? actual.peso : null,
      fecha: actual ? actual.fecha : null,
      inicial: inicial ? inicial.peso : null,
      fechaInicial: inicial ? inicial.fecha : null,
      totalPerdido: actual && inicial ? Math.round((inicial.peso - actual.peso) * 10) / 10 : null,
      objetivo: perfil.pesoObjetivo ?? null,
      restante:
        partida !== null && perfil.pesoObjetivo != null
          ? Math.round((partida - perfil.pesoObjetivo) * 10) / 10
          : null,
      registros: todos.length,
      estimadoHoy: partida,
    },
    arrastre: arr,
    energia: {
      ...energiaHoy,
      balanceMedio: balanceProm,
      tdee: tdeeVigente(estado),
      tdeeObservado: tdeeObs,
      objetivoKcal: perfil.kcalObjetivo ?? null,
    },
    prediccion: {
      hoy: proyeccionConfiable.hoy ?? null,
      manana: proyeccionConfiable.manana ?? null,
      tresDias: proyeccionConfiable.tresDias ?? null,
      semana: proyeccionConfiable.semana ?? null,
      quincena: proyeccionConfiable.quincena ?? null,
      mes: proyeccionConfiable.mes ?? null,
      partida,
      diasObjetivo,
      fechaObjetivo: diasObjetivo ? sumarDias(hoy(), Math.round(diasObjetivo)) : null,
      modelo: proyeccionConfiable.modelo,
      disponible: proyeccionConfiable.disponible,
      motivo: proyeccionConfiable.motivo,
      diasSinPesaje: proyeccionConfiable.diasSinPesaje ?? null,
      pesajes: proyeccionConfiable.pesajes ?? todos.length,
      proximoPesaje: proyeccionConfiable.proximoPesaje ?? null,
    },
    composicion: desglose
      ? {
          ...desglose,
          fecha: comp!.fecha,
          ffmi: M.ffmi(comp!.peso, comp!.grasaPct, perfil.alturaCm),
          rango: M.rangoGrasa(perfil.sexo),
          extra: comp!,
        }
      : null,
    imc: imcValor !== null ? { valor: imcValor, categoria: M.categoriaIMC(imcValor) } : null,
    tendencia: tend,
    habitos: {
      adherencia30: adherencia(estado, 30),
      adherencia7: adherencia(estado, 7),
      // La racha exige todos los hábitos activos configurados por la persona.
      rachaActual: M.rachaActual(cumplidos, totalHabitosPerfil(perfil), hoy()),
      mejorRacha: M.mejorRacha(cumplidos, totalHabitosPerfil(perfil)),
      diasRegistrados: cumplidos.length,
    },
  };
}

export type Resumen = ReturnType<typeof resumen>;

/** Comidas recientes únicas (por texto normalizado), de más a menos frecuente
    y luego más reciente. Para el registro rápido de un toque. */
export function comidasFrecuentes(estado: Estado, limite = 6): Array<{ comida: Comida; veces: number }> {
  const dias = diasOrdenados(estado);
  const mapa = new Map<string, { comida: Comida; veces: number; ultima: string }>();
  for (const d of dias) {
    for (const c of d.comidas || []) {
      const clave = (c.texto || "").trim().toLowerCase();
      if (!clave) continue;
      const prev = mapa.get(clave);
      if (prev) {
        prev.veces += 1;
        if (d.fecha > prev.ultima) { prev.ultima = d.fecha; prev.comida = c; }
      } else {
        mapa.set(clave, { comida: c, veces: 1, ultima: d.fecha });
      }
    }
  }
  return [...mapa.values()]
    .sort((a, b) => (b.veces - a.veces) || (a.ultima < b.ultima ? 1 : -1))
    .slice(0, limite)
    .map(({ comida, veces }) => ({ comida, veces }));
}

export interface ResumenMes {
  clave: string;        // "2026-08"
  etiqueta: string;     // "ago 2026"
  diasRegistrados: number;
  adherenciaMedia: number;   // 0..100
  cambioPeso: number | null; // kg (último - primer pesaje del mes)
  comidasRegistradas: number;
}

const MESES_ABREV = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Agrega el histórico por mes natural, del más reciente al más antiguo.
    Base de records personales y comparativas mes a mes. */
export function resumenPorMes(estado: Estado): ResumenMes[] {
  const dias = diasOrdenados(estado);
  const pesos = pesajes(estado);
  const porMes = new Map<string, { dias: Dia[]; pesos: Pesaje[] }>();

  for (const d of dias) {
    const clave = d.fecha.slice(0, 7);
    if (!porMes.has(clave)) porMes.set(clave, { dias: [], pesos: [] });
    porMes.get(clave)!.dias.push(d);
  }
  for (const p of pesos) {
    const clave = p.fecha.slice(0, 7);
    if (!porMes.has(clave)) porMes.set(clave, { dias: [], pesos: [] });
    porMes.get(clave)!.pesos.push(p);
  }

  const salida: ResumenMes[] = [];
  for (const [clave, { dias: ds, pesos: ps }] of porMes) {
    const conReg = ds.filter((d) => Object.values(d.habitos || {}).some(Boolean) || (d.comidas?.length ?? 0) > 0 || d.peso != null);
    const adhSuma = ds.reduce((a, d) => a + M.adherenciaDia(d.habitos, totalHabitosPerfil(estado.perfil)), 0);
    const [y, m] = clave.split("-");
    const cambioPeso = ps.length >= 2 ? Math.round((ps[ps.length - 1].peso - ps[0].peso) * 10) / 10 : null;
    salida.push({
      clave,
      etiqueta: `${MESES_ABREV[Number(m) - 1]} ${y}`,
      diasRegistrados: conReg.length,
      adherenciaMedia: ds.length ? Math.round(adhSuma / ds.length) : 0,
      cambioPeso,
      comidasRegistradas: ds.reduce((a, d) => a + (d.comidas?.length ?? 0), 0),
    });
  }
  return salida.sort((a, b) => (a.clave < b.clave ? 1 : -1));
}

export interface RecordsPersonales {
  mejorMesAdherencia: ResumenMes | null;
  mayorPerdidaMes: ResumenMes | null; // mes con cambioPeso más negativo
  totalComidas: number;
  totalDiasRegistrados: number;
}

/** Records personales derivados del histórico mensual. */
export function recordsPersonales(estado: Estado): RecordsPersonales {
  const meses = resumenPorMes(estado);
  const conAdh = meses.filter((m) => m.diasRegistrados > 0);
  const mejorMesAdherencia = conAdh.length
    ? conAdh.reduce((mejor, m) => (m.adherenciaMedia > mejor.adherenciaMedia ? m : mejor))
    : null;
  const conCambio = meses.filter((m) => m.cambioPeso != null);
  const mayorPerdidaMes = conCambio.length
    ? conCambio.reduce((mejor, m) => ((m.cambioPeso as number) < (mejor.cambioPeso as number) ? m : mejor))
    : null;
  return {
    mejorMesAdherencia,
    mayorPerdidaMes: mayorPerdidaMes && (mayorPerdidaMes.cambioPeso as number) < 0 ? mayorPerdidaMes : null,
    totalComidas: meses.reduce((a, m) => a + m.comidasRegistradas, 0),
    totalDiasRegistrados: meses.reduce((a, m) => a + m.diasRegistrados, 0),
  };
}

/* ---------------------------------------------------------------- BIBLIOTECA */

export interface ComidaGuardada {
  clave: string;   // "tipo:texto normalizado" — identidad estable
  texto: string;   // etiqueta a mostrar (la más reciente)
  tipo: TipoComida;
  kcal: number;
  proteinas: number;
  carbohidratos: number;
  grasas: number;
  estimado?: boolean;
  veces: number;
  ultima: string;  // fecha del último uso
}

export type OrdenBiblioteca = "kcal" | "alfabetico" | "frecuencia";

/**
 * Biblioteca de comidas del usuario, agrupada por tipo. Se deriva del histórico:
 * cada comida única (por tipo + texto normalizado) se guarda una vez, con sus
 * macros más recientes, cuántas veces se ha usado y la última fecha. Es la
 * "base de datos" personal para reutilizar cualquier día, siempre en sincronía
 * con lo que realmente se registra.
 */
export function bibliotecaComidas(
  estado: Estado,
  orden: OrdenBiblioteca = "frecuencia",
): Record<TipoComida, ComidaGuardada[]> {
  const mapa = new Map<string, ComidaGuardada>();

  for (const d of diasOrdenados(estado)) {
    for (const c of d.comidas || []) {
      const norm = (c.texto || "").trim().toLowerCase().replace(/\s+/g, " ");
      if (!norm) continue;
      const clave = `${c.tipo}:${norm}`;
      const prev = mapa.get(clave);
      if (prev) {
        prev.veces += 1;
        if (d.fecha >= prev.ultima) {
          // Los valores más recientes mandan (pudiste corregir la comida).
          prev.ultima = d.fecha;
          prev.texto = c.texto;
          prev.kcal = c.kcal;
          prev.proteinas = c.proteinas;
          prev.carbohidratos = c.carbohidratos;
          prev.grasas = c.grasas;
          prev.estimado = c.estimado;
        }
      } else {
        mapa.set(clave, {
          clave,
          texto: c.texto,
          tipo: c.tipo,
          kcal: c.kcal,
          proteinas: c.proteinas,
          carbohidratos: c.carbohidratos,
          grasas: c.grasas,
          estimado: c.estimado,
          veces: 1,
          ultima: d.fecha,
        });
      }
    }
  }

  const cmp: Record<OrdenBiblioteca, (a: ComidaGuardada, b: ComidaGuardada) => number> = {
    kcal: (a, b) => b.kcal - a.kcal,
    alfabetico: (a, b) => a.texto.localeCompare(b.texto, "es", { sensitivity: "base" }),
    frecuencia: (a, b) => (b.veces - a.veces) || (a.ultima < b.ultima ? 1 : -1),
  };

  const salida: Record<string, ComidaGuardada[]> = { desayuno: [], comida: [], cena: [], snack: [] };
  for (const item of mapa.values()) salida[item.tipo].push(item);
  for (const k of Object.keys(salida)) salida[k].sort(cmp[orden]);
  return salida as Record<TipoComida, ComidaGuardada[]>;
}

export interface Meseta {
  enMeseta: boolean;
  dias: number;           // días cubiertos por el análisis
  cambioKg: number;       // cambio de peso en la ventana
  balanceDiario: number;  // kcal/día medio en la ventana
  sugerencia: "bajar-kcal" | "subir-kcal" | "revisar-registro" | null;
}

/**
 * Detecta un estancamiento: el peso lleva ~plano varias semanas pese a que el
 * balance energético debería moverlo. Señal clásica de que el TDEE real ha
 * cambiado (adaptación metabólica) o de que el registro se está quedando corto.
 */
export function detectarMeseta(estado: Estado, ventanaDias = 28): Meseta {
  const vacio: Meseta = { enMeseta: false, dias: 0, cambioKg: 0, balanceDiario: 0, sugerencia: null };
  const p = pesajes(estado);
  if (p.length < 2) return vacio;

  const limite = sumarDias(hoy(), -ventanaDias);
  const win = p.filter((x) => x.fecha >= limite);
  if (win.length < 2) return vacio;

  const dias = win[win.length - 1].dia - win[0].dia;
  if (dias < 18) return vacio; // hace falta al menos ~3 semanas para hablar de meseta

  const cambioKg = Math.round((win[win.length - 1].peso - win[0].peso) * 10) / 10;
  const balanceDiario = balanceMedio(estado, ventanaDias) ?? 0;

  // Peso plano: menos de ~0,4 kg de variación en el periodo.
  const plano = Math.abs(cambioKg) < 0.4;
  // El balance "debería" haber movido el peso de forma perceptible.
  const balanceRelevante = Math.abs(balanceDiario) >= 150;

  if (!plano || !balanceRelevante) return vacio;

  const objetivo = estado.perfil?.objetivo ?? "perder";
  let sugerencia: Meseta["sugerencia"] = "revisar-registro";
  if (balanceDiario < 0 && objetivo === "perder") sugerencia = "bajar-kcal";
  else if (balanceDiario > 0 && objetivo === "ganar") sugerencia = "subir-kcal";

  return { enMeseta: true, dias, cambioKg, balanceDiario: Math.round(balanceDiario), sugerencia };
}
