/* ============================================================================
   TOAST — avisos efímeros en la esquina inferior.
   ========================================================================= */

import { esc } from '../core/format.js';

let contenedor = null;

function raiz() {
  if (!contenedor) {
    contenedor = document.createElement('div');
    contenedor.className = 'toasts';
    contenedor.setAttribute('role', 'status');
    contenedor.setAttribute('aria-live', 'polite');
    document.body.appendChild(contenedor);
  }
  return contenedor;
}

/**
 * @param {string} mensaje
 * @param {'ok'|'error'|'info'} tipo
 */
export function toast(mensaje, tipo = 'ok', ms = 3200) {
  const el = document.createElement('div');
  el.className = `toast toast--${tipo}`;
  el.innerHTML = `<span class="toast__dot"></span><span>${esc(mensaje)}</span>`;
  raiz().appendChild(el);

  const cerrar = () => {
    el.classList.add('toast--out');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  };
  const temporizador = setTimeout(cerrar, ms);
  el.addEventListener('click', () => { clearTimeout(temporizador); cerrar(); });
}
