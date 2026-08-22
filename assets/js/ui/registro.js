/* ============================================================================
   REGISTRO — captura diaria.

     1. Día         ·  hábitos, medidas y el resultado del día, juntos
     2. Constancia  ·  calendario y cumplimiento por hábito
     3. Últimos días

   Los cálculos se rehacen en cada pulsación (`input`) y se persisten al
   confirmar el campo (`change`).
   ========================================================================= */

import * as M from '../core/metrics.js';
import * as A from '../core/analytics.js';
import { HABITOS, TOTAL_HABITOS } from '../config.js';
import { hoy, claveMes, limitesMes, diaSemanaLunes, DIAS_SEMANA, sumarMeses } from '../core/dates.js';
import { kg, pct, entero, kcalConSigno, fechaLarga, fechaCorta, mesLargo, n, esc } from '../core/format.js';

/** Estado de interfaz propio de la vista. */
const vista = { fecha: hoy(), mes: claveMes(hoy()) };

const ICONO_CHECK = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3.2 3.2L13 4.8"/></svg>';
const ICONO_RELOJ = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/></svg>';
const ICONO_ANTERIOR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg>';
const ICONO_SIGUIENTE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m10 6 6 6-6 6"/></svg>';

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

/* ------------------------------------------------------------ 1. EL DÍA */

function tarjetaDia(dia) {
  const marcados = Object.values(dia.habitos || {}).filter((v) => v === true).length;
  const v = (k) => (dia[k] === undefined || dia[k] === null ? '' : dia[k]);

  return `<article class="card card--habit-log w-8">

    <div class="zone">
      <div class="row-between" style="margin-bottom:10px">
        <span class="stat__k">Hábitos</span>
        <span class="num" style="font-size:var(--fs-sm)">${marcados}/${TOTAL_HABITOS}</span>
      </div>
      <div class="habits">
        ${HABITOS.map((h) => `<button type="button" class="habit" data-habito="${h.clave}"
          aria-pressed="${(dia.habitos || {})[h.clave] === true}">
          <span class="habit__box">${ICONO_CHECK}</span>
          <span>${esc(h.etiqueta)}</span>
        </button>`).join('')}
      </div>
    </div>

    <div class="zone">
      <div class="stat__k" style="margin-bottom:10px">Medidas</div>
      <div class="form-grid">
        <label class="field">
          <span class="field__label">Peso <span class="field__unit">kg</span></span>
          <input class="input" type="number" inputmode="decimal" step="0.1" min="25" max="400"
            data-campo="peso" value="${v('peso')}" placeholder="—">
        </label>
        <label class="field">
          <span class="field__label">Grasa <span class="field__unit">%</span></span>
          <input class="input" type="number" inputmode="decimal" step="0.1" min="2" max="70"
            data-campo="grasaPct" value="${v('grasaPct')}" placeholder="—">
        </label>
        <label class="field">
          <span class="field__label">Consumidas <span class="field__unit">kcal</span></span>
          <input class="input" type="number" inputmode="numeric" step="10" min="0" max="12000"
            data-campo="kcalConsumidas" value="${v('kcalConsumidas')}" placeholder="—">
        </label>
        <label class="field">
          <span class="field__label">Quemadas <span class="field__unit">kcal</span></span>
          <input class="input" type="number" inputmode="numeric" step="10" min="0" max="12000"
            data-campo="kcalQuemadas" value="${v('kcalQuemadas')}" placeholder="—">
        </label>
      </div>
    </div>

    <div class="zone">
      <label class="field">
        <span class="field__label">Notas</span>
        <textarea class="input input--textarea" data-campo="notas" placeholder="—">${esc(v('notas'))}</textarea>
      </label>
    </div>

  </article>`;
}

/**
 * Resultado del día. Se regenera solo (sin repintar la vista entera) en cada
 * pulsación, para no perder el foco del teclado mientras se escribe.
 */
export function bloqueCalculos(dia, estado) {
  const perfil = estado.perfil || {};
  const energia = M.energiaDia(dia, {
    kcalObjetivo: perfil.kcalObjetivo,
    tdeeBase: A.tdeeVigente(estado),
    imputacion: A.reglaImputacion(estado),
  });

  const ref = M.num(dia.peso) !== null ? dia.peso : (A.pesoActual(estado)?.peso ?? null);
  const grasa = M.num(dia.grasaPct);
  const comp = ref !== null && grasa !== null ? M.composicion(ref, grasa) : null;
  const imcValor = ref !== null ? M.imc(ref, perfil.alturaCm) : null;
  const cat = imcValor !== null ? M.categoriaIMC(imcValor) : null;
  const enDeficit = energia.balance < 0;

  const marca = energia.imputado ? ['chip--warn', 'Sin registrar']
    : energia.estimado ? ['', 'Estimado']
    : ['chip--pos', 'Registrado'];

  return `
    <div class="zone">
      <div class="row-between" style="margin-bottom:8px">
        <span class="stat__k">Balance</span>
        <span class="chip ${marca[0]}">${marca[1]}</span>
      </div>
      <div class="metric__value num ${enDeficit ? 'is-pos' : 'is-neg'}">${kcalConSigno(energia.balance)}</div>
      <div class="facts" style="margin-top:8px">
        <span>Consumidas <b>${entero(energia.consumidas)}</b></span>
        <span>Quemadas <b>${entero(energia.quemadas)}</b></span>
      </div>
    </div>

    <div class="zone">
      <div class="stats">
        ${dato('Peso de referencia', ref !== null ? `${kg(ref)} <small>kg</small>` : '—',
          M.num(dia.peso) !== null ? 'registrado hoy' : 'último pesaje')}
        ${dato('Gasto de referencia', `${entero(A.tdeeVigente(estado))} <small>kcal</small>`,
          'para la estimación del panel')}
        ${dato('Masa grasa', comp ? `${kg(comp.grasaKg)} <small>kg</small>` : '—',
          comp ? pct(comp.grasaPct) : '', 'is-warn')}
        ${dato('Masa magra', comp ? `${kg(comp.magraKg)} <small>kg</small>` : '—',
          comp ? pct(comp.magraPct) : '', 'is-accent')}
        ${dato('IMC', imcValor !== null ? n(imcValor, 1) : '—', cat ? esc(cat.etiqueta) : '')}
      </div>
    </div>`;
}

/* --------------------------------------------------------- 2. CONSTANCIA */

function tarjetaCalendario(estado) {
  const { desde, dias } = limitesMes(vista.mes);
  const hueco = diaSemanaLunes(desde);
  const mapa = estado.dias || {};
  const ahora = hoy();
  const regla = A.reglaImputacion(estado);

  const celdas = [];
  for (let i = 0; i < hueco; i++) celdas.push('<span class="cal__day cal__day--void"></span>');

  for (let d = 1; d <= dias; d++) {
    const fecha = `${vista.mes}-${String(d).padStart(2, '0')}`;
    const dia = mapa[fecha];
    const nivel = M.nivelDia(dia && dia.habitos, TOTAL_HABITOS);
    const pesado = dia && M.num(dia.peso) !== null ? '1' : '0';
    const futuro = fecha > ahora ? ' cal__day--future' : '';
    const imputado = !dia && regla.activa && fecha >= regla.desde && fecha <= ahora ? '1' : '0';
    const titulo = imputado === '1'
      ? `${fechaCorta(fecha)} · sin registrar`
      : `${fechaCorta(fecha)}${dia ? ` · ${M.adherenciaDia(dia.habitos, TOTAL_HABITOS)} %` : ''}`;
    celdas.push(`<button type="button" class="cal__day${futuro}" data-fecha="${fecha}"
      data-level="${nivel}" data-weighed="${pesado}" data-imputado="${imputado}"
      aria-pressed="${fecha === vista.fecha}"
      ${fecha === ahora ? 'aria-current="date"' : ''}
      title="${esc(titulo)}">${d}</button>`);
  }

  return `<article class="card card--habit-calendar w-5">
    <div class="row-between" style="margin-bottom:12px">
      <span class="stat__k">Calendario</span>
      <div class="month-nav">
        <button type="button" class="icon-btn" data-mes="-1" aria-label="Mes anterior">${ICONO_ANTERIOR}</button>
        <span class="month-nav__label">${esc(mesLargo(vista.mes))}</span>
        <button type="button" class="icon-btn" data-mes="1" aria-label="Mes siguiente"
          ${vista.mes >= claveMes(ahora) ? 'disabled' : ''}>${ICONO_SIGUIENTE}</button>
      </div>
    </div>
    <div class="cal">
      ${DIAS_SEMANA.map((d) => `<span class="cal__dow">${d}</span>`).join('')}
      ${celdas.join('')}
    </div>
    <div class="legend" style="margin-top:14px">
      <span class="legend__item"><span class="legend__swatch" style="background:var(--accent-faint)"></span>Parcial</span>
      <span class="legend__item"><span class="legend__swatch" style="background:var(--accent)"></span>Completo</span>
      <span class="legend__item"><span class="legend__swatch"
        style="background:var(--surface-2);border:1px solid var(--ink-4)"></span>Sin registrar</span>
    </div>
  </article>`;
}

function tarjetaConstancia(estado, h) {
  const filas = A.adherenciaPorHabito(estado, HABITOS, 30);

  return `<article class="card w-7">
    <div class="zone">
      <div class="stats stats--3">
        ${dato('Adherencia 30 d', pct(h.adherencia30, 0), '', h.adherencia30 >= 70 ? 'is-pos' : 'is-warn')}
        ${dato('Racha', `${h.rachaActual} <small>d</small>`, `récord ${h.mejorRacha}`,
          h.rachaActual > 0 ? 'is-pos' : '')}
        ${dato('Registrados', h.diasRegistrados, 'días')}
      </div>
    </div>
    <div class="zone">
      <div class="stat__k" style="margin-bottom:10px">Por hábito · 30 días</div>
      <div class="stack" style="gap:10px">
        ${filas.map((f) => `
          <div>
            <div class="row-between" style="margin-bottom:4px">
              <span style="font-size:var(--fs-sm);font-weight:500;color:var(--ink-2)">${esc(f.etiqueta)}</span>
              <span class="num" style="font-size:var(--fs-sm)">${n(f.pct, 0)} %</span>
            </div>
            <div class="bar"><div class="bar__fill ${f.pct >= 70 ? '' : 'bar__fill--muted'}"
              style="width:${f.pct}%"></div></div>
          </div>`).join('')}
      </div>
    </div>
  </article>`;
}

/* ------------------------------------------------------- 3. ÚLTIMOS DÍAS */

function tarjetaHistorial(estado) {
  const dias = A.diasOrdenados(estado).slice(-14).reverse();
  if (dias.length === 0) {
    return `<article class="card w-12">
      <div class="empty"><div class="empty__icon">${ICONO_RELOJ}</div>
        <p class="empty__title">Sin registros todavía</p></div>
    </article>`;
  }

  return `<article class="card w-12 card--flush">
    <div class="table-wrap">
      <table class="table">
        <thead><tr>
          <th>Fecha</th><th>Hábitos</th><th>Peso</th><th>Consum.</th><th>Quem.</th><th>Balance</th><th></th>
        </tr></thead>
        <tbody>
          ${dias.map((d) => {
            const e = A.energiaDe(estado, d.fecha);
            const marcados = Object.values(d.habitos || {}).filter((v) => v === true).length;
            return `<tr data-ir="${d.fecha}" style="cursor:pointer">
              <td><strong>${esc(fechaCorta(d.fecha))}</strong></td>
              <td>${marcados}/${TOTAL_HABITOS}</td>
              <td>${M.num(d.peso) !== null ? `<strong>${kg(d.peso)}</strong>` : '—'}</td>
              <td>${entero(e.consumidas)}</td>
              <td>${entero(e.quemadas)}</td>
              <td class="${e.balance < 0 ? 'is-pos' : 'is-neg'}"><strong>${kcalConSigno(e.balance)}</strong></td>
              <td><button type="button" class="btn btn--sm btn--ghost btn--danger"
                data-borrar="${d.fecha}">Borrar</button></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </article>`;
}

/* ---------------------------------------------------------------- RENDER */

export function renderRegistro(estado) {
  const dia = estado.dias[vista.fecha] || { fecha: vista.fecha, habitos: {} };
  const h = A.resumen(estado).habitos;

  return `
    <header class="page-head">
      <div>
        <h1 class="page-title">Registro</h1>
        <p class="page-sub">Marca hábitos, anota el día y registra el peso cuando toque. Cada pesaje recalibra la estimación.</p>
      </div>
      <div class="row">
        <input class="input" type="date" data-selector-fecha value="${vista.fecha}" max="${hoy()}"
          style="width:auto" aria-label="Ir a fecha">
        <button type="button" class="btn" data-hoy>Hoy</button>
      </div>
    </header>

    ${seccion(vista.fecha === hoy() ? 'Hoy' : 'Día', fechaLarga(vista.fecha),
      tarjetaDia(dia)
      + `<article class="card card--energy w-4" data-calculos>${bloqueCalculos(dia, estado)}</article>`)}

    ${seccion('Constancia', '', tarjetaCalendario(estado) + tarjetaConstancia(estado, h))}

    ${seccion('Últimos días', '', tarjetaHistorial(estado))}
  `;
}

/* --------------------------------------------------------------- EVENTOS */

export function conectarRegistro(raiz, store, repintar) {
  const numerico = (campo) => campo !== 'notas';

  const leerValor = (input) => {
    const bruto = input.value.trim();
    if (bruto === '') return null;
    if (!numerico(input.dataset.campo)) return bruto;
    const v = Number(bruto.replace(',', '.'));
    return Number.isFinite(v) ? v : null;
  };

  /** Reconstruye solo el bloque de resultados con lo que hay escrito ahora. */
  const refrescarCalculos = () => {
    const destino = raiz.querySelector('[data-calculos]');
    if (!destino) return;
    const dia = { ...(store.estado.dias[vista.fecha] || { fecha: vista.fecha, habitos: {} }) };
    raiz.querySelectorAll('[data-campo]').forEach((input) => {
      const v = leerValor(input);
      if (v === null) delete dia[input.dataset.campo];
      else dia[input.dataset.campo] = v;
    });
    destino.innerHTML = bloqueCalculos(dia, store.estado);
  };

  raiz.addEventListener('click', async (ev) => {
    const habito = ev.target.closest('[data-habito]');
    if (habito) {
      await store.alternarHabito(vista.fecha, habito.dataset.habito);
      return;
    }

    const borrar = ev.target.closest('[data-borrar]');
    if (borrar) {
      ev.stopPropagation();
      const fecha = borrar.dataset.borrar;
      if (confirm(`¿Borrar el registro del ${fechaCorta(fecha)}?`)) await store.borrarDia(fecha);
      return;
    }

    const celdaDia = ev.target.closest('[data-fecha]');
    if (celdaDia) {
      vista.fecha = celdaDia.dataset.fecha;
      vista.mes = claveMes(vista.fecha);
      repintar();
      return;
    }

    const ir = ev.target.closest('[data-ir]');
    if (ir) {
      vista.fecha = ir.dataset.ir;
      vista.mes = claveMes(vista.fecha);
      repintar();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const mes = ev.target.closest('[data-mes]');
    if (mes) {
      vista.mes = sumarMeses(vista.mes, Number(mes.dataset.mes));
      repintar();
      return;
    }

    if (ev.target.closest('[data-hoy]')) {
      vista.fecha = hoy();
      vista.mes = claveMes(vista.fecha);
      repintar();
    }
  });

  raiz.addEventListener('input', (ev) => {
    if (ev.target.matches('[data-campo]')) refrescarCalculos();
  });

  raiz.addEventListener('change', async (ev) => {
    const selector = ev.target.closest('[data-selector-fecha]');
    if (selector) {
      if (selector.value) {
        vista.fecha = selector.value > hoy() ? hoy() : selector.value;
        vista.mes = claveMes(vista.fecha);
        repintar();
      }
      return;
    }

    const campo = ev.target.closest('[data-campo]');
    if (!campo) return;
    await store.actualizarDia(vista.fecha, { [campo.dataset.campo]: leerValor(campo) });
  });
}

/** Permite a otras vistas abrir el registro en una fecha concreta. */
export function irAFecha(fecha) {
  vista.fecha = fecha;
  vista.mes = claveMes(fecha);
}

export { vista as vistaRegistro };
