/* ============================================================================
   MAIN — arranque, enrutado y ciclo de render.

   Responsabilidades:
     · construir repositorio y store
     · resolver el acceso (nube o local) antes de pintar nada
     · enrutar por hash y repintar solo la vista activa
   ========================================================================= */

import { Repositorio } from './data/repository.js';
import { Store } from './core/store.js';
import { toast } from './ui/toast.js';

import { renderDashboard } from './ui/dashboard.js';
import { renderRegistro, conectarRegistro } from './ui/registro.js';
import { renderComposicion, conectarComposicion } from './ui/composicion.js';
import { renderAjustes, conectarAjustes } from './ui/ajustes.js';

const VISTAS = ['panel', 'registro', 'composicion', 'ajustes'];

const repo = new Repositorio();
const store = new Store(repo);

const el = {
  app: document.getElementById('app'),
  nav: document.getElementById('nav'),
  pill: document.getElementById('navPill'),
  sync: document.getElementById('sync'),
  syncTexto: document.getElementById('syncTexto'),
  gate: document.getElementById('gate'),
};

let vistaActiva = 'panel';
let repintarPendiente = false;

/* ------------------------------------------------------------------ RUTAS */

function vistaDesdeHash() {
  const clave = location.hash.replace('#', '');
  return VISTAS.includes(clave) ? clave : 'panel';
}

function contenedor(vista) {
  return document.getElementById(`view-${vista}`);
}

/* ---------------------------------------------------------------- RENDER */

const RENDERIZADORES = {
  panel: (estado) => renderDashboard(estado),
  registro: (estado) => renderRegistro(estado),
  composicion: (estado) => renderComposicion(estado),
  ajustes: (estado) => renderAjustes(estado, repo),
};

/** Repinta la vista activa. Se agrupa por frame para no repetir trabajo. */
function repintar() {
  if (repintarPendiente) return;
  repintarPendiente = true;
  requestAnimationFrame(() => {
    repintarPendiente = false;
    const destino = contenedor(vistaActiva);
    if (destino) destino.innerHTML = RENDERIZADORES[vistaActiva](store.estado);
    actualizarSync();
  });
}

function activarVista(vista, { desplazar = false } = {}) {
  vistaActiva = vista;

  for (const v of VISTAS) {
    contenedor(v).classList.toggle('is-active', v === vista);
  }
  el.nav.querySelectorAll('[data-vista]').forEach((btn) => {
    const activa = btn.dataset.vista === vista;
    btn.dataset.active = String(activa);
    btn.toggleAttribute('aria-current', activa);
  });

  colocarPill();
  repintar();
  if (desplazar) window.scrollTo({ top: 0, behavior: 'smooth' });
}

/** Coloca el indicador deslizante bajo la pestaña activa. */
function colocarPill() {
  const activo = el.nav.querySelector('[data-active="true"]');
  // En móvil la navegación es una barra inferior sin indicador deslizante.
  if (!activo || getComputedStyle(el.pill).display === 'none') return;
  el.pill.style.width = `${activo.offsetWidth}px`;
  el.pill.style.transform = `translateX(${activo.offsetLeft - 4}px)`;
}

/* ------------------------------------------------------- ESTADO DE SYNC */

const ETIQUETAS_SYNC = {
  nube: 'Sincronizado',
  local: 'Este dispositivo',
  error: 'Sin conexión',
  busy: 'Guardando…',
};

function actualizarSync() {
  const { modo, sincronizando, error } = store.estado;
  let estado;
  if (sincronizando) estado = 'busy';
  else if (error) estado = 'error';
  else estado = modo === 'nube' ? 'ok' : 'local';

  el.sync.dataset.state = estado;
  el.syncTexto.textContent = sincronizando ? ETIQUETAS_SYNC.busy
    : error ? ETIQUETAS_SYNC.error
    : ETIQUETAS_SYNC[modo] || ETIQUETAS_SYNC.local;
}

/* ------------------------------------------------------- PUERTA DE ACCESO */

/**
 * Se muestra cuando hay Supabase configurado pero no hay sesión.
 * Siempre ofrece continuar en local: la app nunca queda bloqueada.
 */
function pedirAcceso() {
  return new Promise((resolver) => {
    const focoPrevio = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const cerrar = (modo = 'local') => {
      el.gate.classList.add('hidden');
      el.gate.removeEventListener('keydown', gestionarTeclado);
      focoPrevio?.focus();
      resolver(modo);
    };
    const gestionarTeclado = (ev) => {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        cerrar();
        return;
      }
      if (ev.key !== 'Tab') return;
      const foco = [...el.gate.querySelectorAll('button:not([disabled]), input:not([disabled])')];
      if (foco.length === 0) return;
      const primero = foco[0];
      const ultimo = foco[foco.length - 1];
      if (ev.shiftKey && document.activeElement === primero) {
        ev.preventDefault();
        ultimo.focus();
      } else if (!ev.shiftKey && document.activeElement === ultimo) {
        ev.preventDefault();
        primero.focus();
      }
    };

    el.gate.classList.remove('hidden');
    el.gate.innerHTML = `
      <div class="modal__panel">
        <p class="label">Acceso</p>
        <h2 class="modal__title page-title">Entra con tu correo</h2>
        <p style="color:var(--ink-3);font-size:var(--fs-sm);margin:0 0 22px">
          Te enviamos un enlace de un solo uso. Sin contraseñas que recordar ni que
          almacenar. Al entrar, tus datos se sincronizan entre todos tus dispositivos.
        </p>
        <form data-acceso class="stack">
          <label class="field">
            <span class="field__label">Correo electrónico</span>
            <input class="input" type="email" name="email" required autocomplete="email"
              placeholder="tu@correo.com" style="font-family:var(--font);font-size:1rem">
          </label>
          <button type="submit" class="btn btn--primary btn--block">Enviarme el enlace</button>
        </form>
        <div class="row" style="margin-top:20px;justify-content:center">
          <button type="button" class="btn btn--ghost btn--sm" data-local>
            Continuar solo en este dispositivo
          </button>
        </div>
      </div>`;

    el.gate.querySelector('[data-acceso]').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const boton = ev.target.querySelector('button[type="submit"]');
      boton.disabled = true;
      boton.textContent = 'Enviando…';
      try {
        await repo.nube.enviarEnlace(String(new FormData(ev.target).get('email')));
        el.gate.querySelector('.modal__panel').innerHTML = `
          <p class="label">Revisa tu correo</p>
          <h2 class="modal__title page-title">Enlace enviado</h2>
          <p style="color:var(--ink-3);font-size:var(--fs-sm)">
            Ábrelo en este mismo dispositivo y volverás aquí con la sesión iniciada.
            Puedes cerrar esta pestaña mientras tanto.
          </p>
          <button type="button" class="btn btn--block" style="margin-top:18px" data-local>
            Mientras tanto, usar este dispositivo
          </button>`;
        el.gate.querySelector('[data-local]').addEventListener('click', () => cerrar());
        el.gate.querySelector('[data-local]')?.focus();
      } catch (e) {
        console.error(e);
        boton.disabled = false;
        boton.textContent = 'Enviarme el enlace';
        toast('No se pudo enviar el enlace de acceso', 'error');
      }
    });

    el.gate.querySelector('[data-local]').addEventListener('click', () => cerrar());
    el.gate.addEventListener('keydown', gestionarTeclado);
    el.gate.querySelector('input[name="email"]')?.focus();
  });
}

/* ---------------------------------------------------------------- ARRANQUE */

async function arrancar() {
  // Los avisos de error del store se muestran como toast.
  store.alError = (mensaje) => toast(mensaje, 'error');

  let resultado;
  try {
    resultado = await repo.iniciar();
  } catch (e) {
    console.error('Fallo al iniciar el repositorio', e);
    resultado = await repo.usarLocal();
    toast('No se pudo conectar con la nube; trabajando en local', 'error', 5000);
  }

  if (resultado.modo === 'anonimo') {
    await pedirAcceso();
    resultado = await repo.usarLocal();
  }

  store.hidratar(resultado.datos, resultado.modo);

  // Cambios llegados del otro lado (otra pestaña u otro dispositivo).
  repo.suscribir((datos) => store.hidratar(datos));

  // Conectamos los eventos una vez; la delegación sobrevive a los repintados.
  conectarRegistro(contenedor('registro'), store, repintar);
  conectarComposicion(contenedor('composicion'), store, repintar);
  conectarAjustes(contenedor('ajustes'), store, repo, repintar);

  store.suscribir(() => repintar());

  el.nav.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-vista]');
    if (!btn) return;
    location.hash = btn.dataset.vista;
  });

  window.addEventListener('hashchange', () => activarVista(vistaDesdeHash(), { desplazar: true }));
  window.addEventListener('resize', colocarPill);

  document.getElementById('cargando')?.remove();
  el.app.classList.remove('hidden');
  activarVista(vistaDesdeHash());

  // El indicador se recoloca cuando la tipografía web termina de cargar.
  if (document.fonts?.ready) document.fonts.ready.then(colocarPill);
}

arrancar().catch((e) => {
  console.error('Error fatal en el arranque', e);
  const shell = document.createElement('div');
  shell.className = 'shell';
  shell.style.paddingTop = '80px';
  const card = document.createElement('div');
  card.className = 'card';
  const titulo = document.createElement('h1');
  titulo.className = 'page-title';
  titulo.textContent = 'Algo ha fallado al arrancar';
  const detalle = document.createElement('p');
  detalle.style.color = 'var(--ink-3)';
  detalle.textContent = e instanceof Error ? e.message : 'Error desconocido';
  const ayuda = document.createElement('p');
  ayuda.style.color = 'var(--ink-4)';
  ayuda.style.fontSize = '0.85rem';
  ayuda.textContent = 'Revisa la consola del navegador para ver el detalle completo.';
  card.append(titulo, detalle, ayuda);
  shell.append(card);
  document.body.replaceChildren(shell);
});
