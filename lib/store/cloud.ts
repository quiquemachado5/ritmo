"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { PERFIL_DEFECTO } from "../model/config";
import type { Comida, Composicion, Dia, Perfil } from "@/lib/model/types";
import type { Adapter, CondicionEscritura, StoreData, TipoRegistro } from "./types";

/* --------------------------------------------------- conversión de columnas */

const diaAFila = (d: Dia, userId: string) => ({
  user_id: userId,
  fecha: d.fecha,
  habitos: d.habitos || {},
  peso: d.peso ?? null,
  kcal_consumidas: d.kcalConsumidas ?? null,
  kcal_quemadas: d.kcalQuemadas ?? null,
  grasa_pct: d.grasaPct ?? null,
  notas: d.notas ?? null,
  comidas: d.comidas ?? [],
});

interface DiaFila {
  fecha: string;
  habitos: Record<string, boolean> | null;
  peso: number | null;
  kcal_consumidas: number | null;
  kcal_quemadas: number | null;
  grasa_pct: number | null;
  notas: string | null;
  comidas: Comida[] | null;
}

const diaDesdeFila = (f: DiaFila): Dia => {
  const d: Dia = { fecha: f.fecha, habitos: f.habitos || {} };
  if (f.peso !== null) d.peso = Number(f.peso);
  if (f.kcal_consumidas !== null) d.kcalConsumidas = Number(f.kcal_consumidas);
  if (f.kcal_quemadas !== null) d.kcalQuemadas = Number(f.kcal_quemadas);
  if (f.grasa_pct !== null) d.grasaPct = Number(f.grasa_pct);
  if (f.notas) d.notas = f.notas;
  if (Array.isArray(f.comidas) && f.comidas.length) d.comidas = f.comidas;
  return d;
};

const COMP_COLS: Record<string, string> = {
  peso: "peso",
  grasaPct: "grasa_pct",
  masaMuscularKg: "masa_muscular_kg",
  imc: "imc",
  grasaVisceral: "grasa_visceral",
  metabBasalKcal: "metab_basal_kcal",
  gastoDiarioKcal: "gasto_diario_kcal",
  masaOseaKg: "masa_osea_kg",
  aguaPct: "agua_pct",
  cintura: "cintura",
  cadera: "cadera",
  pecho: "pecho",
  brazo: "brazo",
  muslo: "muslo",
  cuello: "cuello",
};

const compAFila = (m: Composicion, userId: string) => {
  const fila: Record<string, unknown> = { user_id: userId, fecha: m.fecha };
  for (const [js, sql] of Object.entries(COMP_COLS)) fila[sql] = (m as unknown as Record<string, unknown>)[js] ?? null;
  return fila;
};

const compDesdeFila = (f: Record<string, unknown>): Composicion => {
  const m: Record<string, unknown> = { fecha: f.fecha };
  for (const [js, sql] of Object.entries(COMP_COLS)) {
    if (f[sql] !== null && f[sql] !== undefined) m[js] = Number(f[sql]);
  }
  return m as unknown as Composicion;
};

const PERFIL_COLS: Record<string, string> = {
  nombre: "nombre",
  alturaCm: "altura_cm",
  edad: "edad",
  sexo: "sexo",
  objetivo: "objetivo",
  pesoObjetivo: "peso_objetivo",
  kcalObjetivo: "kcal_objetivo",
  proteinaObjetivo: "proteina_objetivo",
  factorActividad: "factor_actividad",
  umbralRacha: "umbral_racha",
  onboardingCompleto: "onboarding_completo",
};

/* ------------------------------------------------------------- adaptador */

type TablaHistorial = "dias" | "composicion";
type Tabla = TablaHistorial | "perfiles";
type Fila = Record<string, unknown>;
const BLOQUE_LECTURA = 500;
const BLOQUE_CAMBIOS = 100;
const ERROR_CONFLICTO = "Conflicto: otro dispositivo cambió el registro. Recarga y revisa antes de reintentar.";

export class CloudAdapter implements Adapter {
  private revisiones = new Map<string, string>();
  private filas: Record<TablaHistorial, Map<string, Fila>> = { dias: new Map(), composicion: new Map() };
  private perfil: Fila | null = null;
  private cargado = false;
  private cerrado = false;
  private tareas: Promise<void> = Promise.resolve();
  private listeners = new Set<() => void>();
  private detenerSuscripcion: (() => void) | null = null;
  constructor(
    private client: SupabaseClient,
    private userId: string,
  ) {}

  /** Serializa lecturas y escrituras propias: una respuesta antigua nunca
   * sustituye la revisión de un guardado que ya se ha confirmado. */
  private ejecutar<T>(operacion: () => Promise<T>): Promise<T> {
    const tarea = this.tareas.then(async () => {
      if (this.cerrado) throw new Error("La cuenta ha cambiado. Abre de nuevo el registro.");
      const resultado = await operacion();
      if (this.cerrado) throw new Error("La cuenta ha cambiado. Abre de nuevo el registro.");
      return resultado;
    });
    this.tareas = tarea.then(() => {}, () => {});
    return tarea;
  }

  /** Paginación por fecha única, sin offsets que salten filas si se borran
   * registros mientras se lee. Los timestamps iguales no cortan una página. */
  private async historial(tabla: TablaHistorial, columnas: string): Promise<Fila[]> {
    const filas: Fila[] = [];
    let ultimaFecha: string | null = null;
    for (;;) {
      let consulta = this.client.from(tabla).select(columnas).eq("user_id", this.userId)
        .order("fecha").limit(BLOQUE_LECTURA);
      if (ultimaFecha) consulta = consulta.gt("fecha", ultimaFecha);
      const { data, error } = await consulta;
      if (error) throw error;
      const pagina = (data ?? []) as unknown as Fila[];
      filas.push(...pagina);
      if (pagina.length < BLOQUE_LECTURA) return filas;
      const cursor = pagina.at(-1)?.fecha;
      if (typeof cursor !== "string" || (ultimaFecha && cursor <= ultimaFecha)) throw new Error("No se pudo avanzar al leer el historial.");
      ultimaFecha = cursor;
    }
  }

  /** No depende de Realtime ni de una marca temporal máxima. El manifiesto
   * cuesta O(N) claves/revisiones; solo las filas distintas descargan comidas
   * y mediciones completas. También reconcilia borrados hechos sin conexión. */
  private async cambios(tabla: TablaHistorial): Promise<Map<string, Fila>> {
    if (!this.cargado) return new Map((await this.historial(tabla, "*")).map(f => [String(f.fecha), f]));
    const manifiesto = await this.historial(tabla, "fecha,actualizado_en");
    const anterior = this.filas[tabla];
    const siguiente = new Map<string, Fila>();
    const distintas: string[] = [];
    for (const fila of manifiesto) {
      if (typeof fila.fecha !== "string") throw new Error("El historial contiene una fecha no válida.");
      const guardada = anterior.get(fila.fecha);
      if (guardada && typeof fila.actualizado_en === "string" && guardada.actualizado_en === fila.actualizado_en) siguiente.set(fila.fecha, guardada);
      else distintas.push(fila.fecha);
    }
    for (let i = 0; i < distintas.length; i += BLOQUE_CAMBIOS) {
      const { data, error } = await this.client.from(tabla).select("*").eq("user_id", this.userId)
        .in("fecha", distintas.slice(i, i + BLOQUE_CAMBIOS)).order("fecha");
      if (error) throw error;
      // Si se borró una fila entre manifiesto y lectura, no vuelve a la caché.
      for (const fila of data ?? []) siguiente.set(fila.fecha, fila);
    }
    return siguiente;
  }

  private snapshot(): StoreData {
    const perfil: Perfil = { ...PERFIL_DEFECTO };
    if (this.perfil) {
      for (const [js, sql] of Object.entries(PERFIL_COLS)) {
        const v = this.perfil[sql];
        if (v !== null && v !== undefined) {
          (perfil as unknown as Record<string, unknown>)[js] =
            js === "sexo" || js === "objetivo" || js === "nombre"
              ? v
              : js === "onboardingCompleto"
                ? Boolean(v)
                : Number(v);
        }
      }
    }

    const dias: StoreData["dias"] = {};
    for (const fila of this.filas.dias.values()) dias[String(fila.fecha)] = diaDesdeFila(fila as unknown as DiaFila);
    // El consumidor puede editar su borrador sin mutar la caché confirmada.
    return structuredClone({
      perfil,
      dias,
      composicion: [...this.filas.composicion.values()].map(compDesdeFila).sort((a, b) => a.fecha.localeCompare(b.fecha)),
    });
  }

  load(): Promise<StoreData> {
    return this.ejecutar(async () => {
      const [perfilRes, dias, composicion] = await Promise.all([
        this.client.from("perfiles").select("*").eq("user_id", this.userId).maybeSingle(),
        this.cambios("dias"),
        this.cambios("composicion"),
      ]);
      if (perfilRes.error) throw perfilRes.error;
      // Publicación atómica: un error a mitad de página no avanza revisiones.
      this.perfil = perfilRes.data;
      this.filas = { dias, composicion };
      this.revisiones.clear();
      for (const [tabla, filas] of [["dias", dias.values()], ["composicion", composicion.values()], ["perfiles", this.perfil ? [this.perfil] : []]] as const) {
        for (const fila of filas) if (typeof fila.actualizado_en === "string") this.revisiones.set(`${tabla}:${fila.fecha ?? "perfil"}`, fila.actualizado_en);
      }
      this.cargado = true;
      return this.snapshot();
    });
  }

  private recordar(tabla: Tabla, fila: Fila) {
    const clave = `${tabla}:${fila.fecha ?? "perfil"}`;
    if (typeof fila.actualizado_en !== "string") throw new Error("No se recibió la revisión del registro guardado.");
    this.revisiones.set(clave, fila.actualizado_en);
    if (tabla === "perfiles") this.perfil = structuredClone(fila);
    else this.filas[tabla].set(String(fila.fecha), structuredClone(fila));
  }

  revisionActual(tipo: TipoRegistro, fecha?: string): string | null | undefined {
    const tabla = tipo === "dia" ? "dias" : tipo === "medicion" ? "composicion" : "perfiles";
    return this.revisiones.get(`${tabla}:${fecha ?? "perfil"}`) ?? (this.cargado ? null : undefined);
  }

  private async guardarFila(tabla: Tabla, fila: Fila, condicion?: CondicionEscritura) {
    const clave = `${tabla}:${fila.fecha ?? "perfil"}`;
    const revision = condicion?.revisionEsperada !== undefined ? condicion.revisionEsperada : this.revisiones.get(clave);
    let query;
    if (revision) {
      let update = this.client.from(tabla).update(fila).eq("user_id", this.userId).eq("actualizado_en", revision);
      if (fila.fecha) update = update.eq("fecha", fila.fecha);
      query = update.select("*").maybeSingle();
    } else query = this.client.from(tabla).insert(fila).select("*").single();
    const { data, error } = await query;
    if (error?.code === "23505" || (!error && !data)) throw new Error(ERROR_CONFLICTO);
    if (error) throw error;
    if (!data) throw new Error("No se confirmó el guardado. Recarga antes de reintentar.");
    this.recordar(tabla, data);
  }

  guardarDia(dia: Dia, condicion?: CondicionEscritura) {
    const fila = diaAFila(structuredClone(dia), this.userId);
    return this.ejecutar(() => this.guardarFila("dias", fila, condicion));
  }
  private async borrarFila(tabla: TablaHistorial, fecha: string, condicion?: CondicionEscritura) {
    const clave = `${tabla}:${fecha}`;
    const revision = condicion?.revisionEsperada !== undefined ? condicion.revisionEsperada : this.revisiones.get(clave);
    if (!revision) {
      // Sin una revisión conocida no se borra a ciegas una fila que pudo
      // aparecer en otro dispositivo. Si ya no existe, el borrado es idempotente.
      const { data, error } = await this.client.from(tabla).select("fecha").eq("user_id", this.userId).eq("fecha", fecha).maybeSingle();
      if (error) throw error;
      if (data) throw new Error(ERROR_CONFLICTO);
      this.revisiones.delete(clave);
      this.filas[tabla].delete(fecha);
      return;
    }
    let consulta = this.client.from(tabla).delete().eq("user_id", this.userId).eq("fecha", fecha);
    if (revision) consulta = consulta.eq("actualizado_en", revision);
    const { data, error } = await consulta.select("fecha");
    if (error) throw error;
    if (revision && !data?.length) throw new Error(ERROR_CONFLICTO);
    this.revisiones.delete(clave);
    this.filas[tabla].delete(fecha);
  }
  borrarDia(fecha: string, condicion?: CondicionEscritura) {
    return this.ejecutar(() => this.borrarFila("dias", fecha, condicion));
  }
  guardarMedicion(m: Composicion, condicion?: CondicionEscritura) {
    const fila = compAFila(structuredClone(m), this.userId);
    return this.ejecutar(() => this.guardarFila("composicion", fila, condicion));
  }
  borrarMedicion(fecha: string, condicion?: CondicionEscritura) {
    return this.ejecutar(() => this.borrarFila("composicion", fecha, condicion));
  }
  private perfilAFila(perfil: Perfil): Fila {
    // Escritura del perfil con revisión: null vacía los campos opcionales
    // ausentes, de modo que vaciar un objetivo (p. ej. proteína) sí se guarde
    // en vez de conservar el valor antiguo.
    const fila: Record<string, unknown> = { user_id: this.userId };
    for (const [js, sql] of Object.entries(PERFIL_COLS)) {
      const v = (perfil as unknown as Record<string, unknown>)[js];
      fila[sql] = v === undefined ? null : v;
    }
    return fila;
  }
  guardarPerfil(perfil: Perfil, condicion?: CondicionEscritura) {
    const fila = this.perfilAFila(structuredClone(perfil));
    return this.ejecutar(() => this.guardarFila("perfiles", fila, condicion));
  }
  private exigirCuentaAbierta() {
    if (this.cerrado) throw new Error("La cuenta ha cambiado. Se ha detenido el borrado.");
  }
  private async borrarBackups() {
    this.exigirCuentaAbierta();
    const bucket = this.client.storage.from("backups");
    const { data, error } = await bucket.list(this.userId, { limit: 1000 });
    this.exigirCuentaAbierta();
    if (error) {
      // Instalaciones antiguas pueden no tener aún el bucket: en ese caso no
      // existe ninguna copia que eliminar.
      if (/bucket.*not found/i.test(error.message)) return;
      throw error;
    }
    const rutas = (data || []).map((archivo) => `${this.userId}/${archivo.name}`);
    if (!rutas.length) return;
    const { error: removeError } = await bucket.remove(rutas);
    this.exigirCuentaAbierta();
    if (removeError) throw removeError;
  }
  borrarTodo() {
    return this.ejecutar(async () => {
      const { data: usuario, error: errorUsuario } = await this.client.auth.getUser();
      this.exigirCuentaAbierta();
      if (errorUsuario) throw errorUsuario;
      if (usuario.user?.id !== this.userId) throw new Error("La cuenta ha cambiado. No se ha iniciado el borrado.");
      const { data: sesion, error: errorSesion } = await this.client.auth.getSession();
      this.exigirCuentaAbierta();
      if (errorSesion) throw errorSesion;
      if (sesion.session?.user.id !== this.userId) throw new Error("La cuenta ha cambiado. No se ha iniciado el borrado.");
      // Los RPC borran por auth.uid(), no reciben user_id. Su token se fija
      // aquí para que el singleton no use el de otra cuenta entre dos awaits.
      const authorization = `Bearer ${sesion.session.access_token}`;
      // Incluso si una eliminación falla, la siguiente lectura reconciliará
      // todo; nunca conserva una caché que afirme que el borrado fue atómico.
      this.cargado = false;
      for (const rpc of ["clear_my_nutrition_data", "clear_my_model_audit"]) {
        this.exigirCuentaAbierta();
        const { error } = await this.client.rpc(rpc).setHeader("Authorization", authorization);
        this.exigirCuentaAbierta();
        // Instalaciones previas pueden no tener estos RPC. Solo ese caso.
        if (error && error.code !== "PGRST202") throw error;
      }
      for (const tabla of ["dias", "composicion", "user_prefs", "perfiles"]) {
        this.exigirCuentaAbierta();
        const { error } = await this.client.from(tabla).delete().eq("user_id", this.userId).setHeader("Authorization", authorization);
        this.exigirCuentaAbierta();
        if (error) throw error;
      }
      await this.borrarBackups();
      this.exigirCuentaAbierta();
      this.revisiones.clear();
      this.filas = { dias: new Map(), composicion: new Map() };
      this.perfil = null;
    });
  }

  sembrar(data: StoreData) {
    const copia = structuredClone(data);
    return this.ejecutar(async () => {
      await this.guardarFila("perfiles", this.perfilAFila(copia.perfil));
      for (const [tabla, filas] of [
        ["dias", Object.values(copia.dias).map(d => diaAFila(d, this.userId))],
        ["composicion", copia.composicion.map(m => compAFila(m, this.userId))],
      ] as const) {
        for (let i = 0; i < filas.length; i += 200) {
          const { data: guardadas, error } = await this.client.from(tabla)
            .upsert(filas.slice(i, i + 200), { onConflict: "user_id,fecha" }).select("*");
          if (error) throw error;
          for (const fila of guardadas ?? []) this.recordar(tabla, fila);
        }
      }
    });
  }

  subscribe(cb: () => void): () => void {
    if (this.cerrado) return () => {};
    this.listeners.add(cb);
    if (!this.detenerSuscripcion) this.iniciarSuscripcion();
    return () => {
      this.listeners.delete(cb);
      if (!this.listeners.size) {
        this.detenerSuscripcion?.();
        this.detenerSuscripcion = null;
      }
    };
  }

  private iniciarSuscripcion() {
    const avisar = () => {
      if (this.cerrado || (typeof navigator !== "undefined" && !navigator.onLine)) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      this.listeners.forEach(cb => cb());
    };
    const filtro = `user_id=eq.${this.userId}`;
    const canal = this.client
      .channel(`ritmo-cambios:${this.userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "dias", filter: filtro }, avisar)
      .on("postgres_changes", { event: "*", schema: "public", table: "composicion", filter: filtro }, avisar)
      .on("postgres_changes", { event: "*", schema: "public", table: "perfiles", filter: filtro }, avisar)
      .subscribe(status => { if (status === "SUBSCRIBED") avisar(); });
    // Realtime puede no estar publicado o perder eventos. El sondeo visible
    // y la vuelta a foco/red reparan también borrados remotos, sin migración.
    const timer = setInterval(avisar, 60_000);
    if (typeof window !== "undefined") {
      window.addEventListener("online", avisar);
      window.addEventListener("focus", avisar);
    }
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", avisar);
    this.detenerSuscripcion = () => {
      clearInterval(timer);
      void this.client.removeChannel(canal);
      if (typeof window !== "undefined") {
        window.removeEventListener("online", avisar);
        window.removeEventListener("focus", avisar);
      }
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", avisar);
    };
  }

  dispose() {
    this.cerrado = true;
    this.detenerSuscripcion?.();
    this.detenerSuscripcion = null;
    this.listeners.clear();
    this.revisiones.clear();
    this.filas = { dias: new Map(), composicion: new Map() };
    this.perfil = null;
  }
}
