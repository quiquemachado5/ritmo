/* ============================================================================
   FORMAT — presentación de números y fechas en español.
   ========================================================================= */

import { desdeISO } from './dates.js';

const LOCALE = 'es-ES';

const fmtCache = new Map();
function decimales(min, max) {
  const clave = `${min}:${max}`;
  if (!fmtCache.has(clave)) {
    fmtCache.set(clave, new Intl.NumberFormat(LOCALE, {
      minimumFractionDigits: min,
      maximumFractionDigits: max,
    }));
  }
  return fmtCache.get(clave);
}

const PLACEHOLDER = '—';

function esNulo(v) {
  return v === null || v === undefined || (typeof v === 'number' && !Number.isFinite(v));
}

/** Número con N decimales fijos. */
export function n(valor, dec = 1) {
  if (esNulo(valor)) return PLACEHOLDER;
  return decimales(dec, dec).format(valor);
}

/** Entero con separador de millares. */
export function entero(valor) {
  if (esNulo(valor)) return PLACEHOLDER;
  return decimales(0, 0).format(Math.round(valor));
}

/** Kilos con un decimal. */
export function kg(valor, dec = 1) {
  return esNulo(valor) ? PLACEHOLDER : n(valor, dec);
}

/** Porcentaje con un decimal y símbolo. */
export function pct(valor, dec = 1) {
  return esNulo(valor) ? PLACEHOLDER : `${n(valor, dec)} %`;
}

/** Número con signo explícito (+ / −). Útil para deltas y balances. */
export function conSigno(valor, dec = 0) {
  if (esNulo(valor)) return PLACEHOLDER;
  const signo = valor > 0 ? '+' : valor < 0 ? '−' : '';
  return `${signo}${n(Math.abs(valor), dec)}`;
}

/** Calorías con signo, para balances. */
export function kcalConSigno(valor) {
  if (esNulo(valor)) return PLACEHOLDER;
  const signo = valor > 0 ? '+' : valor < 0 ? '−' : '';
  return `${signo}${entero(Math.abs(valor))} kcal`;
}

/** 'YYYY-MM-DD' → '12 jul 2026'. */
export function fechaCorta(iso) {
  if (!iso) return PLACEHOLDER;
  return desdeISO(iso).toLocaleDateString(LOCALE, {
    day: 'numeric', month: 'short', year: 'numeric',
  }).replace('.', '');
}

/** 'YYYY-MM-DD' → 'domingo, 12 de julio'. */
export function fechaLarga(iso) {
  if (!iso) return PLACEHOLDER;
  return desdeISO(iso).toLocaleDateString(LOCALE, {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

/** 'YYYY-MM' → 'julio 2026'. */
export function mesLargo(clave) {
  const [a, m] = String(clave).split('-').map(Number);
  return new Date(a, m - 1, 1).toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' });
}

/** Número de días → texto legible ('3 semanas', '2 meses'). */
export function duracion(dias) {
  if (esNulo(dias) || dias <= 0) return PLACEHOLDER;
  const d = Math.round(dias);
  if (d < 14) return `${d} ${d === 1 ? 'día' : 'días'}`;
  if (d < 60) {
    const s = Math.round(d / 7);
    return `${s} ${s === 1 ? 'semana' : 'semanas'}`;
  }
  const m = Math.round(d / 30.44);
  if (m < 24) return `${m} ${m === 1 ? 'mes' : 'meses'}`;
  return `${(d / 365.25).toFixed(1).replace('.', ',')} años`;
}

/** Escapa texto antes de inyectarlo en HTML. */
export function esc(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
