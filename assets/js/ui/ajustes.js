/* ============================================================================
   AJUSTES

     1. Perfil  ·  los parámetros que alimentan IMC, TDEE y proyecciones
     2. Modelo  ·  cómo se tratan los días sin registro
     3. Datos   ·  sincronización y copias
   ========================================================================= */

import * as M from '../core/metrics.js';
import * as A from '../core/analytics.js';
import { FACTORES_ACTIVIDAD } from '../core/metrics.js';
import { supabaseConfigurado } from '../data/supabase-adapter.js';
import { toast } from './toast.js';
import { entero, n, esc } from '../core/format.js';

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

/* ------------------------------------------------------------- 1. PERFIL */

function seccionPerfil(estado) {
  const p = estado.perfil;
  const actual = A.pesoActual(estado);
  const peso = actual ? actual.peso : p.pesoObjetivo;

  const basal = M.metabolismoBasal({ peso, alturaCm: p.alturaCm, edad: p.edad, sexo: p.sexo });
  const teorico = M.tdeeTeorico({
    peso, alturaCm: p.alturaCm, edad: p.edad, sexo: p.sexo, factorActividad: p.factorActividad,
  });
  const observado = A.tdeeDesdeHistorial(estado);

  return seccion('Perfil', '', `
    <article class="card w-7">
      <div class="form-grid">
        <label class="field">
          <span class="field__label">Altura <span class="field__unit">cm</span></span>
          <input class="input" type="number" data-perfil="alturaCm" value="${p.alturaCm}" min="120" max="230" step="1">
        </label>
        <label class="field">
          <span class="field__label">Edad <span class="field__unit">años</span></span>
          <input class="input" type="number" data-perfil="edad" value="${p.edad}" min="14" max="100" step="1">
        </label>
        <label class="field">
          <span class="field__label">Sexo</span>
          <select class="input" data-perfil="sexo">
            <option value="hombre" ${p.sexo === 'hombre' ? 'selected' : ''}>Hombre</option>
            <option value="mujer"  ${p.sexo === 'mujer' ? 'selected' : ''}>Mujer</option>
          </select>
        </label>
        <label class="field">
          <span class="field__label">Objetivo <span class="field__unit">kg</span></span>
          <input class="input" type="number" data-perfil="pesoObjetivo" value="${p.pesoObjetivo}" min="35" max="250" step="0.1">
        </label>
        <label class="field">
          <span class="field__label">Calorías <span class="field__unit">kcal/día</span></span>
          <input class="input" type="number" data-perfil="kcalObjetivo" value="${p.kcalObjetivo}" min="900" max="4000" step="10">
        </label>
        <label class="field">
          <span class="field__label">Actividad</span>
          <select class="input" data-perfil="factorActividad">
            ${FACTORES_ACTIVIDAD.map((f) => `<option value="${f.factor}" title="${esc(f.detalle)}"
              ${Number(p.factorActividad) === f.factor ? 'selected' : ''}>${esc(f.etiqueta)} (×${f.factor})</option>`).join('')}
          </select>
        </label>
        <label class="field">
          <span class="field__label">Umbral de racha <span class="field__unit">hábitos</span></span>
          <input class="input" type="number" data-perfil="umbralRacha" value="${p.umbralRacha}" min="1" max="6" step="1">
        </label>
      </div>
    </article>

    <article class="card w-5">
      <div class="stats">
        ${dato('Basal', `${entero(basal)} <small>kcal</small>`)}
        ${dato('Gasto teórico', `${entero(teorico)} <small>kcal</small>`, `×${n(p.factorActividad, 3)}`)}
        ${dato('Gasto observado', observado ? `${entero(observado.kcal)} <small>kcal</small>` : '—',
          observado ? `${observado.cobertura}% de cobertura · ${observado.explicitas} kcal anotadas` : 'sin historial', observado ? 'is-accent' : '')}
        ${dato('En uso', `${entero(A.tdeeVigente(estado))} <small>kcal</small>`)}
      </div>
    </article>`);
}

/* ------------------------------------------------------------- 2. MODELO */

function seccionModelo(estado) {
  const p = estado.perfil;
  const estimacion = A.proyeccionPesoConfiable(estado);
  const ultimo = A.pesoActual(estado);
  const activa = p.imputarActiva !== false;

  return seccion('Modelo de estimación', activa ? 'los huecos aumentan el margen' : 'los huecos quedan abiertos', `
    <article class="card w-7">
      <div class="form-grid">
        <label class="field">
          <span class="field__label">Días sin registro</span>
          <select class="input" data-perfil="imputarActiva">
            <option value="si" ${activa ? 'selected' : ''}>Asumir superávit</option>
            <option value="no" ${!activa ? 'selected' : ''}>Dejar como inciertos</option>
          </select>
        </label>
        <label class="field">
          <span class="field__label">Aplicar desde</span>
          <input class="input" type="date" data-perfil="imputarDesde" value="${esc(p.imputarDesde || '')}">
        </label>
        <label class="field">
          <span class="field__label">Superávit asumido <span class="field__unit">kcal/día</span></span>
          <input class="input" type="number" data-perfil="imputarSuperavitKcal"
            value="${p.imputarSuperavitKcal}" min="0" max="3000" step="50">
        </label>
      </div>
      <div class="zone">
        <p class="field__help" style="margin:0">La estimación parte de la última báscula y del balance diario. Si un día no se anota, esta regla evita ignorarlo; a cambio, el intervalo de incertidumbre se hace mayor.</p>
      </div>
    </article>

    <article class="card w-5">
      ${estimacion.disponible ? `<div class="stats">
        ${dato('Estimación actual', `${n(estimacion.hoy.peso, 1)} <small>kg</small>`, `rango ${n(estimacion.hoy.minimo, 1)}–${n(estimacion.hoy.maximo, 1)}`)}
        ${dato('Última báscula', ultimo ? `${n(ultimo.peso, 1)} <small>kg</small>` : '—', ultimo ? ultimo.fecha : '')}
        ${dato('Días sin pesar', estimacion.diasSinPesaje)}
        ${dato('Gasto en uso', `${entero(estimacion.modelo.tdee)} <small>kcal</small>`, estimacion.modelo.calibrado ? 'calibrado' : 'teórico')}
      </div>` : `<div class="empty empty--compact"><p class="empty__title">Falta un primer pesaje</p><p>La estimación necesita una báscula de partida.</p></div>`}
    </article>`);
}

/* -------------------------------------------------------------- 3. DATOS */

function tarjetaNube(estado, repo) {
  if (!supabaseConfigurado()) {
    return `<article class="card w-6">
      <div class="row-between" style="margin-bottom:12px">
        <span class="stat__k">Sincronización</span>
        <span class="chip chip--warn">Solo este dispositivo</span>
      </div>
      <p class="field__help" style="margin:0">
        Configura Supabase en <code>assets/js/config.js</code> para sincronizar entre dispositivos.
      </p>
    </article>`;
  }

  if (estado.modo === 'nube') {
    return `<article class="card w-6">
      <div class="row-between" style="margin-bottom:12px">
        <span class="stat__k">Sincronización</span>
        <span class="chip chip--pos">Activa</span>
      </div>
      <div class="facts" style="margin-bottom:14px">
        <span><b>${esc(repo.nube.correo || 'sesión iniciada')}</b></span>
      </div>
      <div class="row wrap">
        <button type="button" class="btn btn--sm" data-subir-local>Subir datos locales</button>
        <button type="button" class="btn btn--sm btn--ghost" data-cerrar-sesion>Cerrar sesión</button>
      </div>
    </article>`;
  }

  return `<article class="card w-6">
    <div class="row-between" style="margin-bottom:12px">
      <span class="stat__k">Sincronización</span>
      <span class="chip chip--warn">Sin sesión</span>
    </div>
    <form class="row wrap" data-form-acceso style="gap:8px">
      <input class="input grow" type="email" name="email" required placeholder="tu@correo.com"
        style="min-width:180px;font-weight:500">
      <button type="submit" class="btn btn--primary">Entrar</button>
    </form>
  </article>`;
}

function tarjetaCopias(estado) {
  const dias = Object.keys(estado.dias).length;
  const mediciones = (estado.composicion || []).length;

  return `<article class="card w-6">
    <div class="row-between" style="margin-bottom:12px">
      <span class="stat__k">Copias</span>
      <span class="card__hint">${dias} días · ${mediciones} mediciones</span>
    </div>
    <div class="row wrap">
      <button type="button" class="btn btn--sm btn--primary" data-exportar>Exportar JSON</button>
      <button type="button" class="btn btn--sm" data-importar>Importar</button>
      <input type="file" accept="application/json,.json" data-fichero class="hidden">
    </div>
    <p class="field__help" style="margin:12px 0 0">Importar fusiona; no borra lo que no venga en el archivo.</p>
  </article>`;
}

/* ---------------------------------------------------------------- RENDER */

export function renderAjustes(estado, repo) {
  return `
    <header class="page-head">
      <div>
        <h1 class="page-title">Ajustes</h1>
        <p class="page-sub">Perfil, reglas de estimación y copias de tus datos.</p>
      </div>
    </header>
    ${seccionPerfil(estado)}
    ${seccionModelo(estado)}
    ${seccion('Datos', '', tarjetaNube(estado, repo) + tarjetaCopias(estado))}
  `;
}

/* --------------------------------------------------------------- EVENTOS */

export function conectarAjustes(raiz, store, repo, repintar) {
  raiz.addEventListener('change', async (ev) => {
    const campo = ev.target.closest('[data-perfil]');
    if (campo) {
      const clave = campo.dataset.perfil;
      let valor;
      if (clave === 'imputarActiva') valor = campo.value === 'si';
      else if (clave === 'sexo' || clave === 'imputarDesde') valor = campo.value;
      else {
        valor = Number(campo.value);
        if (!Number.isFinite(valor)) return;
      }
      await store.actualizarPerfil({ [clave]: valor });
      repintar();
      toast('Guardado');
      return;
    }

    const fichero = ev.target.closest('[data-fichero]');
    if (fichero && fichero.files[0]) {
      try {
        await store.importar(JSON.parse(await fichero.files[0].text()));
        repintar();
        toast('Copia importada');
      } catch (e) {
        console.error(e);
        toast('No se pudo leer el archivo', 'error');
      }
      fichero.value = '';
    }
  });

  raiz.addEventListener('click', async (ev) => {
    if (ev.target.closest('[data-exportar]')) {
      const blob = new Blob([JSON.stringify(store.exportar(), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dieta-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast('Copia descargada');
      return;
    }

    if (ev.target.closest('[data-importar]')) {
      raiz.querySelector('[data-fichero]')?.click();
      return;
    }

    if (ev.target.closest('[data-subir-local]')) {
      try {
        const datos = await repo.migrarDesdeLocal();
        if (!datos) { toast('No hay datos locales que subir', 'info'); return; }
        store.hidratar(datos);
        repintar();
        toast('Datos subidos');
      } catch (e) {
        console.error(e);
        toast('No se pudieron subir los datos', 'error');
      }
      return;
    }

    if (ev.target.closest('[data-cerrar-sesion]')) {
      await repo.nube.cerrarSesion();
      location.reload();
    }
  });

  raiz.addEventListener('submit', async (ev) => {
    const form = ev.target.closest('[data-form-acceso]');
    if (!form) return;
    ev.preventDefault();
    try {
      await repo.nube.enviarEnlace(String(new FormData(form).get('email')));
      toast('Enlace enviado a tu correo', 'info', 6000);
    } catch (e) {
      console.error(e);
      toast('No se pudo enviar el enlace', 'error');
    }
  });
}
