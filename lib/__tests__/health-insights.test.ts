import { describe, expect, it } from "vitest";
import { PERFIL_DEFECTO } from "../model/config";
import { healthWindow } from "../health-insights";

describe("historial de actividad y descanso", () => {
  it("resume solo métricas presentes sin convertir ausencias en ceros", () => {
    const summary = healthWindow({
      perfil: PERFIL_DEFECTO,
      composicion: [],
      dias: {
        "2026-09-14": { fecha: "2026-09-14", habitos: {}, pasos: 8_000, suenoMinutos: 420, entrenamientoMinutos: 30 },
        "2026-09-15": { fecha: "2026-09-15", habitos: {}, pasos: 10_000, suenoMinutos: 480 },
      },
    }, 7, "2026-09-15");

    expect(summary).toMatchObject({
      days: 7,
      coveredDays: 2,
      steps: { days: 2, average: 9_000, total: 18_000 },
      sleep: { days: 2, averageMinutes: 450 },
      workout: { days: 1, totalMinutes: 30, averageMinutes: 30 },
    });
    expect(summary.points).toHaveLength(7);
    expect(summary.points[0]).toMatchObject({ steps: null, sleepMinutes: null, workoutMinutes: null });
  });
});
