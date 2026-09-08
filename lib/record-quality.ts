import type { Comida } from "./model/types";

export type RecordQualityLevel = "alta" | "media" | "baja" | "sin-datos";

export function qualityForDay(comidas: Comida[], habitosHechos: number, totalHabitos: number): { level: RecordQualityLevel; detail: string } {
  const aproximadas = comidas.filter((comida) => comida.estimado || comida.fuente === "offline").length;
  const señales = (comidas.length > 0 ? 1 : 0) + (habitosHechos > 0 ? 1 : 0);
  if (señales === 0) return { level: "sin-datos", detail: "Siguiente dato útil: marca el primer hábito de hoy." };
  if (señales === 2 && habitosHechos >= Math.ceil(totalHabitos * 0.66) && aproximadas === 0) return { level: "alta", detail: `${habitosHechos}/${totalHabitos} hábitos y ${comidas.length} comida${comidas.length === 1 ? "" : "s"} revisada${comidas.length === 1 ? "" : "s"}; el siguiente pesaje será lo que más afine el modelo.` };
  if (señales === 2 || (comidas.length > 0 && aproximadas < comidas.length)) return { level: "media", detail: `Siguiente dato útil: confirma cantidades en ${aproximadas || "las"} comida${aproximadas === 1 ? "" : "s"} estimada${aproximadas === 1 ? "" : "s"}.` };
  return { level: "baja", detail: comidas.length > 0 ? "Siguiente dato útil: revisa los hábitos de hoy." : "Siguiente dato útil: añade una comida si quieres afinar kcal y macros." };
}
