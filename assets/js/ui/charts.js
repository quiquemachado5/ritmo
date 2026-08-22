/* ============================================================================
   CHARTS — gráficos en SVG generados a mano, sin dependencias.

   Cada función devuelve una cadena de SVG con `viewBox`, de modo que escala
   con el contenedor sin necesidad de recalcular nada al redimensionar.
   ========================================================================= */

import { fechaCorta, n as fmtN, entero, esc } from '../core/format.js';

const escalaLineal = (d0, d1, r0, r1) => (v) => (d1 === d0 ? (r0 + r1) / 2 : r0 + ((v - d0) / (d1 - d0)) * (r1 - r0));

/** Curva de Catmull-Rom convertida a Bézier: suaviza sin inventar extremos. */
function trazoSuave(puntos) {
  if (puntos.length === 0) return '';
  if (puntos.length < 3) return puntos.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ');

  let d = `M${puntos[0].x} ${puntos[0].y}`;
  for (let i = 0; i < puntos.length - 1; i++) {
    const p0 = puntos[i - 1] || puntos[i];
    const p1 = puntos[i];
    const p2 = puntos[i + 1];
    const p3 = puntos[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

function sinDatos(alto, mensaje) {
  return `<div class="empty" style="min-height:${alto}px">
    <div class="empty__icon">◔</div>
    <p>${esc(mensaje)}</p>
  </div>`;
}

/* ------------------------------------------------------ EVOLUCIÓN DE PESO */

/**
 * Gráfico de línea con área degradada, media móvil y línea de objetivo.
 * @param {{puntos:Array, suavizado:Array}} serie
 */
export function graficoPeso(serie, { objetivo = null, alto = 260 } = {}) {
  const puntos = serie.puntos || [];
  if (puntos.length < 2) return sinDatos(alto, 'Registra al menos dos pesajes para ver la evolución.');

  const W = 800;
  const H = alto;
  const M = { top: 18, right: 16, bottom: 26, left: 42 };

  const xs = puntos.map((p) => p.dia);
  const ys = puntos.map((p) => p.peso);
  const valores = objetivo != null ? [...ys, objetivo] : ys;

  const yMin = Math.min(...valores);
  const yMax = Math.max(...valores);
  const margen = Math.max((yMax - yMin) * 0.14, 0.6);

  const x = escalaLineal(Math.min(...xs), Math.max(...xs), M.left, W - M.right);
  const y = escalaLineal(yMin - margen, yMax + margen, H - M.bottom, M.top);

  const coords = puntos.map((p) => ({ x: x(p.dia), y: y(p.peso), d: p }));
  const suaves = (serie.suavizado || []).filter((p) => p.peso != null)
    .map((p) => ({ x: x(p.dia), y: y(p.peso) }));

  const linea = trazoSuave(coords);
  const area = `${linea} L${coords[coords.length - 1].x} ${H - M.bottom} L${coords[0].x} ${H - M.bottom} Z`;

  // Rejilla horizontal con 4 divisiones
  const ticks = 4;
  let rejilla = '';
  for (let i = 0; i <= ticks; i++) {
    const v = yMin - margen + ((yMax + margen - (yMin - margen)) * i) / ticks;
    const py = y(v);
    rejilla += `<line class="grid-line" x1="${M.left}" y1="${py.toFixed(1)}" x2="${W - M.right}" y2="${py.toFixed(1)}"/>
      <text x="${M.left - 8}" y="${(py + 3.5).toFixed(1)}" text-anchor="end">${fmtN(v, 1)}</text>`;
  }

  const lineaObjetivo = objetivo != null
    ? `<line x1="${M.left}" y1="${y(objetivo).toFixed(1)}" x2="${W - M.right}" y2="${y(objetivo).toFixed(1)}"
         stroke="var(--ink-4)" stroke-width="1.5" stroke-dasharray="5 4"/>
       <text x="${W - M.right}" y="${(y(objetivo) - 7).toFixed(1)}" text-anchor="end" fill="var(--ink-4)">objetivo ${fmtN(objetivo, 1)} kg</text>`
    : '';

  const puntosSvg = coords.map((c) => `<circle class="chart__dot" cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="3"
      fill="var(--surface)" stroke="var(--accent)" stroke-width="2">
      <title>${esc(fechaCorta(c.d.fecha))} · ${fmtN(c.d.peso, 1)} kg</title></circle>`).join('');

  const etiquetaIni = fechaCorta(puntos[0].fecha);
  const etiquetaFin = fechaCorta(puntos[puntos.length - 1].fecha);

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img"
      aria-label="Evolución del peso de ${esc(etiquetaIni)} a ${esc(etiquetaFin)}">
    <defs>
      <linearGradient id="gradPeso" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="var(--accent)" stop-opacity="0.16"/>
        <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
      </linearGradient>
    </defs>
    ${rejilla}
    <path class="chart__area--animated" d="${area}" fill="url(#gradPeso)"/>
    ${suaves.length > 2 ? `<path d="${trazoSuave(suaves)}" fill="none" stroke="var(--ink-4)"
        stroke-width="1.5" stroke-dasharray="4 4"/>` : ''}
    <path d="${linea}" fill="none" stroke="var(--accent)" stroke-width="2.25"
      stroke-linecap="round" stroke-linejoin="round"/>
    ${lineaObjetivo}
    ${puntosSvg}
    <text x="${M.left}" y="${H - 7}">${esc(etiquetaIni)}</text>
    <text x="${W - M.right}" y="${H - 7}" text-anchor="end">${esc(etiquetaFin)}</text>
  </svg>`;
}

/* ----------------------------------------------------- BALANCE CALÓRICO */

/** Barras divergentes: déficit hacia abajo en verde, superávit hacia arriba. */
export function graficoBalance(serie, { alto = 190 } = {}) {
  const datos = (serie || []).filter((d) => d.balance !== null);
  if (datos.length === 0) return sinDatos(alto, 'Sin datos de calorías en este periodo.');

  const W = 800;
  const H = alto;
  const M = { top: 16, right: 12, bottom: 24, left: 46 };

  const maxAbs = Math.max(...datos.map((d) => Math.abs(d.balance)), 500);
  const y = escalaLineal(-maxAbs, maxAbs, H - M.bottom, M.top);
  const cero = y(0);

  const ancho = (W - M.left - M.right) / serie.length;
  const barra = Math.max(2, Math.min(ancho - 2.5, 20));

  const barras = serie.map((d, i) => {
    if (d.balance === null) return '';
    const cx = M.left + ancho * i + ancho / 2;
    const py = y(d.balance);
    const alturaBarra = Math.max(2, Math.abs(py - cero));
    const arriba = d.balance > 0;
    const color = arriba ? 'var(--data-flat)' : 'var(--accent)';
    // Los días imputados se rayan para que nunca se confundan con datos reales.
    const relleno = d.imputado ? 'url(#rayado)' : color;
    return `<rect x="${(cx - barra / 2).toFixed(1)}" y="${(arriba ? py : cero).toFixed(1)}"
      width="${barra.toFixed(1)}" height="${alturaBarra.toFixed(1)}" rx="${Math.min(3, barra / 2).toFixed(1)}"
      fill="${relleno}" ${d.imputado ? 'stroke="var(--ink-4)" stroke-width="1"' : 'opacity="0.9"'}>
      <title>${esc(fechaCorta(d.fecha))} · ${d.balance > 0 ? '+' : '−'}${entero(Math.abs(d.balance))} kcal${d.imputado ? ' (día sin registro, imputado)' : ''}</title>
    </rect>`;
  }).join('');

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img"
      aria-label="Balance calórico diario">
    <defs>
      <pattern id="rayado" width="5" height="5" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
        <rect width="5" height="5" fill="var(--surface-2)"/>
        <line x1="0" y1="0" x2="0" y2="5" stroke="var(--ink-4)" stroke-width="2.4"/>
      </pattern>
    </defs>
    <line class="grid-line" x1="${M.left}" y1="${y(maxAbs / 2).toFixed(1)}" x2="${W - M.right}" y2="${y(maxAbs / 2).toFixed(1)}"/>
    <line class="grid-line" x1="${M.left}" y1="${y(-maxAbs / 2).toFixed(1)}" x2="${W - M.right}" y2="${y(-maxAbs / 2).toFixed(1)}"/>
    <text x="${M.left - 8}" y="${(y(maxAbs / 2) + 3.5).toFixed(1)}" text-anchor="end">+${entero(maxAbs / 2)}</text>
    <text x="${M.left - 8}" y="${(y(-maxAbs / 2) + 3.5).toFixed(1)}" text-anchor="end">−${entero(maxAbs / 2)}</text>
    ${barras}
    <line class="axis-line" x1="${M.left}" y1="${cero.toFixed(1)}" x2="${W - M.right}" y2="${cero.toFixed(1)}"/>
    <text x="${M.left}" y="${H - 6}">${esc(fechaCorta(serie[0].fecha))}</text>
    <text x="${W - M.right}" y="${H - 6}" text-anchor="end">${esc(fechaCorta(serie[serie.length - 1].fecha))}</text>
  </svg>`;
}

/* -------------------------------------------------- ANILLO DE COMPOSICIÓN */

/**
 * Anillo doble: arco exterior = grasa, arco interior = masa magra.
 * El texto central muestra el porcentaje de grasa.
 */
export function anilloComposicion({ grasaPct }, { tam = 190 } = {}) {
  const c = tam / 2;
  const rExt = c - 12;
  const rInt = c - 30;
  const circExt = 2 * Math.PI * rExt;
  const circInt = 2 * Math.PI * rInt;

  const fraccionGrasa = Math.max(0, Math.min(1, grasaPct / 100));

  return `<svg class="ring" viewBox="0 0 ${tam} ${tam}" width="${tam}" height="${tam}" role="img"
      aria-label="Composición corporal: ${fmtN(grasaPct, 1)} por ciento de grasa">
    <g transform="rotate(-90 ${c} ${c})">
      <circle class="ring__track" cx="${c}" cy="${c}" r="${rExt}" fill="none" stroke-width="11"/>
      <circle class="ring__arc" cx="${c}" cy="${c}" r="${rExt}" fill="none" stroke="var(--accent)"
        stroke-width="11" stroke-linecap="round"
        stroke-dasharray="${circExt.toFixed(1)}"
        stroke-dashoffset="${(circExt * (1 - fraccionGrasa)).toFixed(1)}"/>
      <circle class="ring__track" cx="${c}" cy="${c}" r="${rInt}" fill="none" stroke-width="9"/>
      <circle class="ring__arc" cx="${c}" cy="${c}" r="${rInt}" fill="none" stroke="var(--accent-soft)"
        stroke-width="9" stroke-linecap="round"
        stroke-dasharray="${circInt.toFixed(1)}"
        stroke-dashoffset="${(circInt * fraccionGrasa).toFixed(1)}"/>
    </g>
    <text x="${c}" y="${c + 4}" text-anchor="middle" fill="var(--ink)"
      style="font-size:30px;font-weight:700;letter-spacing:-1.4px">${fmtN(grasaPct, 1)}%</text>
    <text x="${c}" y="${c + 23}" text-anchor="middle" style="font-size:9px;letter-spacing:1.3px">GRASA</text>
  </svg>`;
}

/* ---------------------------------------------------------- SPARKLINE */

/** Miniatura de tendencia para las celdas pequeñas. */
export function sparkline(valores, { color = 'var(--accent)', ancho = 120, alto = 32 } = {}) {
  const vals = (valores || []).filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (vals.length < 2) return '';

  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const x = escalaLineal(0, vals.length - 1, 1, ancho - 1);
  const y = escalaLineal(min, max, alto - 3, 3);
  const d = trazoSuave(vals.map((v, i) => ({ x: x(i), y: y(v) })));

  return `<svg class="chart" viewBox="0 0 ${ancho} ${alto}" width="${ancho}" height="${alto}"
      preserveAspectRatio="none" aria-hidden="true">
    <path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" opacity="0.9"/>
  </svg>`;
}
