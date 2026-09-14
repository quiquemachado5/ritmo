import { describe, expect, it } from "vitest";
import { eventosDeNota, mapaAsociacionesHabitos, memoriaEventosContexto } from "../personal-patterns";
import type { Estado } from "../types";

const perfil: Estado["perfil"] = { alturaCm: 180, edad: 30, sexo: "hombre", kcalObjetivo: 2_000, factorActividad: 1.4, umbralRacha: 4 };

describe("patrones personales", () => {
  it("reconoce contexto escrito con acentos y texto adicional", () => {
    expect(eventosDeNota("Viaje · Entrenamiento especial por la mañana")).toEqual(["viaje", "entrenamiento-especial"]);
    expect(eventosDeNota("Cené tarde, dormí poco y fue una comida muy salada")).toEqual(["comida-salada", "cena-tardia", "poco-sueno"]);
  });

  it("ordena hábitos por su asociación observada con el pesaje siguiente", () => {
    const dias: Estado["dias"] = {};
    let peso = 90;
    for (let i = 1; i <= 9; i++) {
      const fecha = `2026-09-${String(i).padStart(2, "0")}`;
      const cumple = i % 2 === 1;
      dias[fecha] = { fecha, peso, habitos: { noAlcohol: true, deporte: cumple } };
      peso += cumple ? -0.2 : 0.25;
    }
    const mapa = mapaAsociacionesHabitos({ perfil, dias, composicion: [] });
    expect(mapa.find((item) => item.clave === "deporte")?.efectoKg).toBeLessThan(0);
  });

  it("mantiene los eventos en modo aprendizaje hasta reunir controles", () => {
    const estado: Estado = { perfil, composicion: [], dias: { "2026-09-01": { fecha: "2026-09-01", peso: 90, habitos: { noAlcohol: true }, notas: "Enfermedad" } } };
    expect(memoriaEventosContexto(estado)[0]).toMatchObject({ id: "enfermedad", personalizada: false, confianza: "inicial" });
  });
});
