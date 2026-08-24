/* Presentación en español. Cifras con coma decimal y separador de miles. */

const nf = (min: number, max: number) =>
  new Intl.NumberFormat("es-ES", { minimumFractionDigits: min, maximumFractionDigits: max });

export function fmtPeso(kg: number | null | undefined, dec = 1): string {
  if (kg == null || !Number.isFinite(kg)) return "—";
  return nf(dec, dec).format(kg);
}

export function fmtKcal(kcal: number | null | undefined): string {
  if (kcal == null || !Number.isFinite(kcal)) return "—";
  return nf(0, 0).format(Math.round(kcal));
}

export function fmtNum(n: number | null | undefined, dec = 0): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return nf(0, dec).format(n);
}

export function fmtSigno(n: number | null | undefined, dec = 1): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const s = nf(dec, dec).format(Math.abs(n));
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${s}`;
}

const FECHA_LARGA = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" });
const FECHA_CORTA = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" });
const FECHA_MES = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" });

function desdeISO(iso: string): Date {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, (m || 1) - 1, d || 1);
}

export function fmtFechaLarga(iso: string): string {
  return FECHA_LARGA.format(desdeISO(iso));
}
export function fmtFechaCorta(iso: string): string {
  return FECHA_CORTA.format(desdeISO(iso));
}
export function fmtMes(iso: string): string {
  return FECHA_MES.format(desdeISO(iso));
}

export function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "hace 3 días", "hoy", "ayer" a partir de un ISO. */
export function relativo(iso: string, hoyISO: string): string {
  const a = desdeISO(iso).getTime();
  const b = desdeISO(hoyISO).getTime();
  const dias = Math.round((b - a) / 86_400_000);
  if (dias === 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 0) return `en ${Math.abs(dias)} días`;
  if (dias < 7) return `hace ${dias} días`;
  if (dias < 30) return `hace ${Math.round(dias / 7)} sem`;
  return `hace ${Math.round(dias / 30)} meses`;
}
