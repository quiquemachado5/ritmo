import { describe, expect, it } from "vitest";
import {
  avanzarComposicion,
  ajustarComposicionAPeso,
  composicionInicial,
  factorAdaptacionMetabolica,
  particionEnergeticaGrasa,
  proyectarComposicion,
} from "../body-composition";

const perfil = { alturaCm: 185, edad: 30, sexo: "hombre" as const };

describe("modelo dinámico de composición corporal", () => {
  it("ancla una medición real y separa grasa de masa libre de grasa", () => {
    const estado = composicionInicial(100, perfil, 25);
    expect(estado.fuenteGrasa).toBe("medida");
    expect(estado.grasaKg).toBeCloseTo(25);
    expect(estado.magraKg).toBeCloseTo(75);
    expect(estado.peso).toBeCloseTo(estado.grasaKg + estado.magraKg);
  });

  it("usa un respaldo antropométrico cuando no hay porcentaje medido", () => {
    const estado = composicionInicial(90, perfil);
    expect(estado.fuenteGrasa).toBe("estimada");
    expect(estado.grasaPct).toBeGreaterThan(5);
    expect(estado.grasaPct).toBeLessThan(60);
  });

  it("un déficit reduce ambas masas y un superávit las incrementa", () => {
    const inicial = composicionInicial(100, perfil, 25);
    const deficit = avanzarComposicion(inicial, -700, 2_700);
    const superavit = avanzarComposicion(inicial, 500, 2_700);
    expect(deficit.grasaKg).toBeLessThan(inicial.grasaKg);
    expect(deficit.magraKg).toBeLessThan(inicial.magraKg);
    expect(superavit.grasaKg).toBeGreaterThan(inicial.grasaKg);
    expect(superavit.magraKg).toBeGreaterThan(inicial.magraKg);
  });

  it("asigna mayor fracción energética a grasa cuando hay más masa grasa", () => {
    expect(particionEnergeticaGrasa(30)).toBeGreaterThan(particionEnergeticaGrasa(8));
  });

  it("introduce adaptación gradual sin bajar del límite prudente", () => {
    expect(factorAdaptacionMetabolica(0)).toBe(1);
    expect(factorAdaptacionMetabolica(21)).toBeLessThan(0.96);
    expect(factorAdaptacionMetabolica(365)).toBeGreaterThanOrEqual(0.92);
    const adaptada = proyectarComposicion(composicionInicial(100, perfil, 25), -700, 2_700, 42);
    expect(adaptada.factorAdaptacion).toBeLessThan(0.95);
    expect(adaptada.peso).toBeLessThan(100);
  });

  it("recalibra contra una báscula sin romper la suma de masas", () => {
    const inicial = proyectarComposicion(composicionInicial(100, perfil, 25), -500, 2_700, 14);
    const ajustada = ajustarComposicionAPeso(inicial, 98.7);
    expect(ajustada.peso).toBeCloseTo(98.7, 8);
    expect(ajustada.grasaKg + ajustada.magraKg).toBeCloseTo(ajustada.peso, 8);
  });
});
