/* ============================================================================
   PRUEBAS de la capa de cálculo.

   Ejecutar con:  npm test        (o: node tests/run.js)

   No hay dependencias ni framework: son funciones puras, así que basta con
   compararlas contra valores calculados a mano.
   ========================================================================= */

import * as M from '../assets/js/core/metrics.js';
import * as A from '../assets/js/core/analytics.js';
import * as F from '../assets/js/core/dates.js';

let pasadas = 0;
const fallos = [];
let grupoActual = '';

const VERDE = '\x1b[32m';
const ROJO = '\x1b[31m';
const GRIS = '\x1b[90m';
const NEGRITA = '\x1b[1m';
const RESET = '\x1b[0m';

function grupo(nombre) {
  grupoActual = nombre;
  console.log(`\n${NEGRITA}${nombre}${RESET}`);
}

function comprobar(descripcion, condicion, detalle = '') {
  if (condicion) {
    pasadas++;
    console.log(`  ${VERDE}✓${RESET} ${GRIS}${descripcion}${RESET}`);
  } else {
    fallos.push(`${grupoActual} → ${descripcion}${detalle ? ` (${detalle})` : ''}`);
    console.log(`  ${ROJO}✗ ${descripcion}${RESET}${detalle ? ` ${ROJO}${detalle}${RESET}` : ''}`);
  }
}

/** Igualdad numérica con tolerancia, para no pelearse con el binario flotante. */
function casi(descripcion, obtenido, esperado, tolerancia = 1e-6) {
  const ok = obtenido !== null && Math.abs(obtenido - esperado) <= tolerancia;
  comprobar(descripcion, ok, ok ? '' : `esperado ${esperado}, obtenido ${obtenido}`);
}

function igual(descripcion, obtenido, esperado) {
  const ok = obtenido === esperado;
  comprobar(descripcion, ok, ok ? '' : `esperado ${JSON.stringify(esperado)}, obtenido ${JSON.stringify(obtenido)}`);
}

/* ------------------------------------------------------- BALANCE CALÓRICO */

grupo('Balance calórico neto = consumidas − quemadas');

casi('2000 consumidas y 2500 quemadas → −500 (déficit)', M.balanceNeto(2000, 2500), -500);
casi('3000 consumidas y 2500 quemadas → +500 (superávit)', M.balanceNeto(3000, 2500), 500);
casi('mismo valor en ambas → 0', M.balanceNeto(2200, 2200), 0);
igual('falta un dato → null', M.balanceNeto(2000, null), null);
igual('un texto no es un número → null', M.balanceNeto('2000', 2500), null);
igual('NaN se rechaza → null', M.balanceNeto(NaN, 2500), null);
casi('el déficit es el balance invertido', M.deficitCalorico(2000, 2500), 500);

/* ------------------------------------------------------- PREDICCIÓN PESO */

grupo('Predicción de peso = peso actual + balance / 7700');

igual('la constante es 7700 kcal por kg', M.KCAL_POR_KG, 7700);
casi('90 kg con −7700 kcal → 89 kg exactos', M.prediccionPeso(90, -7700), 89);
casi('90 kg con +7700 kcal → 91 kg exactos', M.prediccionPeso(90, 7700), 91);
casi('90 kg con −500 kcal → 89.935…', M.prediccionPeso(90, -500), 90 - 500 / 7700, 1e-9);
casi('balance 0 no cambia el peso', M.prediccionPeso(88.5, 0), 88.5);
igual('sin peso de referencia → null', M.prediccionPeso(null, -500), null);

casi('7 días a −500 kcal → −0,4545 kg', M.proyeccionPeso(90, -500, 7) - 90, (-500 * 7) / 7700, 1e-9);
casi('30 días a −500 kcal → ≈ −1,948 kg', M.proyeccionPeso(90, -500, 30) - 90, (-500 * 30) / 7700, 1e-9);
casi('1 kg equivale a 7700 kcal', M.kcalAKg(7700), 1);

grupo('Días hasta el objetivo');

// De 90 kg a 85 kg (−5 kg = −38 500 kcal) con −500 kcal/día → 77 días.
casi('90 → 85 kg con −500 kcal/día son 77 días', M.diasHastaObjetivo(90, 85, -500), 77, 1e-9);
igual('un superávit nunca alcanza un objetivo menor → null', M.diasHastaObjetivo(90, 85, 500), null);
igual('balance cero → null', M.diasHastaObjetivo(90, 85, 0), null);

/* --------------------------------------------------- COMPOSICIÓN CORPORAL */

grupo('Desglose de composición corporal');

casi('100 kg al 20 % → 20 kg de grasa', M.masaGrasaKg(100, 20), 20);
casi('100 kg al 20 % → 80 kg de masa magra', M.masaMagraKg(100, 20), 80);
casi('88,5 kg al 16,7 % → 14,78 kg de grasa', M.masaGrasaKg(88.5, 16.7), 14.78, 0.005);
casi('88,5 kg al 16,7 % → 73,72 kg magros', M.masaMagraKg(88.5, 16.7), 73.72, 0.005);

const desglose = M.composicion(88.5, 16.7);
casi('grasa + magra = peso total', desglose.grasaKg + desglose.magraKg, 88.5, 0.02);
casi('% grasa + % magra = 100', desglose.grasaPct + desglose.magraPct, 100, 0.05);
igual('0 % de grasa → 0 kg de grasa', M.masaGrasaKg(80, 0), 0);
igual('sin porcentaje → null', M.masaGrasaKg(80, null), null);

grupo('IMC y FFMI');

casi('80 kg y 200 cm → IMC 20', M.imc(80, 200), 20);
casi('88,5 kg y 185 cm → IMC 25,9', M.imc(88.5, 185), 25.9, 0.05);
igual('altura cero → null', M.imc(80, 0), null);
igual('IMC 22 es normopeso', M.categoriaIMC(22).clave, 'normal');
igual('IMC 27 es sobrepeso', M.categoriaIMC(27).clave, 'sobrepeso');
igual('IMC 18,4 es bajo peso', M.categoriaIMC(18.4).clave, 'bajo');
igual('IMC 25 justo entra en sobrepeso', M.categoriaIMC(25).clave, 'sobrepeso');
igual('IMC 41 es obesidad III', M.categoriaIMC(41).clave, 'obesidad3');
casi('FFMI de 88,5 kg al 16,7 % y 185 cm', M.ffmi(88.5, 16.7, 185), 21.5, 0.1);

/* ------------------------------------------------------------ REGRESIÓN */

grupo('Regresión lineal y tendencia');

const recta = M.regresionLineal([{ x: 0, y: 10 }, { x: 1, y: 12 }, { x: 2, y: 14 }, { x: 3, y: 16 }]);
casi('pendiente exacta en una recta perfecta', recta.pendiente, 2);
casi('intercepto exacto', recta.intercepto, 10);
casi('R² = 1 cuando los puntos son colineales', recta.r2, 1);
igual('un solo punto no define una recta → null', M.regresionLineal([{ x: 1, y: 1 }]), null);
igual('todos los x iguales → null', M.regresionLineal([{ x: 1, y: 1 }, { x: 1, y: 5 }]), null);

// 0,1 kg menos por día son 0,7 kg por semana.
const tend = M.tendenciaSemanal([
  { dia: 0, peso: 90 }, { dia: 1, peso: 89.9 }, { dia: 2, peso: 89.8 }, { dia: 3, peso: 89.7 },
]);
casi('bajar 0,1 kg/día son −0,7 kg/semana', tend.kgSemana, -0.7, 1e-9);

grupo('Tendencia robusta e intervalo de peso');

const pesajesConRuido = [
  { dia: 0, peso: 90 }, { dia: 7, peso: 89.6 }, { dia: 14, peso: 89.2 },
  { dia: 21, peso: 90.1 }, // retención puntual: no debe girar todo el modelo
  { dia: 28, peso: 88.4 }, { dia: 35, peso: 88.0 },
];
const robusta = M.tendenciaRobustaPeso(pesajesConRuido);
comprobar('la pendiente robusta conserva una bajada pese a un pesaje anómalo',
  robusta !== null && robusta.kgSemana < -0.25, `obtenido ${robusta?.kgSemana}`);
igual('menos de tres pesajes no crean una tendencia',
  M.tendenciaRobustaPeso([{ dia: 0, peso: 90 }, { dia: 14, peso: 89.5 }]), null);
const predRobusta = M.prediccionTendenciaPeso(pesajesConRuido, 65);
comprobar('la predicción robusta incluye un rango ordenado',
  predRobusta !== null && predRobusta.minimo < predRobusta.peso && predRobusta.maximo > predRobusta.peso);

grupo('Media móvil');

const mm = M.mediaMovil([1, 2, 3, 4, 5], 3);
casi('el primer valor es él mismo', mm[0], 1);
casi('el segundo es la media de los dos primeros', mm[1], 1.5);
casi('el tercero ya usa la ventana completa', mm[2], 2);
casi('el último promedia 3, 4 y 5', mm[4], 4);
igual('serie vacía → array vacío', M.mediaMovil([]).length, 0);

/* ---------------------------------------------------------------- TDEE */

grupo('TDEE observado a partir del historial');

// Comiendo 2000 kcal durante 30 días y perdiendo 2 kg:
// 2 kg × 7700 = 15 400 kcal de déficit total → 513,33 kcal/día.
// TDEE = 2000 + 513,33 = 2513.
casi('perder 2 kg en 30 días comiendo 2000 kcal → TDEE ≈ 2513',
  M.tdeeObservado({ pesoInicial: 90, pesoFinal: 88, dias: 30, kcalMediaConsumida: 2000 }), 2513, 1);
casi('peso estable → el TDEE iguala lo consumido',
  M.tdeeObservado({ pesoInicial: 90, pesoFinal: 90, dias: 30, kcalMediaConsumida: 2400 }), 2400);
casi('ganar 1 kg en 30 días baja el TDEE bajo lo consumido',
  M.tdeeObservado({ pesoInicial: 89, pesoFinal: 90, dias: 30, kcalMediaConsumida: 2800 }),
  2800 - 7700 / 30, 1);
igual('sin días → null', M.tdeeObservado({ pesoInicial: 90, pesoFinal: 88, dias: 0, kcalMediaConsumida: 2000 }), null);

grupo('TDEE teórico (Mifflin-St Jeor)');

// Hombre, 80 kg, 180 cm, 30 años: 10·80 + 6.25·180 − 5·30 + 5 = 1780 kcal basales.
casi('metabolismo basal de referencia',
  M.metabolismoBasal({ peso: 80, alturaCm: 180, edad: 30, sexo: 'hombre' }), 1780);
casi('mujer, mismos datos: 166 kcal menos',
  M.metabolismoBasal({ peso: 80, alturaCm: 180, edad: 30, sexo: 'mujer' }), 1614);
casi('con factor 1,55 el gasto sube proporcionalmente',
  M.tdeeTeorico({ peso: 80, alturaCm: 180, edad: 30, sexo: 'hombre', factorActividad: 1.55 }),
  Math.round(1780 * 1.55));

/* ---------------------------------------------------------- ADHERENCIA */

grupo('Adherencia, niveles y rachas');

casi('3 de 6 hábitos → 50 %', M.adherenciaDia({ a: true, b: true, c: true }, 6), 50);
casi('ninguno marcado → 0 %', M.adherenciaDia({}, 6), 0);
comprobar('los valores que no son true no cuentan',
  M.adherenciaDia({ a: true, b: false, c: 1, d: 'true' }, 4) === 25);

igual('día vacío → nivel 0', M.nivelDia({}, 6), 0);
igual('todos los hábitos → nivel 4', M.nivelDia({ a: true, b: true, c: true, d: true, e: true, f: true }, 6), 4);
igual('la mitad → nivel 2', M.nivelDia({ a: true, b: true, c: true }, 6), 2);

const historial = [
  { fecha: '2026-01-01', cumplidos: 6 },
  { fecha: '2026-01-02', cumplidos: 5 },
  { fecha: '2026-01-03', cumplidos: 2 },
  { fecha: '2026-01-04', cumplidos: 4 },
  { fecha: '2026-01-05', cumplidos: 6 },
];
igual('racha actual: los dos últimos días', M.rachaActual(historial, 4), 2);
igual('mejor racha del historial', M.mejorRacha(historial, 4), 2);
igual('sin datos, racha 0', M.rachaActual([], 4), 0);
igual('un umbral inalcanzable deja la racha a 0', M.rachaActual(historial, 7), 0);

/* --------------------------------------------------------------- FECHAS */

grupo('Fechas');

igual('sumar un día cruza el fin de mes', F.sumarDias('2026-01-31', 1), '2026-02-01');
igual('restar un día cruza el fin de año', F.sumarDias('2026-01-01', -1), '2025-12-31');
igual('2024 es bisiesto', F.sumarDias('2024-02-28', 1), '2024-02-29');
igual('2026 no lo es', F.sumarDias('2026-02-28', 1), '2026-03-01');
igual('días entre dos fechas', F.diasEntre('2026-01-01', '2026-01-31'), 30);
igual('el orden invertido da negativo', F.diasEntre('2026-01-31', '2026-01-01'), -30);
igual('días de un mes de 30', F.limitesMes('2026-04').dias, 30);
igual('febrero bisiesto tiene 29', F.limitesMes('2024-02').dias, 29);
igual('1 de enero de 2026 fue jueves', F.diaSemanaLunes('2026-01-01'), 3);
igual('el rango incluye ambos extremos', F.rango('2026-01-01', '2026-01-05').length, 5);
igual('sumar meses cruza el año', F.sumarMeses('2026-12', 1), '2027-01');

// El día absoluto debe avanzar de uno en uno aunque cambie el mes.
igual('el día absoluto avanza uniformemente',
  F.diaAbsoluto('2026-03-01') - F.diaAbsoluto('2026-02-28'), 1);

/* ----------------------------------------------- ENERGÍA E INTEGRACIÓN */

grupo('Energía de un día');

const explicito = M.energiaDia({ kcalConsumidas: 1800, kcalQuemadas: 2500, habitos: {} });
casi('con valores explícitos el balance es directo', explicito.balance, -700);
igual('y no se marca como estimado', explicito.estimado, false);
casi('el delta de peso es el balance entre 7700', explicito.deltaKg, -700 / 7700, 1e-9);

const estimado = M.energiaDia({ habitos: { comida: true, cena: true, noAlcohol: true } }, { kcalObjetivo: 1350 });
igual('sin valores explícitos se estima', estimado.estimado, true);
casi('dieta completa sin alcohol → objetivo exacto', estimado.consumidas, 1350);

const mixto = M.energiaDia({ kcalConsumidas: 1500, habitos: { deporte: true } }, { tdeeBase: 2400 });
igual('lo consumido es explícito', mixto.consumidasEstimadas, false);
igual('lo quemado se estima', mixto.quemadasEstimadas, true);
casi('el deporte suma al gasto estimado', mixto.quemadas, 2720);

grupo('Días sin registro: detección');

igual('un día completamente vacío se marca como sin registro',
  M.energiaDia({ habitos: {} }).sinRegistro, true);
igual('un día sin hábitos pero con peso sí cuenta como registro',
  M.energiaDia({ habitos: {}, peso: 88 }).sinRegistro, false);
igual('un hábito marcado ya es registro',
  M.energiaDia({ habitos: { comida: true } }).sinRegistro, false);
igual('unas calorías explícitas ya son registro',
  M.energiaDia({ habitos: {}, kcalConsumidas: 1800 }).sinRegistro, false);

grupo('Imputación de días sin registro');

const HOY = F.hoy();
const perfilBase = {
  alturaCm: 185, edad: 34, sexo: 'hombre', pesoObjetivo: 85,
  kcalObjetivo: 1350, factorActividad: 1.375, umbralRacha: 4,
};
const regla = { activa: true, desde: F.sumarDias(HOY, -10), superavitKcal: 500 };

// --- La regla se aplica solo a partir de su fecha de corte ---------------
const dentro = M.energiaDia({ fecha: F.sumarDias(HOY, -5), habitos: {} }, { imputacion: regla });
igual('un hueco posterior al corte se imputa', dentro.imputado, true);
casi('y se le asigna el superávit configurado', dentro.balance, 500);
casi('que equivale a +0,065 kg', dentro.deltaKg, 500 / 7700, 1e-9);

const fuera = M.energiaDia({ fecha: F.sumarDias(HOY, -30), habitos: {} }, { imputacion: regla });
igual('un hueco anterior al corte sigue siendo desconocido', fuera.imputado, false);
igual('y no se cuenta como registro', fuera.sinRegistro, true);

const registrado = M.energiaDia(
  { fecha: F.sumarDias(HOY, -5), habitos: { comida: true, cena: true, noAlcohol: true } },
  { imputacion: regla },
);
igual('un día registrado nunca se imputa', registrado.imputado, false);
comprobar('y conserva su balance real', registrado.balance !== 500, `obtenido ${registrado.balance}`);

igual('con la regla desactivada no se imputa nada',
  M.energiaDia({ fecha: F.sumarDias(HOY, -5), habitos: {} },
    { imputacion: { ...regla, activa: false } }).imputado, false);

grupo('Arrastre acumulado desde el último pesaje');

const conHuecos = {
  perfil: { ...perfilBase, imputarActiva: true, imputarDesde: F.sumarDias(HOY, -10), imputarSuperavitKcal: 500 },
  dias: { [F.sumarDias(HOY, -10)]: { fecha: F.sumarDias(HOY, -10), habitos: {}, peso: 90 } },
  composicion: [{ fecha: F.sumarDias(HOY, -10), peso: 90, grasaPct: 20 }],
};

const arr = A.arrastre(conHuecos);
igual('los 10 días posteriores al pesaje se imputan', arr.diasImputados, 10);
igual('y ninguno está registrado', arr.diasRegistrados, 0);
casi('10 días × 500 kcal = 5000 kcal de arrastre', arr.balanceTotal, 5000);
casi('que son +0,65 kg', arr.deltaKg, 0.65, 0.01);
casi('el peso base es el medido', arr.pesoBase, 90);
casi('y el estimado de hoy lo supera', arr.pesoEstimado, 90.65, 0.01);

// El arrastre debe llegar hasta la proyección y hasta lo que falta al objetivo.
const rHuecos = A.resumen(conHuecos);
casi('la proyección parte del peso estimado, no del medido', rHuecos.prediccion.partida, 90.65, 0.01);
casi('lo que falta al objetivo se mide desde el estimado', rHuecos.peso.restante, 5.7, 0.15);
// La media incluye los 10 imputados y también el día del pesaje, que tiene
// balance propio, así que queda algo por debajo de los 500 imputados.
comprobar('el balance medio queda dominado por los días imputados',
  rHuecos.energia.balanceMedio > 400 && rHuecos.energia.balanceMedio <= 500,
  `obtenido ${rHuecos.energia.balanceMedio?.toFixed(1)}`);

const proyHuecos = A.proyeccionPesoConfiable(conHuecos);
comprobar('la estimación sigue disponible entre pesajes', proyHuecos.disponible === true);
casi('la estimación entre pesajes parte del último peso más el balance acumulado', proyHuecos.hoy.peso, 90.65, 0.01);
comprobar('el rango se ensancha al proyectar a un mes',
  proyHuecos.mes.margen > proyHuecos.hoy.margen,
  `${proyHuecos.mes.margen} vs ${proyHuecos.hoy.margen}`);
comprobar('la proyección incluye el horizonte quincenal',
  proyHuecos.quincena.margen > proyHuecos.semana.margen);
igual('el próximo pesaje cae al siguiente ciclo de 14 días',
  proyHuecos.proximoPesaje, F.sumarDias(HOY, 4));
igual('con superávit constante el objetivo es inalcanzable', rHuecos.prediccion.diasObjetivo, null);

// Registrar un día que estaba imputado debe reducir el arrastre.
const corregido = {
  ...conHuecos,
  dias: {
    ...conHuecos.dias,
    [F.sumarDias(HOY, -5)]: {
      fecha: F.sumarDias(HOY, -5),
      habitos: { comida: true, cena: true, noAlcohol: true, deporte: true },
    },
  },
};
const arrCorregido = A.arrastre(corregido);
igual('al registrar un día quedan 9 imputados', arrCorregido.diasImputados, 9);
comprobar('y el arrastre baja', arrCorregido.balanceTotal < arr.balanceTotal,
  `${arrCorregido.balanceTotal} vs ${arr.balanceTotal}`);

grupo('Con la regla desactivada se recupera el criterio conservador');

const sinRegla = {
  perfil: { ...perfilBase, imputarActiva: false },
  dias: { [F.sumarDias(HOY, -10)]: { fecha: F.sumarDias(HOY, -10), habitos: {}, peso: 90 } },
  composicion: [],
};
const arrSin = A.arrastre(sinRegla);
igual('no se imputa ningún día', arrSin.diasImputados, 0);
casi('el arrastre es nulo', arrSin.deltaKg, 0);
casi('y el peso estimado es el medido', arrSin.pesoEstimado, 90);
igual('sin días evaluables el balance medio es null',
  A.balanceMedio({ perfil: { ...perfilBase, imputarActiva: false }, dias: {}, composicion: [] }, 14), null);

grupo('Integración: resumen sobre un estado completo');

const estado = {
  perfil: { alturaCm: 185, edad: 34, sexo: 'hombre', pesoObjetivo: 85, kcalObjetivo: 1350,
            factorActividad: 1.375, umbralRacha: 4, imputarActiva: false },
  dias: {
    '2026-01-01': { fecha: '2026-01-01', habitos: { comida: true, cena: true, noAlcohol: true, deporte: true }, peso: 92 },
    '2026-02-01': { fecha: '2026-02-01', habitos: { comida: true, cena: true }, peso: 90 },
    '2026-03-01': { fecha: '2026-03-01', habitos: { comida: true }, peso: 88.5, kcalConsumidas: 1800, kcalQuemadas: 2600 },
  },
  composicion: [
    { fecha: '2026-01-01', peso: 92, grasaPct: 22 },
    { fecha: '2026-03-01', peso: 88.5, grasaPct: 16.7 },
  ],
};

const r = A.resumen(estado);
casi('el peso actual es el último registrado', r.peso.actual, 88.5);
casi('el peso inicial es el primero', r.peso.inicial, 92);
casi('la pérdida total son 3,5 kg', r.peso.totalPerdido, 3.5);
casi('quedan 3,5 kg hasta el objetivo', r.peso.restante, 3.5);
igual('cuenta los tres pesajes', r.peso.registros, 3);
casi('la composición usa la última medición', r.composicion.grasaPct, 16.7);
casi('masa grasa de la última medición', r.composicion.grasaKg, 14.78, 0.01);
casi('masa magra de la última medición', r.composicion.magraKg, 73.72, 0.01);
comprobar('el IMC está en el rango esperado', r.imc.valor > 25 && r.imc.valor < 27, `obtenido ${r.imc?.valor}`);
comprobar('la tendencia es descendente', r.tendencia.kgSemana < 0, `obtenido ${r.tendencia?.kgSemana}`);

const pesajesEstado = A.pesajes(estado);
igual('los pesajes salen ordenados', pesajesEstado[0].fecha, '2026-01-01');
igual('y el último es el más reciente', pesajesEstado[pesajesEstado.length - 1].fecha, '2026-03-01');

const conVacio = A.resumen({ perfil: estado.perfil, dias: {}, composicion: [] });
igual('un estado vacío no rompe: peso null', conVacio.peso.actual, null);
igual('un estado vacío no rompe: composición null', conVacio.composicion, null);

/* --------------------------------------------------------------- RESULTADO */

const total = pasadas + fallos.length;
console.log(`\n${'─'.repeat(58)}`);
if (fallos.length === 0) {
  console.log(`${VERDE}${NEGRITA}✓ ${pasadas}/${total} comprobaciones correctas${RESET}\n`);
  process.exit(0);
} else {
  console.log(`${ROJO}${NEGRITA}✗ ${fallos.length} de ${total} comprobaciones han fallado:${RESET}`);
  for (const f of fallos) console.log(`  ${ROJO}·${RESET} ${f}`);
  console.log('');
  process.exit(1);
}
