/* ============================================================================
   REPOSITORIO — fachada única sobre los adaptadores.

   El resto de la aplicación habla SOLO con esta clase y nunca con Supabase ni
   con localStorage directamente. Eso es lo que permite cambiar de backend sin
   tocar una línea de interfaz.

   Reglas de arranque:
     1. Si hay credenciales de Supabase y sesión activa → modo 'nube'.
     2. Si hay credenciales pero no sesión → se pide acceso (modo 'anonimo').
     3. Sin credenciales, o si la nube falla → modo 'local'.
   En cualquier modo, si el almacén está vacío se siembra el histórico inicial.
   ========================================================================= */

import { AdaptadorLocal } from './local-adapter.js';
import { AdaptadorSupabase, supabaseConfigurado } from './supabase-adapter.js';
import { SEED_DIAS, SEED_COMPOSICION } from '../seed.js';
import { PERFIL_DEFECTO } from '../config.js';

export class Repositorio {
  constructor() {
    this.adaptador = null;
    this.nube = null;
    this.modo = 'local';
    this.error = null;
  }

  /**
   * Prepara el almacén y devuelve el estado inicial.
   * @returns {Promise<{modo:string, datos:object|null}>}
   */
  async iniciar() {
    if (supabaseConfigurado()) {
      this.nube = new AdaptadorSupabase();
      try {
        const conSesion = await this.nube.iniciar();
        if (conSesion) {
          this.adaptador = this.nube;
          this.modo = 'nube';
        } else {
          // Credenciales presentes pero sin sesión: la interfaz pedirá acceso.
          this.modo = 'anonimo';
          return { modo: this.modo, datos: null };
        }
      } catch (e) {
        console.warn('Supabase no disponible, se continúa en local', e);
        this.error = e;
        this.nube = null;
      }
    }

    if (!this.adaptador) {
      this.adaptador = new AdaptadorLocal();
      this.modo = 'local';
    }

    const datos = await this._cargarOSembrar();
    return { modo: this.modo, datos };
  }

  /** Fuerza el modo local (el usuario elige no usar la nube). */
  async usarLocal() {
    this.adaptador = new AdaptadorLocal();
    this.modo = 'local';
    const datos = await this._cargarOSembrar();
    return { modo: this.modo, datos };
  }

  /** Tras validar el enlace mágico, pasa a usar la nube. */
  async usarNube() {
    if (!this.nube || !this.nube.autenticado) throw new Error('Sin sesión de Supabase');
    this.adaptador = this.nube;
    this.modo = 'nube';
    const datos = await this._cargarOSembrar();
    return { modo: this.modo, datos };
  }

  async _cargarOSembrar() {
    const vacio = !(await this.adaptador.hayDatos());
    if (vacio) {
      return this.adaptador.sembrar({
        dias: SEED_DIAS,
        composicion: SEED_COMPOSICION,
        perfil: PERFIL_DEFECTO,
      });
    }
    return this.adaptador.cargar();
  }

  /**
   * Sube al almacén activo los datos que haya guardados en localStorage.
   * Es la migración de "este dispositivo" → "la nube" tras iniciar sesión.
   */
  async migrarDesdeLocal() {
    const local = new AdaptadorLocal();
    const datos = await local.cargar();
    const dias = Object.values(datos.dias);
    if (dias.length === 0 && datos.composicion.length === 0) return null;
    return this.adaptador.sembrar({
      dias,
      composicion: datos.composicion,
      perfil: datos.perfil,
    });
  }

  /* --------------------------------------------------------- delegación */

  cargar()                  { return this.adaptador.cargar(); }
  guardarDia(dia)           { return this.adaptador.guardarDia(dia); }
  borrarDia(fecha)          { return this.adaptador.borrarDia(fecha); }
  guardarMedicion(medicion) { return this.adaptador.guardarMedicion(medicion); }
  borrarMedicion(fecha)     { return this.adaptador.borrarMedicion(fecha); }
  guardarPerfil(perfil)     { return this.adaptador.guardarPerfil(perfil); }
  suscribir(callback)       { return this.adaptador.suscribir(callback); }
}
