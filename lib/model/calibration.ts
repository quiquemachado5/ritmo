/* ============================================================================
   CALIBRACIÓN HISTÓRICA RITMO

   Tabla robusta ajustada contra el seed septiembre 2025 → julio 2026. Cada
   tramo entre dos pesajes se tradujo a balance kcal/día y se ajustó por nivel
   de hábitos, recortando extremos de agua/glucógeno de tramos muy cortos.
   Signo: positivo = superávit, negativo = déficit.
   ========================================================================= */

export const BALANCE_HABITOS_KCAL = [850, 650, 350, 100, -150, -550, -950] as const;

export function balanceCalibradoPorHabitos(cumplidos: number, total: number): number {
  const max = BALANCE_HABITOS_KCAL.length - 1;
  const ratio = total > 0 ? Math.max(0, Math.min(1, cumplidos / total)) : 0;
  const pos = ratio * max;
  const bajo = Math.floor(pos);
  const alto = Math.ceil(pos);
  if (bajo === alto) return BALANCE_HABITOS_KCAL[bajo];
  const t = pos - bajo;
  return Math.round(BALANCE_HABITOS_KCAL[bajo] * (1 - t) + BALANCE_HABITOS_KCAL[alto] * t);
}
