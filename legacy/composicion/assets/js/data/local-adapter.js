/* ============================================================================
   ADAPTADOR LOCAL — persistencia en localStorage.

   Es el modo por defecto y el respaldo cuando Supabase no está configurado o
   no responde. Implementa el mismo contrato que `supabase-adapter.js`, de modo
   que el resto de la aplicación no sabe cuál de los dos está activo.

   También propaga cambios entre pestañas del mismo navegador mediante el
   evento `storage`, que solo se dispara en las pestañas que NO escribieron.
   ========================================================================= */

import { CLAVE_LOCAL, PERFIL_DEFECTO } from '../config.js';

const VERSION = 2;

function vacio() {
  return { version: VERSION, perfil: { ...PERFIL_DEFECTO }, dias: {}, composicion: [], actualizado: 0 };
}

export class AdaptadorLocal {
  constructor(clave = CLAVE_LOCAL) {
    this.clave = clave;
    this.nombre = 'local';
    this.oyentes = new Set();
    this._onStorage = this._onStorage.bind(this);
    window.addEventListener('storage', this._onStorage);
  }

  _leer() {
    try {
      const bruto = localStorage.getItem(this.clave);
      if (!bruto) return vacio();
      const datos = JSON.parse(bruto);
      return {
        version: VERSION,
        perfil: { ...PERFIL_DEFECTO, ...(datos.perfil || {}) },
        dias: datos.dias || {},
        composicion: Array.isArray(datos.composicion) ? datos.composicion : [],
        actualizado: datos.actualizado || 0,
      };
    } catch {
      // Un JSON corrupto no debe dejar la aplicación inservible.
      return vacio();
    }
  }

  _escribir(datos) {
    datos.actualizado = Date.now();
    try {
      localStorage.setItem(this.clave, JSON.stringify(datos));
      return true;
    } catch (e) {
      // Cuota agotada o modo privado: informamos, no rompemos.
      console.warn('No se pudo escribir en localStorage', e);
      return false;
    }
  }

  _onStorage(evento) {
    if (evento.key !== this.clave) return;
    const datos = this._leer();
    this.oyentes.forEach((cb) => cb(datos));
  }

  async cargar() {
    return this._leer();
  }

  async hayDatos() {
    const d = this._leer();
    return Object.keys(d.dias).length > 0 || d.composicion.length > 0;
  }

  async sembrar({ dias, composicion, perfil }) {
    const datos = vacio();
    datos.perfil = { ...PERFIL_DEFECTO, ...(perfil || {}) };
    for (const dia of dias || []) datos.dias[dia.fecha] = dia;
    datos.composicion = [...(composicion || [])];
    this._escribir(datos);
    return datos;
  }

  async guardarDia(dia) {
    const datos = this._leer();
    datos.dias[dia.fecha] = dia;
    this._escribir(datos);
  }

  async borrarDia(fecha) {
    const datos = this._leer();
    delete datos.dias[fecha];
    this._escribir(datos);
  }

  async guardarMedicion(medicion) {
    const datos = this._leer();
    const i = datos.composicion.findIndex((m) => m.fecha === medicion.fecha);
    if (i >= 0) datos.composicion[i] = { ...datos.composicion[i], ...medicion };
    else datos.composicion.push(medicion);
    datos.composicion.sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
    this._escribir(datos);
  }

  async borrarMedicion(fecha) {
    const datos = this._leer();
    datos.composicion = datos.composicion.filter((m) => m.fecha !== fecha);
    this._escribir(datos);
  }

  async guardarPerfil(perfil) {
    const datos = this._leer();
    datos.perfil = { ...datos.perfil, ...perfil };
    this._escribir(datos);
  }

  async borrarTodo() {
    localStorage.removeItem(this.clave);
  }

  suscribir(callback) {
    this.oyentes.add(callback);
    return () => this.oyentes.delete(callback);
  }
}
