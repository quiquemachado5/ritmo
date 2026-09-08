import type { Perfil } from "./types";

export const KCAL_POR_KG_GRASA = 9_500;
export const KCAL_POR_KG_MAGRA = 1_800;

export interface ComposicionDinamica {
  peso: number;
  grasaKg: number;
  magraKg: number;
  grasaPct: number;
  particionGrasa: number;
  factorAdaptacion: number;
  diasDeficit: number;
  fuenteGrasa: "medida" | "estimada";
}

function limitar(valor: number, minimo: number, maximo: number) {
  return Math.max(minimo, Math.min(maximo, valor));
}

/**
 * Fracción energética almacenada o movilizada como grasa. Se parte de la
 * relación de Forbes dFFM/dFM = 10,4/FM usada por el modelo simplificado de
 * Hall y se limita al rango prudente de RITMO para datos de vida real.
 */
export function particionEnergeticaGrasa(grasaKg: number): number {
  const grasa = limitar(grasaKg, 2, 150);
  const relacionMagraGrasa = 10.4 / grasa;
  return limitar(
    KCAL_POR_KG_GRASA / (KCAL_POR_KG_GRASA + KCAL_POR_KG_MAGRA * relacionMagraGrasa),
    0.6,
    0.85,
  );
}

export function densidadEnergeticaEfectiva(particionGrasa: number): number {
  const p = limitar(particionGrasa, 0.6, 0.85);
  return 1 / (p / KCAL_POR_KG_GRASA + (1 - p) / KCAL_POR_KG_MAGRA);
}

/** Estimación antropométrica de respaldo; una medición real siempre prevalece. */
export function estimarGrasaCorporal(perfil: Pick<Perfil, "alturaCm" | "edad" | "sexo">, peso: number): number {
  const alturaM = perfil.alturaCm / 100;
  const imc = alturaM > 0 ? peso / (alturaM * alturaM) : 25;
  const sexo = perfil.sexo === "hombre" ? 1 : 0;
  const estimada = 1.2 * imc + 0.23 * perfil.edad - 10.8 * sexo - 5.4;
  return limitar(estimada, perfil.sexo === "hombre" ? 5 : 12, 60);
}

/** La adaptación aparece gradualmente y se limita a una reducción del 8 %. */
export function factorAdaptacionMetabolica(diasDeficit: number): number {
  const dias = Math.max(0, diasDeficit);
  return Math.max(0.92, 1 - 0.08 * (1 - Math.exp(-dias / 21)));
}

export function composicionInicial(
  peso: number,
  perfil: Pick<Perfil, "alturaCm" | "edad" | "sexo">,
  grasaPctMedida?: number | null,
  diasDeficit = 0,
): ComposicionDinamica {
  const medidaValida = Number.isFinite(grasaPctMedida) && (grasaPctMedida as number) >= 3 && (grasaPctMedida as number) <= 65;
  const grasaPct = medidaValida ? grasaPctMedida as number : estimarGrasaCorporal(perfil, peso);
  const grasaKg = peso * grasaPct / 100;
  return {
    peso,
    grasaKg,
    magraKg: peso - grasaKg,
    grasaPct,
    particionGrasa: particionEnergeticaGrasa(grasaKg),
    factorAdaptacion: factorAdaptacionMetabolica(diasDeficit),
    diasDeficit,
    fuenteGrasa: medidaValida ? "medida" : "estimada",
  };
}

/**
 * Avanza un día. RITMO usa balance negativo para déficit y positivo para
 * superávit; así ambas masas bajan cuando existe déficit.
 */
export function avanzarComposicion(
  anterior: ComposicionDinamica,
  balanceDiario: number,
  tdee: number,
): ComposicionDinamica {
  const diasDeficit = balanceDiario < -50
    ? anterior.diasDeficit + 1
    : Math.max(0, anterior.diasDeficit - (balanceDiario > 100 ? 2 : 1));
  const factorAdaptacion = factorAdaptacionMetabolica(diasDeficit);
  // Al bajar el gasto, un déficit se hace menor; nunca se convierte en
  // superávit únicamente por esta corrección del modelo.
  const balanceAdaptado = balanceDiario < 0
    ? Math.min(0, balanceDiario + Math.max(0, tdee) * (1 - factorAdaptacion))
    : balanceDiario;
  const particionGrasa = particionEnergeticaGrasa(anterior.grasaKg);
  const deltaGrasa = particionGrasa * balanceAdaptado / KCAL_POR_KG_GRASA;
  const deltaMagra = (1 - particionGrasa) * balanceAdaptado / KCAL_POR_KG_MAGRA;
  const grasaKg = Math.max(1, anterior.grasaKg + deltaGrasa);
  const magraKg = Math.max(15, anterior.magraKg + deltaMagra);
  const peso = grasaKg + magraKg;
  return {
    peso,
    grasaKg,
    magraKg,
    grasaPct: grasaKg / peso * 100,
    particionGrasa,
    factorAdaptacion,
    diasDeficit,
    fuenteGrasa: anterior.fuenteGrasa,
  };
}

export function proyectarComposicion(
  inicial: ComposicionDinamica,
  balanceDiario: number,
  tdee: number,
  dias: number,
): ComposicionDinamica {
  let actual = { ...inicial };
  for (let dia = 0; dia < Math.max(0, Math.round(dias)); dia++) {
    actual = avanzarComposicion(actual, balanceDiario, tdee);
  }
  return actual;
}

/** Redistribuye una corrección de báscula/tendencia sin romper FM + FFM. */
export function ajustarComposicionAPeso(
  anterior: ComposicionDinamica,
  pesoObjetivo: number,
): ComposicionDinamica {
  if (!Number.isFinite(pesoObjetivo) || pesoObjetivo <= 20) return anterior;
  const diferencia = pesoObjetivo - anterior.peso;
  const p = particionEnergeticaGrasa(anterior.grasaKg);
  const energiaEquivalente = diferencia * densidadEnergeticaEfectiva(p);
  const grasaKg = Math.max(1, anterior.grasaKg + p * energiaEquivalente / KCAL_POR_KG_GRASA);
  const magraKg = Math.max(15, anterior.magraKg + (1 - p) * energiaEquivalente / KCAL_POR_KG_MAGRA);
  const peso = grasaKg + magraKg;
  return {
    ...anterior,
    peso,
    grasaKg,
    magraKg,
    grasaPct: grasaKg / peso * 100,
    particionGrasa: p,
  };
}
