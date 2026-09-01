/* ============================================================================
   Pruebas del modelo (portadas de la app anterior a Vitest).
   Verifican que la traducción a TypeScript conserva la matemática exacta.
   ========================================================================= */

import { describe, it, expect } from "vitest";
import * as M from "../metrics";
import * as A from "../analytics";
import * as F from "../dates";
import { SEED_COMPOSICION, SEED_DIAS } from "../seed";
import type { Estado } from "../types";

/* Helpers equivalentes a los del test runner original. */
function casi(got: number | null, exp: number, tol = 1e-6) {
  expect(got).not.toBeNull();
  expect(Math.abs((got as number) - exp)).toBeLessThanOrEqual(tol);
}
function igual<T>(got: T, exp: T) {
  expect(got).toStrictEqual(exp);
}
const estado = (o: unknown) => o as Estado;

describe("Balance calórico neto", () => {
  it("consumidas − quemadas", () => {
    casi(M.balanceNeto(2000, 2500), -500);
    casi(M.balanceNeto(3000, 2500), 500);
    casi(M.balanceNeto(2200, 2200), 0);
    igual(M.balanceNeto(2000, null), null);
    igual(M.balanceNeto("2000", 2500), null);
    igual(M.balanceNeto(NaN, 2500), null);
    casi(M.deficitCalorico(2000, 2500), 500);
  });
});

describe("Predicción de peso", () => {
  it("peso + balance / 7700", () => {
    igual(M.KCAL_POR_KG, 7700);
    casi(M.prediccionPeso(90, -7700), 89);
    casi(M.prediccionPeso(90, 7700), 91);
    casi(M.prediccionPeso(90, -500), 90 - 500 / 7700, 1e-9);
    casi(M.prediccionPeso(88.5, 0), 88.5);
    igual(M.prediccionPeso(null, -500), null);
    casi((M.proyeccionPeso(90, -500, 7) as number) - 90, (-500 * 7) / 7700, 1e-9);
    casi((M.proyeccionPeso(90, -500, 30) as number) - 90, (-500 * 30) / 7700, 1e-9);
    casi(M.kcalAKg(7700), 1);
  });
  it("días hasta el objetivo", () => {
    casi(M.diasHastaObjetivo(90, 85, -500), 77, 1e-9);
    igual(M.diasHastaObjetivo(90, 85, 500), null);
    igual(M.diasHastaObjetivo(90, 85, 0), null);
  });
});

describe("Composición corporal", () => {
  it("desglose", () => {
    casi(M.masaGrasaKg(100, 20), 20);
    casi(M.masaMagraKg(100, 20), 80);
    casi(M.masaGrasaKg(88.5, 16.7), 14.78, 0.005);
    casi(M.masaMagraKg(88.5, 16.7), 73.72, 0.005);
    const d = M.composicion(88.5, 16.7)!;
    casi(d.grasaKg + d.magraKg, 88.5, 0.02);
    casi(d.grasaPct + d.magraPct, 100, 0.05);
    igual(M.masaGrasaKg(80, 0), 0);
    igual(M.masaGrasaKg(80, null), null);
  });
  it("IMC y FFMI", () => {
    casi(M.imc(80, 200), 20);
    casi(M.imc(88.5, 185), 25.9, 0.05);
    igual(M.imc(80, 0), null);
    igual(M.categoriaIMC(22)!.clave, "normal");
    igual(M.categoriaIMC(27)!.clave, "sobrepeso");
    igual(M.categoriaIMC(18.4)!.clave, "bajo");
    igual(M.categoriaIMC(25)!.clave, "sobrepeso");
    igual(M.categoriaIMC(41)!.clave, "obesidad3");
    casi(M.ffmi(88.5, 16.7, 185), 21.5, 0.1);
  });
});

describe("Regresión y tendencia", () => {
  it("regresión lineal", () => {
    const recta = M.regresionLineal([{ x: 0, y: 10 }, { x: 1, y: 12 }, { x: 2, y: 14 }, { x: 3, y: 16 }])!;
    casi(recta.pendiente, 2);
    casi(recta.intercepto, 10);
    casi(recta.r2, 1);
    igual(M.regresionLineal([{ x: 1, y: 1 }]), null);
    igual(M.regresionLineal([{ x: 1, y: 1 }, { x: 1, y: 5 }]), null);
  });
  it("tendencia semanal", () => {
    const tend = M.tendenciaSemanal([
      { dia: 0, peso: 90 }, { dia: 1, peso: 89.9 }, { dia: 2, peso: 89.8 }, { dia: 3, peso: 89.7 },
    ])!;
    casi(tend.kgSemana, -0.7, 1e-9);
  });
  it("tendencia robusta e intervalo", () => {
    const pesajesConRuido = [
      { dia: 0, peso: 90 }, { dia: 7, peso: 89.6 }, { dia: 14, peso: 89.2 },
      { dia: 21, peso: 90.1 }, { dia: 28, peso: 88.4 }, { dia: 35, peso: 88.0 },
    ];
    const robusta = M.tendenciaRobustaPeso(pesajesConRuido)!;
    expect(robusta).not.toBeNull();
    expect(robusta.kgSemana).toBeLessThan(-0.25);
    igual(M.tendenciaRobustaPeso([{ dia: 0, peso: 90 }, { dia: 14, peso: 89.5 }]), null);
    const pred = M.prediccionTendenciaPeso(pesajesConRuido, 65)!;
    expect(pred).not.toBeNull();
    expect(pred.minimo).toBeLessThan(pred.peso);
    expect(pred.maximo).toBeGreaterThan(pred.peso);
  });
  it("media móvil", () => {
    const mm = M.mediaMovil([1, 2, 3, 4, 5], 3);
    casi(mm[0], 1);
    casi(mm[1], 1.5);
    casi(mm[2], 2);
    casi(mm[4], 4);
    igual(M.mediaMovil([]).length, 0);
  });
});

describe("TDEE", () => {
  it("observado", () => {
    casi(M.tdeeObservado({ pesoInicial: 90, pesoFinal: 88, dias: 30, kcalMediaConsumida: 2000 }), 2513, 1);
    casi(M.tdeeObservado({ pesoInicial: 90, pesoFinal: 90, dias: 30, kcalMediaConsumida: 2400 }), 2400);
    casi(M.tdeeObservado({ pesoInicial: 89, pesoFinal: 90, dias: 30, kcalMediaConsumida: 2800 }), 2800 - 7700 / 30, 1);
    igual(M.tdeeObservado({ pesoInicial: 90, pesoFinal: 88, dias: 0, kcalMediaConsumida: 2000 }), null);
  });
  it("teórico Mifflin-St Jeor", () => {
    casi(M.metabolismoBasal({ peso: 80, alturaCm: 180, edad: 30, sexo: "hombre" }), 1780);
    casi(M.metabolismoBasal({ peso: 80, alturaCm: 180, edad: 30, sexo: "mujer" }), 1614);
    casi(M.tdeeTeorico({ peso: 80, alturaCm: 180, edad: 30, sexo: "hombre", factorActividad: 1.55 }), Math.round(1780 * 1.55));
  });
});

describe("Adherencia, niveles y rachas", () => {
  it("adherencia y niveles", () => {
    casi(M.adherenciaDia({ a: true, b: true, c: true }, 6), 50);
    casi(M.adherenciaDia({}, 6), 0);
    expect(M.adherenciaDia({ a: true, b: false, c: true as unknown as boolean, d: true }, 4)).toBe(75);
    igual(M.nivelDia({}, 6), 0);
    igual(M.nivelDia({ a: true, b: true, c: true, d: true, e: true, f: true }, 6), 4);
    igual(M.nivelDia({ a: true, b: true, c: true }, 6), 2);
  });
  it("rachas", () => {
    const historial = [
      { fecha: "2026-01-01", cumplidos: 6 },
      { fecha: "2026-01-02", cumplidos: 5 },
      { fecha: "2026-01-03", cumplidos: 2 },
      { fecha: "2026-01-04", cumplidos: 4 },
      { fecha: "2026-01-05", cumplidos: 6 },
    ];
    // La racha en curso solo cuenta si llega hasta hoy (o ayer).
    igual(M.rachaActual(historial, 4, "2026-01-05").longitud, 2);
    igual(M.rachaActual(historial, 4, "2026-01-06").longitud, 2);
    igual(M.rachaActual(historial, 4, "2026-02-01").longitud, 0);

    const mejor = M.mejorRacha(historial, 4);
    igual(mejor.longitud, 2);
    igual(mejor.desde, "2026-01-04");
    igual(mejor.hasta, "2026-01-05");

    igual(M.rachaActual([], 4, "2026-01-05").longitud, 0);
    igual(M.rachaActual(historial, 7, "2026-01-05").longitud, 0);

    // Un hueco sin registrar parte la racha aunque los días sí cumplan.
    const conHueco = [
      { fecha: "2026-03-01", cumplidos: 6 },
      { fecha: "2026-03-02", cumplidos: 6 },
      { fecha: "2026-03-05", cumplidos: 6 },
    ];
    igual(M.mejorRacha(conHueco, 6).longitud, 2);
    igual(M.rachaActual(conHueco, 6, "2026-03-05").longitud, 1);
  });
});

describe("Fechas", () => {
  it("aritmética ISO", () => {
    igual(F.sumarDias("2026-01-31", 1), "2026-02-01");
    igual(F.sumarDias("2026-01-01", -1), "2025-12-31");
    igual(F.sumarDias("2024-02-28", 1), "2024-02-29");
    igual(F.sumarDias("2026-02-28", 1), "2026-03-01");
    igual(F.diasEntre("2026-01-01", "2026-01-31"), 30);
    igual(F.diasEntre("2026-01-31", "2026-01-01"), -30);
    igual(F.limitesMes("2026-04").dias, 30);
    igual(F.limitesMes("2024-02").dias, 29);
    igual(F.diaSemanaLunes("2026-01-01"), 3);
    igual(F.rango("2026-01-01", "2026-01-05").length, 5);
    igual(F.sumarMeses("2026-12", 1), "2027-01");
    igual(F.diaAbsoluto("2026-03-01") - F.diaAbsoluto("2026-02-28"), 1);
  });
});

describe("Energía de un día", () => {
  it("explícito, estimado y mixto", () => {
    const explicito = M.energiaDia({ kcalConsumidas: 1800, kcalQuemadas: 2500, habitos: {} });
    casi(explicito.balance, 500);
    igual(explicito.estimado, true);
    casi(explicito.deltaKg, 500 / 7700, 1e-9);

    const est = M.energiaDia({ habitos: { comida: true, cena: true, noAlcohol: true } }, { kcalObjetivo: 1350 });
    igual(est.estimado, true);
    expect(est.balance).toBeGreaterThan(0);
    const conUnHabito = M.estimarKcalConsumidas({ comida: true }, 2000);
    const conSeisHabitos = M.estimarKcalConsumidas({ comida: true, cena: true, noAlcohol: true, deporte: true, beberAgua: true, dormirBien: true }, 2000);
    expect(conUnHabito.kcal).toBeGreaterThan(conSeisHabitos.kcal);

    const perfilPersonal = M.energiaDia(
      { habitos: { comida: true, cena: true } },
      { kcalObjetivo: 2000, habitosActivos: ["comida"] },
    );
    // Los hábitos no activos se conservan en el histórico, pero no cambian el
    // balance ni la recalibración configurada por la persona.
    expect(perfilPersonal.deficit).toBeGreaterThan(200);

    const seisDeSeis = M.energiaDia(
      { habitos: { comida: true, cena: true, noAlcohol: true, deporte: true, beberAgua: true, dormirBien: true } },
      { kcalObjetivo: 2000, tdeeBase: 3200, habitosActivos: ["comida", "cena", "noAlcohol", "deporte", "beberAgua", "dormirBien"] },
    );
    expect(seisDeSeis.deficit).toBeGreaterThanOrEqual(250);
    expect(seisDeSeis.deficit).toBeLessThanOrEqual(950);

    const mixto = M.energiaDia({ kcalConsumidas: 1500, habitos: { deporte: true } }, { tdeeBase: 2400 });
    igual(mixto.consumidasEstimadas, false);
    igual(mixto.quemadasEstimadas, true);
    casi(mixto.quemadas, 2720);

    const parcial = M.energiaDia({
      kcalConsumidas: 1100,
      habitos: {},
      comidas: [{ tipo: "desayuno" }, { tipo: "comida" }],
    }, { tdeeBase: 2400 });
    igual(parcial.ingestaIncompleta, true);
    igual(parcial.sinHabitosMarcados, true);

    const estadoParcial = estado({
      perfil: {},
      dias: { "2026-08-25": { fecha: "2026-08-25", habitos: {}, kcalConsumidas: 1100, comidas: [{ tipo: "desayuno" }, { tipo: "comida" }] } },
      composicion: [],
    });
    igual(A.diasEvaluables(estadoParcial, "2026-08-25", "2026-08-25").length, 1);
    expect(A.energiaDe(estadoParcial, "2026-08-25").balance).toBeGreaterThan(0);

    const parcialConHabito = estado({
      perfil: { kcalObjetivo: 2000 },
      dias: { "2026-08-25": { fecha: "2026-08-25", habitos: { comida: true }, kcalConsumidas: 1100, comidas: [{ tipo: "desayuno" }, { tipo: "comida" }] } },
      composicion: [],
    });
    const energiaParcialConHabito = A.energiaDe(parcialConHabito, "2026-08-25");
    igual(A.diasEvaluables(parcialConHabito, "2026-08-25", "2026-08-25").length, 1);
    igual(energiaParcialConHabito.ingestaIncompleta, true);
    igual(energiaParcialConHabito.sinHabitosMarcados, false);
    expect(energiaParcialConHabito.consumidas).toBeGreaterThan(1100);

    const completoSinHabitos = M.energiaDia({ kcalConsumidas: 2600, habitos: {}, comidas: [{ tipo: "cena" }] });
    igual(completoSinHabitos.sinHabitosMarcados, true);
  });
  it("detección de días sin registro", () => {
    igual(M.energiaDia({ habitos: {} }).sinRegistro, true);
    igual(M.energiaDia({ habitos: {}, peso: 88 }).sinRegistro, false);
    igual(M.energiaDia({ habitos: { comida: true } }).sinRegistro, false);
    igual(M.energiaDia({ habitos: {}, kcalConsumidas: 1800 }).sinRegistro, false);
  });
});

describe("Calibración personalizada", () => {
  const historico = estado({
    perfil: {
      alturaCm: 185,
      edad: 26,
      sexo: "hombre",
      objetivo: "perder",
      pesoObjetivo: 85,
      kcalObjetivo: 1450,
      factorActividad: 1.55,
      umbralRacha: 4,
      imputarActiva: false,
    },
    dias: Object.fromEntries(SEED_DIAS.map((dia) => [dia.fecha, dia])),
    composicion: SEED_COMPOSICION,
    version: 1,
  });

  it("aprende solo después de varios tramos cerrados", () => {
    const inicial = A.calibracionPersonalizada(historico, "2025-09-22");
    igual(inicial.personalizada, false);
    const completa = A.calibracionPersonalizada(historico);
    igual(completa.personalizada, true);
    igual(completa.calidad, "alta");
    expect(completa.tramos).toBeGreaterThan(25);
    expect(completa.cobertura).toBeGreaterThan(75);
  });

  it("valida cada siguiente pesaje sin usar datos futuros", () => {
    const backtest = A.backtestModelo(historico);
    expect(backtest.tramos).toBeGreaterThan(20);
    expect(backtest.errorPersonalKg).not.toBeNull();
    expect(backtest.errorBaseKg).not.toBeNull();
    expect(backtest.errorPersonalKg!).toBeLessThanOrEqual(backtest.errorBaseKg!);
    expect(backtest.errorPersonalKg!).toBeLessThan(0.7);
    expect(backtest.errorP80Kg).not.toBeNull();
    expect(backtest.errorP80Kg!).toBeGreaterThanOrEqual(backtest.errorPersonalKg!);
  });

  it("mantiene la biología como prior para una persona nueva", () => {
    const hombre = M.energiaDia(
      { habitos: { comida: true, cena: true, noAlcohol: true, deporte: true, beberAgua: true, dormirBien: true } },
      { kcalObjetivo: 1900, tdeeBase: 3000, objetivo: "perder" },
    );
    const mujer = M.energiaDia(
      { habitos: { comida: true, cena: true, noAlcohol: true, deporte: true, beberAgua: true, dormirBien: true } },
      { kcalObjetivo: 1900, tdeeBase: 2250, objetivo: "perder" },
    );
    expect(hombre.deficit).toBeGreaterThan(mujer.deficit);
    expect(hombre.deficit).toBeLessThanOrEqual(950);
    expect(mujer.deficit).toBeGreaterThanOrEqual(250);
  });
});

describe("Imputación y arrastre", () => {
  const HOY = F.hoy();
  const perfilBase = {
    alturaCm: 185, edad: 34, sexo: "hombre", pesoObjetivo: 85,
    kcalObjetivo: 1350, factorActividad: 1.375, umbralRacha: 4,
  };
  const regla = { activa: true, desde: F.sumarDias(HOY, -10), superavitKcal: 500 };

  it("aplica solo a partir de la fecha de corte", () => {
    const dentro = M.energiaDia({ fecha: F.sumarDias(HOY, -5), habitos: {} }, { imputacion: regla });
    igual(dentro.imputado, true);
    casi(dentro.balance, 500);
    casi(dentro.deltaKg, 500 / 7700, 1e-9);

    const fuera = M.energiaDia({ fecha: F.sumarDias(HOY, -30), habitos: {} }, { imputacion: regla });
    igual(fuera.imputado, false);
    igual(fuera.sinRegistro, true);

    const reg = M.energiaDia(
      { fecha: F.sumarDias(HOY, -5), habitos: { comida: true, cena: true, noAlcohol: true } },
      { imputacion: regla },
    );
    igual(reg.imputado, false);
    expect(reg.balance).not.toBe(500);

    igual(
      M.energiaDia({ fecha: F.sumarDias(HOY, -5), habitos: {} }, { imputacion: { ...regla, activa: false } }).imputado,
      false,
    );
  });

  it("arrastre acumulado", () => {
    const conHuecos = estado({
      perfil: { ...perfilBase, imputarActiva: true, imputarDesde: F.sumarDias(HOY, -10), imputarSuperavitKcal: 500 },
      dias: { [F.sumarDias(HOY, -10)]: { fecha: F.sumarDias(HOY, -10), habitos: {}, peso: 90 } },
      composicion: [{ fecha: F.sumarDias(HOY, -10), peso: 90, grasaPct: 20 }],
    });
    const arr = A.arrastre(conHuecos)!;
    igual(arr.diasImputados, 10);
    igual(arr.diasRegistrados, 0);
    casi(arr.balanceTotal, 5000);
    casi(arr.deltaKg, 0.65, 0.01);
    casi(arr.pesoBase, 90);
    casi(arr.pesoEstimado, 90.65, 0.01);

    const r = A.resumen(conHuecos);
    casi(r.prediccion.partida, 90.65, 0.01);
    casi(r.peso.restante, 5.7, 0.15);
    expect(r.energia.balanceMedio!).toBeGreaterThan(400);
    expect(r.energia.balanceMedio!).toBeLessThanOrEqual(500);

    const proy = A.proyeccionPesoConfiable(conHuecos);
    igual(proy.disponible, true);
    casi(proy.hoy!.peso, 90.65, 0.01);
    expect(proy.mes!.margen).toBeGreaterThan(proy.hoy!.margen);
    expect(proy.quincena!.margen).toBeGreaterThan(proy.semana!.margen);
    igual(proy.proximoPesaje, F.sumarDias(HOY, 4));
    igual(r.prediccion.diasObjetivo, null);

    const corregido = estado({
      ...conHuecos,
      dias: {
        ...conHuecos.dias,
        [F.sumarDias(HOY, -5)]: {
          fecha: F.sumarDias(HOY, -5),
          habitos: { comida: true, cena: true, noAlcohol: true, deporte: true },
        },
      },
    });
    const arrC = A.arrastre(corregido)!;
    igual(arrC.diasImputados, 9);
    expect(arrC.balanceTotal).toBeLessThan(arr.balanceTotal);
  });

  it("con la regla desactivada, criterio conservador", () => {
    const sinRegla = estado({
      perfil: { ...perfilBase, imputarActiva: false },
      dias: { [F.sumarDias(HOY, -10)]: { fecha: F.sumarDias(HOY, -10), habitos: {}, peso: 90 } },
      composicion: [],
    });
    const arrSin = A.arrastre(sinRegla)!;
    igual(arrSin.diasImputados, 0);
    casi(arrSin.deltaKg, 0);
    casi(arrSin.pesoEstimado, 90);
    igual(A.balanceMedio(estado({ perfil: { ...perfilBase, imputarActiva: false }, dias: {}, composicion: [] }), 14), null);
  });

  it("dos días 6/6 tras el último pesaje inclinan la predicción a bajada", () => {
    const habitos6 = {
      comida: true,
      cena: true,
      noAlcohol: true,
      deporte: true,
      beberAgua: true,
      dormirBien: true,
    };
    const st = estado({
      perfil: { ...perfilBase, imputarActiva: false },
      dias: {
        [F.sumarDias(HOY, -1)]: { fecha: F.sumarDias(HOY, -1), peso: 95.3, habitos: habitos6 },
        [HOY]: { fecha: HOY, habitos: habitos6 },
      },
      composicion: [],
    });

    const proy = A.proyeccionPesoConfiable(st);
    igual(proy.disponible, true);
    expect(proy.modelo!.kgSemana).toBeLessThan(-0.5);
    expect(proy.semana!.peso).toBeLessThan(proy.hoy!.peso);
  });
});

describe("Integración: resumen sobre estado completo", () => {
  const st = estado({
    perfil: {
      alturaCm: 185, edad: 34, sexo: "hombre", pesoObjetivo: 85, kcalObjetivo: 1350,
      factorActividad: 1.375, umbralRacha: 4, imputarActiva: false,
    },
    dias: {
      "2026-01-01": { fecha: "2026-01-01", habitos: { comida: true, cena: true, noAlcohol: true, deporte: true }, peso: 92 },
      "2026-02-01": { fecha: "2026-02-01", habitos: { comida: true, cena: true }, peso: 90 },
      "2026-03-01": { fecha: "2026-03-01", habitos: { comida: true }, peso: 88.5, kcalConsumidas: 1800, kcalQuemadas: 2600 },
    },
    composicion: [
      { fecha: "2026-01-01", peso: 92, grasaPct: 22 },
      { fecha: "2026-03-01", peso: 88.5, grasaPct: 16.7 },
    ],
  });

  it("resume peso, composición, IMC y tendencia", () => {
    const r = A.resumen(st);
    casi(r.peso.actual, 88.5);
    casi(r.peso.inicial, 92);
    casi(r.peso.totalPerdido, 3.5);
    casi(r.peso.restante, 3.5);
    igual(r.peso.registros, 3);
    casi(r.composicion!.grasaPct, 16.7);
    casi(r.composicion!.grasaKg, 14.78, 0.01);
    casi(r.composicion!.magraKg, 73.72, 0.01);
    expect(r.imc!.valor).toBeGreaterThan(25);
    expect(r.imc!.valor).toBeLessThan(27);
    expect(r.tendencia!.kgSemana).toBeLessThan(0);

    const p = A.pesajes(st);
    igual(p[0].fecha, "2026-01-01");
    igual(p[p.length - 1].fecha, "2026-03-01");

    const vacio = A.resumen(estado({ perfil: st.perfil, dias: {}, composicion: [] }));
    igual(vacio.peso.actual, null);
    igual(vacio.composicion, null);
  });
});
