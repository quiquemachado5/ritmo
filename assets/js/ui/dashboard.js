/* ============================================================================
   PANEL — una lectura directa: peso, registro de hoy y previsión.

   La previsión se separa del balance diario porque una estimación de calorías
   no es lo mismo que una medición. El usuario siempre ve qué dato es real,
   qué es tendencia y cuándo el modelo no tiene base suficiente.
   ========================================================================== */

import * as A from '../core/analytics.js';
import { HABITOS, TOTAL_HABITOS } from '../config.js';
import { hoy } from '../core/dates.js';
import { graficoPeso, graficoBalance } from './charts.js';
import { kg, pct, entero, kcalConSigno, conSigno, fechaCorta, duracion, n, esc } from '../core/format.js';

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

function delta(valor, unidad = 'kg') {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return '';
  const plano = Math.abs(valor) < 0.05;
  const clase = plano ? 'flat' : valor < 0 ? 'pos' : 'neg';
  const flecha = plano ? '' : valor < 0 ? '↓' : '↑';
  return `<span class="delta delta--${clase}">${flecha} ${n(Math.abs(valor), 1)} ${esc(unidad)}</span>`;
}

function etiquetaCalidad(modelo) {
  if (!modelo) return '';
  const etiquetas = { alta: 'Calibrado', media: 'Con margen', inicial: 'Orientativo' };
  return etiquetas[modelo.calidad] || 'Orientativo';
}

function intervalo(pronostico) {
  if (!pronostico) return '';
  return `${kg(pronostico.minimo)}–${kg(pronostico.maximo)} kg`;
}

/* ============================================================ 1. ESTADO */

function seccionEstado(r) {
  const p = r.peso;
  const prevision = r.prediccion;
  if (p.actual === null) {
    return seccion('Estado actual', '', `<article class="card w-12">
      <div class="empty">
        <p class="empty__title">Aún no hay pesajes</p>
        <p>Registra un primer peso para empezar a ver tu evolución.</p>
        <a class="btn btn--primary btn--sm" href="#registro">Añadir pesaje</a>
      </div>
    </article>`);
  }

  const peso = p.estimadoHoy ?? p.actual;
  const esEstimacion = prevision.disponible;
  const progreso = (p.inicial !== null && p.objetivo !== null && p.inicial !== p.objetivo)
    ? Math.max(0, Math.min(100, ((p.inicial - peso) / (p.inicial - p.objetivo)) * 100))
    : null;

  return seccion('Estado actual', esEstimacion ? 'estimación a día de hoy' : `último pesaje · ${fechaCorta(p.fecha)}`, `
    <article class="card card--overview w-8">
      <div class="overview__head">
        <div>
          <div class="overview__label">${esEstimacion ? 'Peso estimado' : 'Último peso registrado'}</div>
          <div class="overview__value num">${kg(peso)}<span>kg</span></div>
        </div>
        ${esEstimacion ? `<span class="overview__badge">${etiquetaCalidad(prevision.modelo)}</span>` : ''}
      </div>
      <div class="overview__foot">
        ${esEstimacion
          ? `<span>Báscula: <strong>${kg(p.actual)} kg · ${fechaCorta(p.fecha)}</strong> · rango ${intervalo(prevision.hoy)}</span>`
          : `<span>Medido el <strong>${fechaCorta(p.fecha)}</strong></span>`}
        <a class="btn btn--light btn--sm" href="#registro">Registrar peso</a>
      </div>
    </article>

    ${p.objetivo !== null ? `<article class="card card--goal w-4">
      <div class="stat__k">Objetivo</div>
      <div class="metric__value num">${kg(p.objetivo)}<span class="metric__unit">kg</span></div>
      ${progreso !== null ? `<div class="bar" aria-label="${n(progreso, 0)} por ciento completado"><div class="bar__fill" style="width:${progreso.toFixed(1)}%"></div></div>` : ''}
      <div class="metric__foot">
        <span>Faltan <strong>${kg(Math.max(0, p.restante))} kg</strong></span>
        ${prevision.diasObjetivo ? `<span>Ritmo actual: <strong>${duracion(prevision.diasObjetivo)}</strong></span>` : ''}
      </div>
    </article>` : ''}
  `);
}

function seccionCuerpo(r) {
  const comp = r.composicion;
  const p = r.peso;
  if (!comp) return '';
  const peso = p.estimadoHoy ?? p.actual;

  return seccion('Composición', 'solo datos de báscula', `
    <article class="card card--body-summary w-12">
      <div class="stats stats--4">
        ${dato('Cambio desde el inicio', delta(peso - p.inicial), `desde ${fechaCorta(p.fechaInicial)}`)}
        ${dato('Masa grasa', `${kg(comp.grasaKg)} <small>kg</small>`, pct(comp.grasaPct))}
        ${dato('Masa magra', `${kg(comp.magraKg)} <small>kg</small>`, pct(comp.magraPct))}
        ${r.imc ? dato('IMC', n(r.imc.valor, 1), esc(r.imc.categoria.etiqueta)) : ''}
      </div>
    </article>`);
}

/* =============================================================== 2. HOY */

function seccionHoy(r, estado) {
  const e = r.energia;
  const fecha = hoy();
  const hoyDia = estado.dias[fecha] || { habitos: {} };
  const marcados = Object.values(hoyDia.habitos || {}).filter((v) => v === true).length;
  const pills = `<div class="hpills">
    ${HABITOS.map((h) => `<span class="hpill" data-on="${(hoyDia.habitos || {})[h.clave] === true ? 1 : 0}">
      ${esc(h.etiqueta)}</span>`).join('')}
  </div>`;

  if (e.sinRegistro && !e.imputado) {
    return seccion('Hoy', fechaCorta(fecha), `<article class="card w-12">
      <div class="empty">
        <p class="empty__title">Hoy está en blanco</p>
        <p>Registrar el día mantiene el contexto de tus hábitos; no modifica por sí solo la previsión de peso.</p>
        <a class="btn btn--primary btn--sm" href="#registro">Registrar hoy</a>
      </div>
    </article>`);
  }

  return seccion('Hoy', fechaCorta(fecha), `<article class="card card--today w-12">
    <div class="day-summary">
      <div>
        <div class="stat__k">Balance registrado</div>
        <div class="metric__value num">${kcalConSigno(e.balance)}</div>
        <div class="metric__foot">
          <span class="chip ${e.balance < 0 ? 'chip--pos' : 'chip--warn'}">${e.balance < 0 ? 'Déficit' : 'Superávit'}</span>
          ${e.imputado ? '<span class="chip chip--warn">Sin registrar</span>' : e.estimado ? '<span class="chip">Estimado</span>' : '<span class="chip chip--pos">Anotado</span>'}
        </div>
      </div>
      <a class="btn btn--sm" href="#registro">Editar día</a>
    </div>
    <div class="zone">
      <div class="stats stats--3">
        ${dato('Consumidas', `${entero(e.consumidas)} <small>kcal</small>`, e.consumidasEstimadas ? 'estimadas' : 'registradas')}
        ${dato('Gasto', `${entero(e.quemadas)} <small>kcal</small>`, e.quemadasEstimadas ? 'estimado' : 'registrado')}
        ${dato('Hábitos', `${marcados}/${TOTAL_HABITOS}`, 'completados hoy')}
      </div>
    </div>
    <div class="zone">${pills}</div>
  </article>`);
}

/* ========================================================= 3. PREVISIÓN */

function mensajeSinPrevision(p) {
  if (p.motivo === 'pesaje-antiguo') {
    return `Han pasado ${p.diasSinPesaje} días desde el último pesaje. Añade uno para actualizar la tendencia.`;
  }
  if (p.motivo === 'muestra-insuficiente') {
    return `Necesitamos al menos 3 pesajes repartidos en 14 días. Ahora hay ${p.pesajes}.`;
  }
  return 'Añade pesajes en distintos días para construir una tendencia fiable.';
}

function seccionProyeccion(r) {
  const p = r.prediccion;
  if (!p.disponible) {
    return seccion('Previsión de peso', 'pendiente de datos suficientes', `<article class="card card--quiet w-12">
      <div class="empty empty--compact">
        <p class="empty__title">Aún no hay una previsión fiable</p>
        <p>${mensajeSinPrevision(p)}</p>
        <a class="btn btn--primary btn--sm" href="#registro">Registrar peso</a>
      </div>
    </article>`);
  }

  const proy = (valor) => `${kg(valor.peso)} <small>kg</small>`;
  const sub = (valor) => `Rango: ${intervalo(valor)}`;
  const modelo = p.modelo;

  const base = modelo.calibrado ? 'estimación calibrada con tu historial' : 'estimación con gasto de referencia';

  return seccion('Próxima revisión', `${base} · rango orientativo`, `
    <article class="card card--forecast w-12">
      <div class="stats stats--3">
        ${dato('En 7 días', proy(p.semana), sub(p.semana))}
        ${dato('Siguiente pesaje', proy(p.quincena), `${sub(p.quincena)} · dentro de 14 días`)}
        ${dato('En 30 días', proy(p.mes), sub(p.mes))}
      </div>
      <div class="zone forecast__details">
        <span class="chip chip--accent">${etiquetaCalidad(modelo)}</span>
        <span>${modelo.calibrado ? 'Gasto calibrado con tu historial' : 'Gasto teórico de referencia'}</span>
        <span>${p.diasSinPesaje} días desde la báscula</span>
        <span>Ritmo previsto: <strong>${conSigno(modelo.kgSemana, 2)} kg/sem</strong></span>
        <span>Próximo pesaje recomendado: <strong>${fechaCorta(p.proximoPesaje)}</strong></span>
        ${p.diasObjetivo ? `<span>Objetivo: <strong>${duracion(p.diasObjetivo)}</strong> si se mantiene el ritmo</span>` : ''}
      </div>
    </article>
    <div class="notice notice--accent w-12" role="note">
      <span>Parte de la última báscula y suma el balance diario. Los días estimados o sin registrar ensanchan el rango; registra el pesaje recomendado cada 14 días para reajustarlo.</span>
    </div>
  `);
}

/* =========================================================== 4. HISTÓRICO */

function seccionHistorico(r, estado) {
  return seccion('Histórico', '', `
    <article class="card w-7 card--flush">
      <div class="card__pad chart-card__head">
        <div>
          <div class="stat__k">Evolución de peso</div>
          <div class="card__hint">La línea punteada suaviza las variaciones diarias.</div>
        </div>
        <div class="legend">
          <span class="legend__item"><span class="legend__swatch" style="background:var(--weight)"></span>Pesajes</span>
          <span class="legend__item"><span class="legend__swatch" style="background:var(--ink-4)"></span>Objetivo</span>
        </div>
      </div>
      <div class="chart-card__canvas">${graficoPeso(A.seriePeso(estado, 120), { objetivo: r.peso.objetivo, alto: 240 })}</div>
    </article>

    <article class="card w-5 card--flush">
      <div class="card__pad chart-card__head">
        <div>
          <div class="stat__k">Balance · 30 días</div>
          <div class="card__hint">Los días sin registro van rayados.</div>
        </div>
      </div>
      <div class="chart-card__canvas">${graficoBalance(A.serieBalance(estado, 30), { alto: 210 })}</div>
    </article>`);
}

/* ---------------------------------------------------------------- RENDER */

export function renderDashboard(estado) {
  const r = A.resumen(estado);
  return `
    <header class="page-head page-head--dashboard">
      <div>
        <h1 class="page-title">Tu progreso</h1>
        <p class="page-sub">Mira qué está medido, qué es una estimación y cuándo te conviene volver a pesarte.</p>
      </div>
    </header>
    ${seccionEstado(r)}
    ${seccionProyeccion(r)}
    ${seccionCuerpo(r)}
    ${seccionHoy(r, estado)}
    ${seccionHistorico(r, estado)}
  `;
}
