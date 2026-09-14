import { REFERENCE_MEALS, type ReferenceMeal } from "./reference-meals";

type WordingVariant = { id: string; apply: (text: string) => string };

const WORDING_VARIANTS: WordingVariant[] = [
  { id: "base", apply: (text) => text },
  { id: "voz", apply: (text) => `He comido ${text}.` },
  { id: "plato", apply: (text) => `Mi plato lleva ${text}.` },
  { id: "minusculas", apply: (text) => text.toLocaleLowerCase("es-ES") },
  { id: "pausas", apply: (text) => text.replaceAll(",", ";") },
  { id: "aceite", apply: (text) => text.replaceAll("AOVE", "aceite de oliva virgen extra") },
];

/**
 * 72 casos: doce platos complejos y seis formas habituales de dictarlos.
 * No multiplica artificialmente alimentos; verifica que puntuación, voz y
 * sinónimos no cambien el cálculo de una misma receta.
 */
export const NUTRITION_REFERENCE_SUITE: ReferenceMeal[] = REFERENCE_MEALS.flatMap((meal) =>
  WORDING_VARIANTS.map((variant) => ({
    ...meal,
    id: `${meal.id}--${variant.id}`,
    texto: variant.apply(meal.texto),
  })),
);
