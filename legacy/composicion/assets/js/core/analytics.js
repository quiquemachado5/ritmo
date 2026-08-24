/* ============================================================================
   ANALYTICS — derivaciones sobre el estado completo.

   Combina los datos crudos con `metrics.js` para producir todo lo que pintan
   las vistas. Sigue siendo puro: recibe el estado, devuelve un resumen.
   ========================================================================= */

import * as M from './metrics.js';
import { diaAbsoluto, diasEntre, hoy, sumarDias } from './dates.js';
import { TOTAL_HABITOS } from '../config.js';

/** Días como array ordenado por fecha ascendente. */
export function diasOrdenados(estado) {
  return Object.values(estado.dias || {}).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
}

/** Solo los días con peso registrado, ordenados. */
export function pesajes(estado) {
  return diasOrdenados(estado)
    .filter((d) => M.num(d.peso) !== null)
    .map((d) => ({ fecha: d.fecha, peso: d.peso, dia: diaAbsoluto(d.fecha) }));
}

/** Último peso conocido, sea de un día de registro o de una medición. */
export function pesoActual(estado) {
  const p = pesajes(estado);
  const ultimoDia = p.length ? p[p.length - 1] : null;

  const comps = (estado.composicion || [])
    .filter((c) => M.num(c.peso) !== null)
    .sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  const ultimaComp = comps.length ? comps[comps.length - 1] : null;

  if (!ultimoDia && !ultimaComp) return null;
  if (!ultimaComp) return ultimoDia;
  if (!ultimoDia) return { fecha: ultimaComp.fecha, peso: ultimaComp.peso, dia: diaAbsoluto(ultimaComp.fecha) };
  return ultimaComp.fecha > ultimoDia.fecha
    ? { fecha: ultimaComp.fecha, peso: ultimaComp.peso, dia: diaAbsoluto(ultimaComp.fecha) }
    : ultimoDia;
}

/** Última medición que incluya porcentaje de grasa. */
export function ultimaComposicion(estado) {
  const comps = (estado.composicion || [])
    .filter((c) => M.num(c.grasaPct) !== null && M.num(c.peso) !== null)
    .sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  return comps.length ? comps[comps.length - 1] : null;
}

/** Configuración de imputación derivada del perfil del usuario. */
export function reglaImputacion(estado) {
  const p = estado.perfil || {};
  return {
    activa: p.imputarActiva !== false,
    desde: p.imputarDesde || '2026-07-01',
    superavitKcal: M.num(p.imputarSuperavitKcal) ?? 500,
  };
}

/**
 * Energía de un día concreto, con los parámetros del perfil aplicados.
 * Se pasa siempre la fecha para que la imputación pueda decidir si aplica.
 */
export function energiaDe(estado, fecha) {
  const dia = (estado.dias || {})[fecha] || { fecha, habitos: {} };
  const perfil = estado.perfil || {};
  return M.energiaDia({ ...dia, fecha }, {
    kcalObjetivo: perfil.kcalObjetivo,
    tdeeBase: tdeeVigente(estado),
    imputacion: reglaImputacion(estado),
  });
}

/**
 * Días de un intervalo que aportan información: los registrados y los
 * imputados. Los huecos anteriores a la fecha de imputación se descartan.
 */
export function diasEvaluables(estado, desde, hasta) {
  const salida = [];
  let cursor = desde;
  let guarda = 0;
  while (cursor <= hasta && guarda++ < 5000) {
    const e = energiaDe(estado, cursor);
    if (!e.sinRegistro || e.imputado) salida.push({ fecha: cursor, energia: e });
    cursor = sumarDias(cursor, 1);
  }
  return salida;
}

/**
 * ARRASTRE ACUMULADO — el corazón del ajuste.
 *
 * Entre el último pesaje real y hoy pasan días. Unos están registrados y otros
 * no; con la imputación activa, los no registrados cuentan como superávit. La
 * suma de todos esos balances es energía que ya ha ocurrido pero que la báscula
 * todavía no ha reflejado, porque hace días que no te pesas.
 *
 * Devuelve el peso que el modelo estima que tienes HOY, no el de tu último pesaje.
 */
export function arrastre(estado) {
  const ultimo = pesoActual(estado);
  if (!ultimo) return null;

  const desde = sumarDias(ultimo.fecha, 1); // el día del pesaje ya está medido
  const hasta = hoy();
  if (desde > hasta) {
    return {
      dias: 0, diasImputados: 0, diasRegistrados: 0,
      balanceTotal: 0, deltaKg: 0,
      pesoBase: ultimo.peso, pesoEstimado: ultimo.peso, fechaBase: ultimo.fecha,
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

/**
 * TDEE vigente: el observado a partir del historial real si hay suficiente,
 * y si no el teórico de Mifflin-St Jeor con el factor de actividad del perfil.
 */
/**
 * Caché del TDEE.
 *
 * `energiaDe` se llama una vez por día natural y necesita el TDEE; calcularlo
 * cada vez obligaba a recorrer el historial completo en cada iteración, lo que
 * convertía el cálculo del arrastre en cuadrático.
 *
 * El store muta el objeto de estado en sitio, así que su identidad no sirve
 * para invalidar: se compara además `estado.version`, que el store incrementa
 * en cada notificación. La WeakMap evita retener estados antiguos en memoria.
 */
const cacheTdee = new WeakMap();

export function tdeeVigente(estado) {
  const guardado = cacheTdee.get(estado);
  if (guardado && guardado.version === estado.version) return guardado.valor;
  const valor = calcularTdeeVigente(estado);
  cacheTdee.set(estado, { version: estado.version, valor });
  return valor;
}

function calcularTdeeVigente(estado) {
  const observado = tdeeDesdeHistorial(estado);
  if (observado) return observado.kcal;

  const perfil = estado.perfil || {};
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

/**
 * TDEE calculado a partir de pesos y del consumo anotado en una ventana.
 * Requiere pesajes al principio y al final, y al menos 21 días de separación
 * para que el ruido de agua corporal no domine el resultado. Las calorías
 * explícitas pesan más que las inferidas desde hábitos, pero estas últimas se
 * conservan como señal cuando no hay un registro numérico completo.
 */
export function tdeeDesdeHistorial(estado, ventanaDias = 60) {
  const p = pesajes(estado);
  if (p.length < 2) return null;

  const fin = p[p.length - 1];
  const limite = sumarDias(fin.fecha, -ventanaDias);
  const candidatos = p.filter((x) => x.fecha >= limite);
  if (candidatos.length < 2) return null;

  const inicio = candidatos[0];
  const dias = diasEntre(inicio.fecha, fin.fecha);
  if (dias < 21) return null;

  // La media se extrapola a todo el intervalo, así que se exige cobertura alta.
  // La procedencia queda expuesta para que la interfaz nunca confunda una
  // calibración completa con una basada parcialmente en hábitos.
  const enRango = diasOrdenados(estado).filter((d) => d.fecha >= inicio.fecha && d.fecha <= fin.fecha);
  if (enRango.length < 14 || enRango.length / dias < 0.6) return null;
  const explicitas = enRango.filter((d) => M.num(d.kcalConsumidas) !== null).length;
  const perfil = estado.perfil || {};
  const consumos = enRango.map((d) => {
    const explicito = M.num(d.kcalConsumidas);
    return explicito !== null ? explicito : M.estimarKcalConsumidas(d.habitos, perfil.kcalObjetivo).kcal;
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

/**
 * Balance medio diario de los últimos N días CON registro.
 *
 * Se cuentan días registrados, no días de calendario: si has estado tres
 * semanas sin anotar nada, la media debe seguir describiendo tu último periodo
 * real de seguimiento, no inventar tres semanas de dieta libre.
 */
export function balanceMedio(estado, ventanaDias = 14) {
  // Se recorre el calendario hacia atrás desde hoy para que los días imputados
  // —que no existen como registro— entren en la media igual que los reales.
  const evaluables = diasEvaluables(estado, sumarDias(hoy(), -365), hoy()).slice(-ventanaDias);
  if (evaluables.length === 0) return null;
  const suma = evaluables.reduce((a, d) => a + d.energia.balance, 0);
  return suma / evaluables.length;
}

/** Tendencia de peso en kg/semana sobre los últimos N días. */
export function tendencia(estado, ventanaDias = 28) {
  const p = pesajes(estado);
  if (p.length < 2) return null;
  const limite = sumarDias(p[p.length - 1].fecha, -ventanaDias);
  const recientes = p.filter((x) => x.fecha >= limite);
  return M.tendenciaSemanal(recientes.length >= 2 ? recientes : p);
}

/** Incertidumbre diaria en kcal según la procedencia del dato. */
function incertidumbreEnergia(energia) {
  if (energia.imputado) return 700;
  if (energia.consumidasEstimadas && energia.quemadasEstimadas) return 450;
  if (energia.estimado) return 300;
  return 160;
}

function redondearPeso(valor) {
  return Math.round(valor * 100) / 100;
}

/** Construye un peso previsto y su rango orientativo de incertidumbre. */
function pesoConIntervalo(peso, errorKcalCuadrado) {
  const margen = Math.max(0.25, 1.282 * Math.sqrt(errorKcalCuadrado) / M.KCAL_POR_KG);
  return {
    peso: redondearPeso(peso),
    minimo: redondearPeso(peso - margen),
    maximo: redondearPeso(peso + margen),
    margen: redondearPeso(margen),
  };
}

/**
 * Proyección energética calibrada.
 *
 * Parte de la última báscula y usa el balance de cada día registrado después.
 * La calibración del gasto se apoya en los intervalos históricos entre pesajes;
 * los hábitos y los días imputados aportan una estimación, pero ensanchan el
 * intervalo en proporción a su incertidumbre. Así se puede estimar entre
 * pesajes sin vender el resultado como un peso medido.
 */
export function proyeccionPesoConfiable(estado) {
  const puntos = pesajes(estado);
  const ultimo = puntos.length ? puntos[puntos.length - 1] : null;
  if (!ultimo) return { disponible: false, motivo: 'sin-pesajes', modelo: null };

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
      // No se inventa un balance para un hueco que el usuario decidió ignorar;
      // solo se reconoce que ese tramo abre más el intervalo.
      diasDesconocidos++;
      errorKcalCuadrado += 850 ** 2;
      continue;
    }
    balanceDesdeBascula += energia.balance;
    errorKcalCuadrado += incertidumbreEnergia(energia) ** 2;
    diasConDato++;
    if (energia.imputado) diasImputados++;
  }

  const pesoHoy = ultimo.peso + balanceDesdeBascula / M.KCAL_POR_KG;
  const balanceDiario = balanceMedio(estado, 14) ?? 0;
  const evaluablesRecientes = diasEvaluables(estado, sumarDias(hoy(), -13), hoy());
  const errorDiario = evaluablesRecientes.length
    ? evaluablesRecientes.reduce((suma, d) => suma + incertidumbreEnergia(d.energia), 0) / evaluablesRecientes.length
    : 700;
  const calidad = calibracion && diasSinPesaje <= 14 && diasDesconocidos === 0
    ? 'alta'
    : calibracion && diasSinPesaje <= 42
      ? 'media'
      : 'inicial';

  const pronosticar = (dias) => pesoConIntervalo(
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
    },
    diasSinPesaje,
    pesajes: puntos.length,
    diasConDato,
    diasImputados,
    diasDesconocidos,
    balanceDiario,
    hoy: pesoConIntervalo(pesoHoy, errorKcalCuadrado),
    manana: pronosticar(1),
    semana: pronosticar(7),
    quincena: pronosticar(14),
    mes: pronosticar(30),
    proximoPesaje: sumarDias(ultimo.fecha, ciclosHastaSiguientePesaje * 14),
  };
}

/** Días con su recuento de hábitos cumplidos, para rachas. */
function diasConCumplidos(estado) {
  return diasOrdenados(estado).map((d) => ({
    fecha: d.fecha,
    cumplidos: Object.values(d.habitos || {}).filter((v) => v === true).length,
  }));
}

/** Adherencia media (%) en los últimos N días naturales. */
export function adherencia(estado, ventanaDias = 30) {
  const desde = sumarDias(hoy(), -ventanaDias + 1);
  const mapa = estado.dias || {};
  let suma = 0;
  for (let i = 0; i < ventanaDias; i++) {
    const fecha = sumarDias(desde, i);
    suma += M.adherenciaDia((mapa[fecha] || {}).habitos, TOTAL_HABITOS);
  }
  return Math.round((suma / ventanaDias) * 10) / 10;
}

/** Cumplimiento por hábito (%) en los últimos N días naturales. */
export function adherenciaPorHabito(estado, habitos, ventanaDias = 30) {
  const desde = sumarDias(hoy(), -ventanaDias + 1);
  const mapa = estado.dias || {};
  return habitos.map((h) => {
    let hechos = 0;
    for (let i = 0; i < ventanaDias; i++) {
      if (((mapa[sumarDias(desde, i)] || {}).habitos || {})[h.clave] === true) hechos++;
    }
    return { ...h, pct: Math.round((hechos / ventanaDias) * 1000) / 10, hechos, total: ventanaDias };
  }).sort((a, b) => b.pct - a.pct);
}

/** Serie de peso con media móvil, lista para el gráfico. */
export function seriePeso(estado, ventanaDias = 120) {
  const p = pesajes(estado);
  if (p.length === 0) return { puntos: [], suavizado: [] };
  const limite = sumarDias(p[p.length - 1].fecha, -ventanaDias);
  const visibles = p.filter((x) => x.fecha >= limite);
  const base = visibles.length >= 2 ? visibles : p;
  const suavizado = M.mediaMovil(base.map((x) => x.peso), 5);
  return {
    puntos: base,
    suavizado: base.map((x, i) => ({ ...x, peso: suavizado[i] })),
  };
}

/** Serie de balance calórico diario de los últimos N días. */
export function serieBalance(estado, ventanaDias = 30) {
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
export function resumen(estado) {
  const perfil = estado.perfil || {};
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

  // El arrastre sigue disponible para auditar los días imputados, pero no se
  // usa como peso actual ni como predicción. Una suma de calorías estimadas no
  // es tan fiable como una serie de pesajes reales.
  const arr = arrastre(estado);
  const partida = proyeccionConfiable.hoy ? proyeccionConfiable.hoy.peso : (actual ? actual.peso : null);

  // El IMC se calcula sobre el peso estimado de hoy, igual que todo lo demás,
  // para que no haya dos IMC distintos según la pantalla que mires.
  const imcValor = partida !== null ? M.imc(partida, perfil.alturaCm) : null;

  const balanceTendencia = proyeccionConfiable.disponible
    ? proyeccionConfiable.balanceDiario
    : null;
  const diasObjetivo = partida !== null && balanceTendencia !== null
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
      // Lo que falta se mide contra el peso estimado de hoy, no contra el
      // último pesaje: si llevas días sin registrar, ya no estás donde creías.
      restante: partida !== null && perfil.pesoObjetivo != null
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
      manana: proyeccionConfiable.manana ?? null,
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
          fecha: comp.fecha,
          ffmi: M.ffmi(comp.peso, comp.grasaPct, perfil.alturaCm),
          rango: M.rangoGrasa(perfil.sexo),
          extra: comp,
        }
      : null,
    imc: imcValor !== null ? { valor: imcValor, categoria: M.categoriaIMC(imcValor) } : null,
    tendencia: tend,
    habitos: {
      adherencia30: adherencia(estado, 30),
      adherencia7: adherencia(estado, 7),
      rachaActual: M.rachaActual(cumplidos, perfil.umbralRacha ?? 4),
      mejorRacha: M.mejorRacha(cumplidos, perfil.umbralRacha ?? 4),
      diasRegistrados: cumplidos.length,
    },
  };
}
