/* ============================================================================
   METRICS — toda la matemática de la aplicación.

   Funciones PURAS: sin DOM, sin estado global, sin efectos. Reciben datos y
   devuelven datos. Por eso se pueden ejecutar y verificar en `tests/`.

   Convención de signos, usada de forma consistente en todo el proyecto:
     balance > 0  → superávit  → el peso tiende a subir
     balance < 0  → déficit    → el peso tiende a bajar
   ========================================================================= */

/** Equivalente energético de 1 kg de tejido adiposo (regla de Wishnofsky). */
export const KCAL_POR_KG = 7700;

/** Devuelve `n` si es un número real utilizable, y `null` en cualquier otro caso. */
export function num(n) {
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

function redondear(n, decimales) {
  const f = 10 ** decimales;
  return Math.round((n + Number.EPSILON) * f) / f;
}

/* ---------------------------------------------------------------- BALANCE */

/**
 * Balance Calórico Neto = Calorías consumidas − Calorías quemadas.
 * @returns {number|null} null si falta cualquiera de los dos valores.
 */
export function balanceNeto(kcalConsumidas, kcalQuemadas) {
  const inn = num(kcalConsumidas);
  const out = num(kcalQuemadas);
  if (inn === null || out === null) return null;
  return inn - out;
}

/** Déficit calórico: el balance con el signo invertido (positivo = estás en déficit). */
export function deficitCalorico(kcalConsumidas, kcalQuemadas) {
  const b = balanceNeto(kcalConsumidas, kcalQuemadas);
  return b === null ? null : -b;
}

/** Kilos de tejido que representa una cantidad de energía. */
export function kcalAKg(kcal) {
  const k = num(kcal);
  return k === null ? null : k / KCAL_POR_KG;
}

/* -------------------------------------------------------------- PREDICCIÓN */

/**
 * Predicción de Peso = Peso Actual + (Balance Neto / 7700).
 *
 * Con balance negativo (déficit) el resultado es menor que el peso actual.
 * @returns {number|null}
 */
export function prediccionPeso(pesoActual, balance) {
  const p = num(pesoActual);
  const b = num(balance);
  if (p === null || b === null) return null;
  return p + b / KCAL_POR_KG;
}

/**
 * Proyección a N días manteniendo un balance diario constante.
 * @returns {number|null}
 */
export function proyeccionPeso(pesoActual, balanceDiario, dias) {
  const b = num(balanceDiario);
  const d = num(dias);
  if (b === null || d === null) return null;
  return prediccionPeso(pesoActual, b * d);
}

/**
 * Días necesarios para alcanzar un peso objetivo con un balance diario dado.
 * @returns {number|null} null si el balance empuja en dirección contraria al objetivo.
 */
export function diasHastaObjetivo(pesoActual, pesoObjetivo, balanceDiario) {
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

/** Masa grasa en kg a partir del peso y el porcentaje de grasa. */
export function masaGrasaKg(peso, grasaPct) {
  const p = num(peso);
  const g = num(grasaPct);
  if (p === null || g === null) return null;
  return redondear(p * (g / 100), 2);
}

/** Masa magra (todo lo que no es grasa) en kg. */
export function masaMagraKg(peso, grasaPct) {
  const p = num(peso);
  const mg = masaGrasaKg(peso, grasaPct);
  if (p === null || mg === null) return null;
  return redondear(p - mg, 2);
}

/** Desglose completo de composición corporal. */
export function composicion(peso, grasaPct) {
  const grasaKg = masaGrasaKg(peso, grasaPct);
  const magraKg = masaMagraKg(peso, grasaPct);
  if (grasaKg === null || magraKg === null) return null;
  return {
    pesoKg: redondear(num(peso), 2),
    grasaPct: redondear(num(grasaPct), 1),
    magraPct: redondear(100 - num(grasaPct), 1),
    grasaKg,
    magraKg,
  };
}

/** Índice de Masa Corporal. La altura se pasa en centímetros. */
export function imc(peso, alturaCm) {
  const p = num(peso);
  const h = num(alturaCm);
  if (p === null || h === null || h <= 0) return null;
  const m = h / 100;
  return redondear(p / (m * m), 1);
}

/**
 * FFMI — índice de masa libre de grasa. Complementa al IMC porque no penaliza
 * la masa muscular, así que distingue "pesado por músculo" de "pesado por grasa".
 */
export function ffmi(peso, grasaPct, alturaCm) {
  const magra = masaMagraKg(peso, grasaPct);
  const h = num(alturaCm);
  if (magra === null || h === null || h <= 0) return null;
  const m = h / 100;
  return redondear(magra / (m * m), 1);
}

/** Categoría OMS del IMC. */
export function categoriaIMC(valor) {
  const v = num(valor);
  if (v === null) return null;
  if (v < 18.5) return { clave: 'bajo',      etiqueta: 'Bajo peso',   tono: 'warn' };
  if (v < 25)   return { clave: 'normal',    etiqueta: 'Normopeso',   tono: 'good' };
  if (v < 30)   return { clave: 'sobrepeso', etiqueta: 'Sobrepeso',   tono: 'warn' };
  if (v < 35)   return { clave: 'obesidad1', etiqueta: 'Obesidad I',  tono: 'bad'  };
  if (v < 40)   return { clave: 'obesidad2', etiqueta: 'Obesidad II', tono: 'bad'  };
  return          { clave: 'obesidad3', etiqueta: 'Obesidad III', tono: 'bad' };
}

/**
 * Rango saludable de grasa corporal (ACE) según sexo.
 * Se usa para situar el valor actual en contexto, no como diagnóstico.
 */
export function rangoGrasa(sexo) {
  return sexo === 'mujer'
    ? { min: 21, max: 32, atleta: 20 }
    : { min: 8,  max: 19, atleta: 13 };
}

/* ------------------------------------------------------------------ SERIES */

/**
 * Media móvil simple. Devuelve un array del mismo tamaño; las posiciones sin
 * ventana completa se rellenan con la media de los valores disponibles.
 */
export function mediaMovil(valores, ventana = 7) {
  if (!Array.isArray(valores) || valores.length === 0) return [];
  const salida = [];
  for (let i = 0; i < valores.length; i++) {
    const desde = Math.max(0, i - ventana + 1);
    const trozo = valores.slice(desde, i + 1).filter((v) => num(v) !== null);
    salida.push(trozo.length ? trozo.reduce((a, b) => a + b, 0) / trozo.length : null);
  }
  return salida;
}

/**
 * Regresión lineal por mínimos cuadrados sobre puntos {x, y}.
 * @returns {{pendiente:number, intercepto:number, r2:number, n:number}|null}
 */
export function regresionLineal(puntos) {
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

/**
 * Tendencia de peso en kg/semana a partir de pesajes {dia, peso}, donde `dia`
 * es un número de día absoluto. Negativa = estás perdiendo peso.
 */
export function tendenciaSemanal(pesajes) {
  const r = regresionLineal((pesajes || []).map((p) => ({ x: p.dia, y: p.peso })));
  if (!r) return null;
  return { kgSemana: redondear(r.pendiente * 7, 3), r2: redondear(r.r2, 3), n: r.n };
}

/** Mediana de una serie numérica. Resiste mejor un pesaje aislado anómalo que la media. */
function mediana(valores) {
  const ordenados = (valores || []).filter((v) => num(v) !== null).sort((a, b) => a - b);
  if (ordenados.length === 0) return null;
  const centro = Math.floor(ordenados.length / 2);
  return ordenados.length % 2
    ? ordenados[centro]
    : (ordenados[centro - 1] + ordenados[centro]) / 2;
}

/**
 * Tendencia robusta de peso mediante la pendiente mediana de Theil–Sen.
 *
 * La báscula recoge agua, sal, digestión y hora de pesaje además de tejido.
 * Por eso la proyección no sigue el último número ni una suma de calorías
 * estimadas: busca la dirección común de varios pesajes reales y trata los
 * valores aislados como ruido. Si no hay al menos tres pesajes repartidos en
 * dos semanas, devuelve null en lugar de aparentar certeza.
 */
export function tendenciaRobustaPeso(pesajes, { ventanaDias = 56, minDias = 14 } = {}) {
  const todos = (pesajes || [])
    .filter((p) => num(p.dia) !== null && num(p.peso) !== null)
    .sort((a, b) => a.dia - b.dia);
  if (todos.length < 3) return null;

  const ultimo = todos[todos.length - 1];
  const recientes = todos.filter((p) => p.dia >= ultimo.dia - ventanaDias);
  // Si la ventana corta deja menos de tres puntos, se usa el historial mínimo
  // disponible; aun así el resultado no se usa si el último pesaje está viejo.
  const puntos = recientes.length >= 3 ? recientes : todos;
  const spanDias = puntos[puntos.length - 1].dia - puntos[0].dia;
  if (spanDias < minDias) return null;

  const pendientes = [];
  for (let i = 0; i < puntos.length - 1; i++) {
    for (let j = i + 1; j < puntos.length; j++) {
      const dias = puntos[j].dia - puntos[i].dia;
      if (dias > 0) pendientes.push((puntos[j].peso - puntos[i].peso) / dias);
    }
  }
  const pendiente = mediana(pendientes);
  if (pendiente === null) return null;

  const intercepto = mediana(puntos.map((p) => p.peso - pendiente * p.dia));
  const residuos = puntos.map((p) => p.peso - (intercepto + pendiente * p.dia));
  const mad = mediana(residuos.map((r) => Math.abs(r))) ?? 0;
  // MAD escalada: una medida de dispersión menos sensible que la desviación típica.
  const dispersion = 1.4826 * mad;
  const mediaDia = puntos.reduce((suma, p) => suma + p.dia, 0) / puntos.length;
  const sxx = puntos.reduce((suma, p) => suma + (p.dia - mediaDia) ** 2, 0);
  const errorPendiente = sxx > 0 ? dispersion / Math.sqrt(sxx) : 0;

  const calidad = puntos.length >= 8 && spanDias >= 42 && dispersion <= 0.65
    ? 'alta'
    : puntos.length >= 5 && spanDias >= 28 && dispersion <= 0.9
      ? 'media'
      : 'inicial';

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

/**
 * Predicción de tendencia con un intervalo orientativo del 80 %.
 * El intervalo crece con la distancia porque cuanto más lejos se proyecta,
 * menos honesto es mostrar un solo decimal como si fuese un hecho.
 */
export function prediccionTendenciaPeso(pesajes, diaDestino, opciones = {}) {
  const destino = num(diaDestino);
  if (destino === null) return null;
  const modelo = tendenciaRobustaPeso(pesajes, opciones);
  if (!modelo) return null;

  const distancia = Math.max(0, destino - modelo.ultimoDia);
  const peso = modelo.intercepto + modelo.pendiente * destino;
  const incertidumbre = Math.sqrt(
    modelo.dispersion ** 2 + (modelo.errorPendiente * distancia) ** 2,
  );
  // Incluso con pesajes muy consistentes, la oscilación diaria del peso no es cero.
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
 *
 *   ΔPeso · 7700 = ΣConsumidas − ΣGastadas
 *   ⇒ TDEE = mediaConsumidas − (ΔPeso · 7700) / nDías
 *
 * Es más fiable que cualquier fórmula predictiva porque se calibra con TU
 * balance real, pero necesita historial suficiente.
 *
 * @param {{pesoInicial:number, pesoFinal:number, dias:number, kcalMediaConsumida:number}} d
 */
export function tdeeObservado(d) {
  const pi = num(d && d.pesoInicial);
  const pf = num(d && d.pesoFinal);
  const dias = num(d && d.dias);
  const media = num(d && d.kcalMediaConsumida);
  if (pi === null || pf === null || media === null || dias === null || dias <= 0) return null;
  const deltaKcal = (pf - pi) * KCAL_POR_KG;
  return redondear(media - deltaKcal / dias, 0);
}

/**
 * TDEE teórico: Mifflin-St Jeor (metabolismo basal) × factor de actividad.
 * Se usa como punto de partida cuando aún no hay historial que calibrar.
 */
export function tdeeTeorico({ peso, alturaCm, edad, sexo, factorActividad = 1.375 }) {
  const p = num(peso);
  const h = num(alturaCm);
  const e = num(edad);
  if (p === null || h === null || e === null) return null;
  const base = 10 * p + 6.25 * h - 5 * e + (sexo === 'mujer' ? -161 : 5);
  return redondear(base * factorActividad, 0);
}

/** Metabolismo basal (Mifflin-St Jeor), sin factor de actividad. */
export function metabolismoBasal({ peso, alturaCm, edad, sexo }) {
  return tdeeTeorico({ peso, alturaCm, edad, sexo, factorActividad: 1 });
}

export const FACTORES_ACTIVIDAD = [
  { clave: 'sedentario', etiqueta: 'Sedentario',    factor: 1.2,   detalle: 'Trabajo de oficina, sin ejercicio' },
  { clave: 'ligero',     etiqueta: 'Ligero',        factor: 1.375, detalle: 'Ejercicio 1–3 días por semana' },
  { clave: 'moderado',   etiqueta: 'Moderado',      factor: 1.55,  detalle: 'Ejercicio 3–5 días por semana' },
  { clave: 'alto',       etiqueta: 'Alto',          factor: 1.725, detalle: 'Ejercicio 6–7 días por semana' },
  { clave: 'muyAlto',    etiqueta: 'Muy alto',      factor: 1.9,   detalle: 'Trabajo físico o doble sesión' },
];

/* -------------------------------------------------------------- ADHERENCIA */

/** Porcentaje de hábitos cumplidos en un día. */
export function adherenciaDia(habitos, totalHabitos) {
  const total = num(totalHabitos);
  if (!total || total <= 0) return 0;
  const hechos = Object.values(habitos || {}).filter((v) => v === true).length;
  return redondear((hechos / total) * 100, 1);
}

/**
 * Nivel de intensidad 0–4 para el mapa de calor del calendario.
 * Un día sin ningún hábito marcado y sin peso devuelve null (día vacío).
 */
export function nivelDia(habitos, totalHabitos) {
  const hechos = Object.values(habitos || {}).filter((v) => v === true).length;
  if (hechos === 0) return 0;
  const ratio = hechos / (totalHabitos || 1);
  if (ratio >= 1)    return 4;
  if (ratio >= 0.75) return 3;
  if (ratio >= 0.5)  return 2;
  return 1;
}

/**
 * Racha actual: días consecutivos hacia atrás desde el último con actividad,
 * que alcanzan el umbral mínimo de hábitos cumplidos.
 *
 * @param {Array<{fecha:string, cumplidos:number}>} dias ordenados ascendente
 */
export function rachaActual(dias, umbral = 4) {
  if (!Array.isArray(dias) || dias.length === 0) return 0;
  let racha = 0;
  for (let i = dias.length - 1; i >= 0; i--) {
    if (dias[i].cumplidos >= umbral) racha++;
    else break;
  }
  return racha;
}

/** Racha más larga registrada en todo el historial. */
export function mejorRacha(dias, umbral = 4) {
  if (!Array.isArray(dias)) return 0;
  let mejor = 0;
  let actual = 0;
  for (const d of dias) {
    if (d.cumplidos >= umbral) {
      actual++;
      if (actual > mejor) mejor = actual;
    } else {
      actual = 0;
    }
  }
  return mejor;
}

/* ------------------------------------------------------- ESTIMACIÓN KCAL */

/**
 * Estimación de calorías consumidas a partir de los hábitos marcados.
 *
 * Solo se usa como respaldo para días históricos anteriores al registro
 * numérico de calorías: si el día tiene `kcalConsumidas` explícitas, mandan
 * esas y esta función no interviene. Los valores replican el modelo calibrado
 * de la versión anterior de la aplicación.
 */
export function estimarKcalConsumidas(habitos, kcalObjetivo = 1350) {
  const h = habitos || {};
  const comida = h.comida === true;
  const cena = h.cena === true;
  const sinAlcohol = h.noAlcohol === true;
  const objetivo = num(kcalObjetivo) === null ? 1350 : kcalObjetivo;

  let kcal;
  let plan;
  if (comida && cena) {
    kcal = objetivo;
    plan = 'completo';
    if (!sinAlcohol) kcal += 550;
  } else if (comida || cena) {
    kcal = comida ? 1950 : 2100;
    plan = 'parcial';
    if (!sinAlcohol) kcal += 400;
  } else {
    kcal = 2450;
    plan = 'libre';
    if (!sinAlcohol) kcal += 300;
  }
  return { kcal, plan, estimado: true };
}

/**
 * Estimación de gasto: TDEE de referencia con un ajuste por entrenamiento.
 * Igual que arriba, cede siempre ante un valor explícito del usuario.
 */
export function estimarKcalQuemadas(habitos, tdeeBase = 2450) {
  const base = num(tdeeBase) === null ? 2450 : tdeeBase;
  const deporte = (habitos || {}).deporte === true;
  return { kcal: redondear(base + (deporte ? 320 : 0), 0), estimado: true };
}

/* ---------------------------------------------------------------- RESUMEN */

/**
 * Energía resuelta de un día: usa los valores explícitos si existen y recurre
 * a la estimación solo cuando faltan. Deja constancia de qué se ha usado.
 */
export function energiaDia(dia, opciones = {}) {
  const { kcalObjetivo = 1350, tdeeBase = 2450, imputacion = null } = opciones;
  const d = dia || {};

  const inExplicito = num(d.kcalConsumidas);
  const outExplicito = num(d.kcalQuemadas);

  // Un día sin absolutamente nada anotado no es un día de dieta libre: es un
  // día del que no sabemos nada. Distinguirlo evita que los huecos del
  // historial contaminen las medias y las proyecciones con superávits ficticios.
  const sinRegistro = inExplicito === null
    && outExplicito === null
    && num(d.peso) === null
    && !Object.values(d.habitos || {}).some((v) => v === true);

  // Imputación: a partir de la fecha configurada, un hueco deja de ser
  // "no lo sé" y pasa a ser "fue un día malo". Se le asigna un superávit fijo.
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
      sinRegistro: true,
      imputado: true,
    };
  }

  const inn = inExplicito !== null
    ? { kcal: inExplicito, estimado: false }
    : estimarKcalConsumidas(d.habitos, kcalObjetivo);

  const out = outExplicito !== null
    ? { kcal: outExplicito, estimado: false }
    : estimarKcalQuemadas(d.habitos, tdeeBase);

  const balance = balanceNeto(inn.kcal, out.kcal);

  return {
    consumidas: inn.kcal,
    quemadas: out.kcal,
    balance,
    deficit: -balance,
    deltaKg: kcalAKg(balance),
    estimado: inn.estimado || out.estimado,
    consumidasEstimadas: inn.estimado,
    quemadasEstimadas: out.estimado,
    sinRegistro,
    imputado: false,
  };
}
