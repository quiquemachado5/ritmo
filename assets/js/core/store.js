/* ============================================================================
   STORE — estado reactivo mínimo.

   Un único objeto de estado, suscripciones y acciones. Las acciones aplican el
   cambio en memoria y notifican de inmediato (la interfaz responde al instante)
   y después persisten en segundo plano. Si la persistencia falla, se revierte y
   se avisa: nunca se muestra como guardado algo que no lo está.
   ========================================================================= */

import { PERFIL_DEFECTO } from '../config.js';

function clonar(v) {
  return typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v));
}

/** ¿El día quedó sin ningún dato? Entonces se borra en lugar de guardar un hueco. */
function diaVacio(dia) {
  if (!dia) return true;
  const sinHabitos = !Object.values(dia.habitos || {}).some((v) => v === true);
  const sinNumeros = ['peso', 'kcalConsumidas', 'kcalQuemadas', 'grasaPct']
    .every((k) => dia[k] === undefined || dia[k] === null);
  const sinNotas = !dia.notas || !String(dia.notas).trim();
  return sinHabitos && sinNumeros && sinNotas;
}

export class Store {
  /** @param {import('../data/repository.js').Repositorio} repo */
  constructor(repo) {
    this.repo = repo;
    this.estado = {
      perfil: { ...PERFIL_DEFECTO },
      dias: {},
      composicion: [],
      modo: 'local',
      sincronizando: false,
      error: null,
      // Se incrementa en cada notificación. `analytics` lo usa para saber
      // cuándo invalidar sus cálculos memorizados, ya que el objeto de estado
      // se muta en sitio y su identidad no cambia nunca.
      version: 0,
    };
    this.oyentes = new Set();
    this.alError = null; // callback que la interfaz instala para mostrar avisos
  }

  /* ------------------------------------------------------ suscripciones */

  suscribir(callback) {
    this.oyentes.add(callback);
    return () => this.oyentes.delete(callback);
  }

  notificar() {
    this.estado.version++;
    this.oyentes.forEach((cb) => cb(this.estado));
  }

  /** Sustituye los datos (carga inicial o cambio llegado desde la nube). */
  hidratar(datos, modo) {
    if (datos) {
      this.estado.perfil = { ...PERFIL_DEFECTO, ...(datos.perfil || {}) };
      this.estado.dias = datos.dias || {};
      this.estado.composicion = Array.isArray(datos.composicion) ? datos.composicion : [];
    }
    if (modo) this.estado.modo = modo;
    this.notificar();
  }

  /**
   * Ejecuta una escritura de forma optimista.
   * @param {Function} aplicar  muta el estado en memoria
   * @param {Function} persistir devuelve una promesa
   */
  async _escribir(aplicar, persistir, mensajeError) {
    const anterior = {
      dias: clonar(this.estado.dias),
      composicion: clonar(this.estado.composicion),
      perfil: clonar(this.estado.perfil),
    };
    aplicar();
    this.estado.sincronizando = true;
    this.notificar();

    try {
      await persistir();
      this.estado.error = null;
    } catch (e) {
      // Revertimos: el estado visible vuelve a coincidir con lo persistido.
      this.estado.dias = anterior.dias;
      this.estado.composicion = anterior.composicion;
      this.estado.perfil = anterior.perfil;
      this.estado.error = e;
      console.error(mensajeError, e);
      if (this.alError) this.alError(mensajeError);
    } finally {
      this.estado.sincronizando = false;
      this.notificar();
    }
  }

  /* ----------------------------------------------------------- lectores */

  dia(fecha) {
    return this.estado.dias[fecha] || { fecha, habitos: {} };
  }

  medicion(fecha) {
    return this.estado.composicion.find((m) => m.fecha === fecha) || null;
  }

  /* ----------------------------------------------------------- acciones */

  /** Activa o desactiva un hábito de un día. */
  async alternarHabito(fecha, clave) {
    const actual = this.dia(fecha);
    const siguiente = clonar(actual);
    siguiente.habitos = { ...(siguiente.habitos || {}) };
    if (siguiente.habitos[clave] === true) delete siguiente.habitos[clave];
    else siguiente.habitos[clave] = true;

    const borrar = diaVacio(siguiente);
    await this._escribir(
      () => {
        if (borrar) delete this.estado.dias[fecha];
        else this.estado.dias[fecha] = siguiente;
      },
      () => (borrar ? this.repo.borrarDia(fecha) : this.repo.guardarDia(siguiente)),
      'No se pudo guardar el hábito.',
    );
  }

  /**
   * Actualiza los campos numéricos y las notas de un día.
   * `null` en un campo lo elimina.
   */
  async actualizarDia(fecha, campos) {
    const siguiente = clonar(this.dia(fecha));
    siguiente.fecha = fecha;
    siguiente.habitos = siguiente.habitos || {};

    for (const [k, v] of Object.entries(campos)) {
      if (v === null || v === undefined || v === '') delete siguiente[k];
      else siguiente[k] = v;
    }

    const borrar = diaVacio(siguiente);
    await this._escribir(
      () => {
        if (borrar) delete this.estado.dias[fecha];
        else this.estado.dias[fecha] = siguiente;
      },
      () => (borrar ? this.repo.borrarDia(fecha) : this.repo.guardarDia(siguiente)),
      'No se pudieron guardar los datos del día.',
    );
  }

  async borrarDia(fecha) {
    await this._escribir(
      () => { delete this.estado.dias[fecha]; },
      () => this.repo.borrarDia(fecha),
      'No se pudo borrar el día.',
    );
  }

  /**
   * Guarda una medición de composición. El peso se refleja también en el día
   * correspondiente: son el mismo hecho, y así el historial de peso es único.
   */
  async guardarMedicion(medicion) {
    const existente = this.medicion(medicion.fecha);
    const fusionada = { ...(existente || {}), ...medicion };

    await this._escribir(
      () => {
        const i = this.estado.composicion.findIndex((m) => m.fecha === medicion.fecha);
        if (i >= 0) this.estado.composicion[i] = fusionada;
        else this.estado.composicion.push(fusionada);
        this.estado.composicion.sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
      },
      () => this.repo.guardarMedicion(fusionada),
      'No se pudo guardar la medición.',
    );

    if (typeof fusionada.peso === 'number') {
      await this.actualizarDia(medicion.fecha, { peso: fusionada.peso });
    }
  }

  async borrarMedicion(fecha) {
    await this._escribir(
      () => { this.estado.composicion = this.estado.composicion.filter((m) => m.fecha !== fecha); },
      () => this.repo.borrarMedicion(fecha),
      'No se pudo borrar la medición.',
    );
  }

  async actualizarPerfil(campos) {
    const siguiente = { ...this.estado.perfil, ...campos };
    await this._escribir(
      () => { this.estado.perfil = siguiente; },
      () => this.repo.guardarPerfil(siguiente),
      'No se pudo guardar el perfil.',
    );
  }

  /** Exporta todo el contenido para copia de seguridad. */
  exportar() {
    return {
      version: 2,
      exportado: new Date().toISOString(),
      perfil: this.estado.perfil,
      dias: this.estado.dias,
      composicion: this.estado.composicion,
    };
  }

  /** Importa una copia de seguridad, fusionando con lo existente. */
  async importar(datos) {
    if (!datos || typeof datos !== 'object') throw new Error('Archivo no válido');
    const dias = { ...this.estado.dias, ...(datos.dias || {}) };

    const porFecha = new Map(this.estado.composicion.map((m) => [m.fecha, m]));
    for (const m of datos.composicion || []) {
      porFecha.set(m.fecha, { ...(porFecha.get(m.fecha) || {}), ...m });
    }
    const composicion = [...porFecha.values()].sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
    const perfil = { ...this.estado.perfil, ...(datos.perfil || {}) };

    this.estado.dias = dias;
    this.estado.composicion = composicion;
    this.estado.perfil = perfil;
    this.notificar();

    await this.repo.adaptador.sembrar({ dias: Object.values(dias), composicion, perfil });
    this.hidratar(await this.repo.cargar());
  }
}
