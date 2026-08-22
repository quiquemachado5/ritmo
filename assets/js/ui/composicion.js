/* ============================================================================
   CUERPO — composición corporal.

     1. Actual     ·  de qué está hecho tu peso ahora
     2. Progreso   ·  qué has perdido y de dónde
     3. Medición   ·  alta y edición
     4. Histórico  ·  curvas y tabla
   ========================================================================= */

import * as M from '../core/metrics.js';
import * as A from '../core/analytics.js';
import { anilloComposicion, graficoPeso } from './charts.js';
import { hoy, diaAbsoluto } from '../core/dates.js';
import { kg, pct, entero, conSigno, fechaCorta, n, esc } from '../core/format.js';

/** Campos de la báscula: clave, etiqueta, unidad y límites admitidos. */
const CAMPOS = [
  { clave: 'peso',            etiqueta: 'Peso',     unidad: 'kg',    paso: 0.1, min: 25,  max: 400, requerido: true },
  { clave: 'grasaPct',        etiqueta: 'Grasa',    unidad: '%',     paso: 0.1, min: 2,   max: 70 },
  { clave: 'masaMuscularKg',  etiqueta: 'Músculo',  unidad: 'kg',    paso: 0.1, min: 10,  max: 200 },
  { clave: 'aguaPct',         etiqueta: 'Agua',     unidad: '%',     paso: 0.1, min: 20,  max: 80 },
  { clave: 'masaOseaKg',      etiqueta: 'Hueso',    unidad: 'kg',    paso: 0.1, min: 1,   max: 10 },
  { clave: 'grasaVisceral',   etiqueta: 'Visceral', unidad: 'nivel', paso: 1,   min: 1,   max: 30 },
  { clave: 'metabBasalKcal',  etiqueta: 'Basal',    unidad: 'kcal',  paso: 10,  min: 800, max: 4000 },
  { clave: 'gastoDiarioKcal', etiqueta: 'Gasto',    unidad: 'kcal',  paso: 10,  min: 900, max: 8000 },
];

const vista = { fecha: hoy() };

const seccion = (titulo, meta, contenido) => `
  <section class="section">
    <header class="section__head">
      <h2 class="section__title">${esc(titulo)}</h2>
      ${meta ? `<span class="section__meta">${esc(meta)}</span>` : ''}
    </header>
    <div class="grid">${contenido}</div>
  </section>`;

const dato = (clave, valor, sub = '', clase = '') => `
  <div class="stat">
    <div class="stat__k">${esc(clave)}</div>
    <div class="stat__v ${clase}">${valor}</div>
    ${sub ? `<div class="stat__s">${sub}</div>` : ''}
  </div>`;

/* ------------------------------------------------------------- 1. ACTUAL */

function seccionActual(estado) {
  const c = A.ultimaComposicion(estado);
  if (!c) {
    return seccion('Actual', '', `<article class="card w-12">
      <div class="empty">
        <div class="empty__icon">◍</div>
        <p class="empty__title">Sin mediciones</p>
        <p>Añade peso y % de grasa para desglosar tu composición.</p>
      </div>
    </article>`);
  }

  const perfil = estado.perfil || {};
  // La composición solo se presenta cuando se ha medido. Repartir kilos
  // estimados entre grasa y masa magra sería una falsa precisión.
  const usar = M.composicion(c.peso, c.grasaPct);
  const rango = M.rangoGrasa(perfil.sexo);
  const enRango = usar.grasaPct >= rango.min && usar.grasaPct <= rango.max;
  const imcValor = M.imc(usar.pesoKg, perfil.alturaCm);

  return seccion('Actual', fechaCorta(c.fecha), `
    <article class="card w-5">
      ${anilloComposicion(usar, { tam: 200 })}
      <div class="split" style="margin-top:16px">
        <div class="split__seg" style="width:${usar.grasaPct}%;background:var(--accent)"></div>
        <div class="split__seg" style="width:${usar.magraPct}%;background:var(--accent-soft)"></div>
      </div>
      <div class="legend" style="margin-top:10px;justify-content:center">
        <span class="legend__item"><span class="legend__swatch" style="background:var(--accent)"></span>Grasa</span>
        <span class="legend__item"><span class="legend__swatch" style="background:var(--accent-soft)"></span>Magra</span>
      </div>
    </article>

    <article class="card w-7">
      <div class="zone">
        <div class="stats">
          ${dato('Masa grasa', `${kg(usar.grasaKg)} <small>kg</small>`, pct(usar.grasaPct), 'is-warn')}
          ${dato('Masa magra', `${kg(usar.magraKg)} <small>kg</small>`, pct(usar.magraPct), 'is-accent')}
          ${dato('IMC', n(imcValor, 1), (M.categoriaIMC(imcValor) || {}).etiqueta || '')}
          ${dato('FFMI', n(M.ffmi(usar.pesoKg, usar.grasaPct, perfil.alturaCm), 1))}
        </div>
      </div>
      <div class="zone">
        <div class="stats stats--3">
          ${dato('Agua', M.num(c.aguaPct) !== null ? pct(c.aguaPct) : '—')}
          ${dato('Visceral', M.num(c.grasaVisceral) !== null ? entero(c.grasaVisceral) : '—')}
          ${dato('Basal', M.num(c.metabBasalKcal) !== null ? `${entero(c.metabBasalKcal)} <small>kcal</small>` : '—')}
        </div>
      </div>
      <div class="zone">
        <div class="facts">
          <span class="chip ${enRango ? 'chip--pos' : 'chip--warn'}">Rango ${rango.min}–${rango.max} %</span>
          <span>Última medición <b>${esc(fechaCorta(c.fecha))}</b></span>
        </div>
      </div>
    </article>`);
}

/* ----------------------------------------------------------- 2. PROGRESO */

function seccionProgreso(estado) {
  const completas = (estado.composicion || [])
    .filter((c) => M.num(c.peso) !== null && M.num(c.grasaPct) !== null)
    .sort((a, b) => (a.fecha < b.fecha ? -1 : 1));

  if (completas.length < 2) return '';

  const ini = completas[0];
  const fin = completas[completas.length - 1];
  const a = M.composicion(ini.peso, ini.grasaPct);
  const b = M.composicion(fin.peso, fin.grasaPct);

  const dPeso = b.pesoKg - a.pesoKg;
  const dGrasa = b.grasaKg - a.grasaKg;
  const dMagra = b.magraKg - a.magraKg;
  const dPct = b.grasaPct - a.grasaPct;

  // Qué parte de lo perdido era grasa. Por encima del 75 % es una buena pérdida.
  const calidad = dPeso < 0 ? Math.max(0, Math.min(100, (dGrasa / dPeso) * 100)) : null;

  const tono = (valor, mejorSiBaja = true) => {
    if (Math.abs(valor) < 0.05) return '';
    return (mejorSiBaja ? valor < 0 : valor > 0) ? 'is-pos' : 'is-neg';
  };

  return seccion('Progreso', `${fechaCorta(ini.fecha)} → ${fechaCorta(fin.fecha)}`, `
    <article class="card w-12">
      <div class="zone">
        <div class="stats stats--4">
          ${dato('Peso', `${conSigno(dPeso, 1)} <small>kg</small>`, `${kg(a.pesoKg)} → ${kg(b.pesoKg)}`, tono(dPeso))}
          ${dato('Masa grasa', `${conSigno(dGrasa, 1)} <small>kg</small>`, `${kg(a.grasaKg)} → ${kg(b.grasaKg)}`, tono(dGrasa))}
          ${dato('Masa magra', `${conSigno(dMagra, 1)} <small>kg</small>`, `${kg(a.magraKg)} → ${kg(b.magraKg)}`, tono(dMagra, false))}
          ${dato('% Grasa', `${conSigno(dPct, 1)} <small>pts</small>`, `${pct(a.grasaPct)} → ${pct(b.grasaPct)}`, tono(dPct))}
        </div>
      </div>
      ${calidad !== null ? `
        <div class="zone">
          <div class="row-between" style="margin-bottom:6px">
            <span class="stat__k">Grasa sobre el total perdido</span>
            <span class="num" style="font-size:var(--fs-sm)">${n(calidad, 0)} %</span>
          </div>
          <div class="bar"><div class="bar__fill ${calidad >= 75 ? 'bar__fill--pos' : 'bar__fill--fat'}"
            style="width:${Math.min(100, calidad)}%"></div></div>
        </div>` : ''}
    </article>`);
}

/* ----------------------------------------------------------- 3. MEDICIÓN */

function seccionFormulario(estado) {
  const existente = (estado.composicion || []).find((m) => m.fecha === vista.fecha);
  const v = (k) => (existente && existente[k] !== undefined && existente[k] !== null ? existente[k] : '');

  return seccion(existente ? 'Editar medición' : 'Nueva medición', '', `
    <article class="card w-12">
      <form data-form-medicion>
        <div class="form-grid">
          <label class="field">
            <span class="field__label">Fecha</span>
            <input class="input" type="date" name="fecha" value="${vista.fecha}" max="${hoy()}" required>
          </label>
          ${CAMPOS.map((c) => `
            <label class="field">
              <span class="field__label">${esc(c.etiqueta)} <span class="field__unit">${esc(c.unidad)}</span></span>
              <input class="input" type="number" inputmode="decimal" name="${c.clave}"
                step="${c.paso}" min="${c.min}" max="${c.max}" value="${v(c.clave)}"
                placeholder="—" ${c.requerido ? 'required' : ''}>
            </label>`).join('')}
        </div>
        <div class="row wrap" style="margin-top:16px">
          <button type="submit" class="btn btn--primary">${existente ? 'Actualizar' : 'Guardar'}</button>
          ${existente
            ? `<button type="button" class="btn btn--ghost btn--danger"
                 data-borrar-medicion="${vista.fecha}">Borrar</button>`
            : ''}
        </div>
      </form>
    </article>`);
}

/* ---------------------------------------------------------- 4. HISTÓRICO */

function seccionHistorico(estado) {
  const filas = [...(estado.composicion || [])].sort((a, b) => (a.fecha < b.fecha ? -1 : 1)).reverse();
  if (filas.length === 0) return '';

  const completas = (estado.composicion || [])
    .filter((c) => M.num(c.peso) !== null && M.num(c.grasaPct) !== null)
    .sort((a, b) => (a.fecha < b.fecha ? -1 : 1));

  let curvas = '';
  if (completas.length >= 2) {
    const grasa = { puntos: [], suavizado: [] };
    const magra = { puntos: [], suavizado: [] };
    for (const c of completas) {
      const d = M.composicion(c.peso, c.grasaPct);
      const dia = diaAbsoluto(c.fecha);
      grasa.puntos.push({ fecha: c.fecha, dia, peso: d.grasaKg });
      magra.puntos.push({ fecha: c.fecha, dia, peso: d.magraKg });
    }
    curvas = `
      <article class="card w-6 card--flush">
        <div class="card__pad" style="padding-bottom:4px"><span class="stat__k">Masa grasa · kg</span></div>
        <div style="padding:0 8px 8px">${graficoPeso(grasa, { alto: 210 })}</div>
      </article>
      <article class="card w-6 card--flush">
        <div class="card__pad" style="padding-bottom:4px"><span class="stat__k">Masa magra · kg</span></div>
        <div style="padding:0 8px 8px">${graficoPeso(magra, { alto: 210 })}</div>
      </article>`;
  }

  const tabla = `<article class="card w-12 card--flush">
    <div class="table-wrap" style="max-height:420px;overflow-y:auto">
      <table class="table">
        <thead><tr>
          <th>Fecha</th><th>Peso</th><th>% Grasa</th><th>M. grasa</th><th>M. magra</th>
          <th>Agua</th><th>Visceral</th><th></th>
        </tr></thead>
        <tbody>
          ${filas.map((m) => {
            const c = M.num(m.grasaPct) !== null ? M.composicion(m.peso, m.grasaPct) : null;
            return `<tr data-editar="${m.fecha}" style="cursor:pointer">
              <td><strong>${esc(fechaCorta(m.fecha))}</strong></td>
              <td><strong>${kg(m.peso)}</strong></td>
              <td>${M.num(m.grasaPct) !== null ? pct(m.grasaPct) : '—'}</td>
              <td class="${c ? 'is-warn' : ''}">${c ? kg(c.grasaKg) : '—'}</td>
              <td class="${c ? 'is-accent' : ''}">${c ? kg(c.magraKg) : '—'}</td>
              <td>${M.num(m.aguaPct) !== null ? pct(m.aguaPct) : '—'}</td>
              <td>${M.num(m.grasaVisceral) !== null ? entero(m.grasaVisceral) : '—'}</td>
              <td><button type="button" class="btn btn--sm btn--ghost btn--danger"
                data-borrar-medicion="${m.fecha}">Borrar</button></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </article>`;

  return seccion('Histórico', `${filas.length} mediciones`, curvas + tabla);
}

/* ---------------------------------------------------------------- RENDER */

export function renderComposicion(estado) {
  return `
    <header class="page-head">
      <div>
        <h1 class="page-title">Cuerpo</h1>
        <p class="page-sub">Tu composición se muestra solo a partir de mediciones reales de la báscula.</p>
      </div>
    </header>
    ${seccionActual(estado)}
    ${seccionProgreso(estado)}
    ${seccionFormulario(estado)}
    ${seccionHistorico(estado)}
  `;
}

/* --------------------------------------------------------------- EVENTOS */

export function conectarComposicion(raiz, store, repintar) {
  raiz.addEventListener('submit', async (ev) => {
    const form = ev.target.closest('[data-form-medicion]');
    if (!form) return;
    ev.preventDefault();

    const datos = new FormData(form);
    const medicion = { fecha: datos.get('fecha') };

    for (const c of CAMPOS) {
      const bruto = String(datos.get(c.clave) || '').trim();
      if (bruto === '') continue;
      const valor = Number(bruto.replace(',', '.'));
      if (!Number.isFinite(valor)) continue;
      if (valor < c.min || valor > c.max) {
        alert(`${c.etiqueta} debe estar entre ${c.min} y ${c.max} ${c.unidad}.`);
        return;
      }
      medicion[c.clave] = valor;
    }

    if (M.num(medicion.peso) === null) {
      alert('El peso es obligatorio.');
      return;
    }

    medicion.imc = M.imc(medicion.peso, store.estado.perfil.alturaCm);

    await store.guardarMedicion(medicion);
    vista.fecha = medicion.fecha;
    repintar();
  });

  raiz.addEventListener('click', async (ev) => {
    const borrar = ev.target.closest('[data-borrar-medicion]');
    if (borrar) {
      ev.stopPropagation();
      const fecha = borrar.dataset.borrarMedicion;
      if (confirm(`¿Borrar la medición del ${fechaCorta(fecha)}?`)) {
        await store.borrarMedicion(fecha);
        if (vista.fecha === fecha) vista.fecha = hoy();
        repintar();
      }
      return;
    }

    const editar = ev.target.closest('[data-editar]');
    if (editar) {
      vista.fecha = editar.dataset.editar;
      repintar();
      raiz.querySelector('[data-form-medicion]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
}
