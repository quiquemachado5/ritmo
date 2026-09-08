import { habitosModelo } from "./config";
import type { Estado } from "./types";

type QuickTab = "comida" | "peso" | "habitos";

export interface SiguienteAccion {
  tab: QuickTab;
  etiqueta: string;
  detalle: string;
  corta: string;
}

/** Decide qué registro desbloquea más información sin inventar datos. */
export function siguienteAccion(estado: Estado, fecha: string): SiguienteAccion {
  const dia = estado.dias[fecha];
  const tienePeso = estado.composicion.length > 0 || Object.values(estado.dias).some((item) => item.peso != null);
  if (!tienePeso) {
    return { tab: "peso", etiqueta: "Añade tu primer peso", detalle: "Activa tu tendencia y la predicción", corta: "Peso" };
  }

  const habitos = habitosModelo(estado.perfil);
  const hechos = habitos.filter((habito) => dia?.habitos?.[habito.clave]).length;
  if (hechos < habitos.length) {
    return {
      tab: "habitos",
      etiqueta: hechos === 0 ? "Empieza el día" : "Completa tus hábitos",
      detalle: `${hechos}/${habitos.length} hábitos hoy`,
      corta: `${hechos}/${habitos.length}`,
    };
  }

  if (!(dia?.comidas?.length)) {
    return { tab: "comida", etiqueta: "Añade una comida", detalle: "Mejora el análisis nutricional", corta: "Comida" };
  }

  if (dia?.peso == null) {
    return { tab: "peso", etiqueta: "Registra tu peso", detalle: "Recalibra el modelo de hoy", corta: "Peso" };
  }

  return { tab: "comida", etiqueta: "Añade otro registro", detalle: "Tu día ya tiene una base completa", corta: "Listo" };
}
