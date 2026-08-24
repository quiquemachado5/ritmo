/* ============================================================================
   DATES — utilidades de fecha.

   Toda la aplicación identifica un día por su cadena ISO local 'YYYY-MM-DD'.
   Nunca se usa `new Date(iso)` a secas para reconstruirla, porque el parser
   trata 'YYYY-MM-DD' como UTC y desplaza el día en husos negativos.
   ========================================================================= */

const MS_DIA = 86_400_000;

/** Fecha local → 'YYYY-MM-DD'. */
export function aISO(fecha = new Date()) {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/** 'YYYY-MM-DD' → Date local a medianoche. */
export function desdeISO(iso) {
  const [a, m, d] = String(iso).split('-').map(Number);
  return new Date(a, (m || 1) - 1, d || 1);
}

/** ISO del día de hoy. */
export function hoy() {
  return aISO(new Date());
}

/** Suma (o resta) días a un ISO y devuelve el ISO resultante. */
export function sumarDias(iso, dias) {
  const d = desdeISO(iso);
  d.setDate(d.getDate() + dias);
  return aISO(d);
}

/** Días entre dos ISO (b − a). Positivo si `b` es posterior. */
export function diasEntre(isoA, isoB) {
  const a = desdeISO(isoA).getTime();
  const b = desdeISO(isoB).getTime();
  return Math.round((b - a) / MS_DIA);
}

/**
 * Número de día absoluto desde una época fija. Es la coordenada X que usan la
 * regresión y los gráficos, para que el eje temporal sea uniforme aunque
 * falten días en el historial.
 */
export function diaAbsoluto(iso) {
  return Math.round(desdeISO(iso).getTime() / MS_DIA);
}

/** Lista de ISO desde `desde` hasta `hasta`, ambos incluidos. */
export function rango(desde, hasta) {
  const salida = [];
  let cursor = desde;
  let guarda = 0;
  while (cursor <= hasta && guarda++ < 20_000) {
    salida.push(cursor);
    cursor = sumarDias(cursor, 1);
  }
  return salida;
}

/** Clave de mes 'YYYY-MM' a partir de un ISO. */
export function claveMes(iso) {
  return String(iso).slice(0, 7);
}

/** Primer y último día de un mes 'YYYY-MM'. */
export function limitesMes(clave) {
  const [a, m] = clave.split('-').map(Number);
  const primero = new Date(a, m - 1, 1);
  const ultimo = new Date(a, m, 0);
  return { desde: aISO(primero), hasta: aISO(ultimo), dias: ultimo.getDate() };
}

/** Índice de día de la semana con lunes = 0. */
export function diaSemanaLunes(iso) {
  return (desdeISO(iso).getDay() + 6) % 7;
}

export const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/** Añade meses a una clave 'YYYY-MM'. */
export function sumarMeses(clave, n) {
  const [a, m] = clave.split('-').map(Number);
  const d = new Date(a, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
