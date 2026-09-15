import type { Composicion, Dia, Perfil } from "@/lib/model/types";
import type { Adapter, StoreData } from "./types";
import { leerBackupLocal } from "../backup";
import { registrarDiagnostico } from "../observability";
import { analizarImportacion } from "./import";
import { PERFIL_DEFECTO } from "../model/config";
import { fechaValida, jsonSeguro, objeto } from "./validation";

type Op =
  | { type: "guardarDia"; payload: Dia }
  | { type: "borrarDia"; payload: string }
  | { type: "guardarMedicion"; payload: Composicion }
  | { type: "borrarMedicion"; payload: string }
  | { type: "guardarPerfil"; payload: Perfil };
type Entrada = Op & { id: string; origen?: string; bloqueada?: boolean; revision: number; revisionRemota?: string | null };
export interface DetalleCola {
  id: string;
  tipo: "día" | "medición" | "perfil";
  fecha?: string;
  bloqueada: boolean;
}
export interface EstadoCola { pendientes: number; requiereAtencion: boolean; sincronizando: boolean; ultimaSincronizacion?: string; detalles: DetalleCola[] }
const listeners = new Set<(estado: EstadoCola) => void>();
let estadoCola: EstadoCola = { pendientes: 0, requiereAtencion: false, sincronizando: false, detalles: [] };
let activo: QueuedAdapter | null = null;

export function onColaCambia(cb: (estado: EstadoCola) => void): () => void {
  listeners.add(cb);
  cb(estadoCola);
  return () => { listeners.delete(cb); };
}
export async function reintentarCola(id?: string): Promise<void> { await activo?.reintentar(id); }
function claveOp(op: Op): string {
  if (op.type === "guardarPerfil") return "perfil";
  return (op.type.includes("Dia") ? "dia:" : "med:") + (typeof op.payload === "string" ? op.payload : op.payload.fecha);
}
function offline(): boolean { return typeof navigator !== "undefined" && !navigator.onLine; }
function esErrorDeRed(e: unknown): boolean {
  const mensaje = e instanceof Error ? e.message : e && typeof e === "object" && "message" in e ? String(e.message) : String(e);
  return offline() || /failed to fetch|fetch failed|network|timeout|load failed/i.test(mensaje);
}
const BASE_VALIDACION: StoreData = { perfil: PERFIL_DEFECTO, dias: {}, composicion: [] };
function operacionValida(valor: unknown): boolean {
  if (!objeto(valor) || !jsonSeguro(valor)) return false;
  if (valor.id !== undefined && (typeof valor.id !== "string" || !valor.id)) return false;
  if (valor.origen !== undefined && (typeof valor.origen !== "string" || !valor.origen)) return false;
  if (valor.bloqueada !== undefined && typeof valor.bloqueada !== "boolean") return false;
  if (valor.revisionRemota !== undefined && valor.revisionRemota !== null && typeof valor.revisionRemota !== "string") return false;
  const payload = valor.payload;
  switch (valor.type) {
    case "borrarDia": case "borrarMedicion": return fechaValida(payload);
    case "guardarDia": return objeto(payload) && fechaValida(payload.fecha) && analizarImportacion({ dias: { [payload.fecha]: payload } }, BASE_VALIDACION).valido;
    case "guardarMedicion": return analizarImportacion({ composicion: [payload] }, BASE_VALIDACION).valido;
    case "guardarPerfil": return objeto(payload) && analizarImportacion({ perfil: payload }, BASE_VALIDACION).valido;
    default: return false;
  }
}
function aplicarOperaciones(data: StoreData, ops: Op[]): StoreData {
  const copia = structuredClone(data);
  for (const op of ops) {
    switch (op.type) {
      case "guardarDia": copia.dias[op.payload.fecha] = op.payload; break;
      case "borrarDia": delete copia.dias[op.payload]; break;
      case "guardarPerfil": copia.perfil = op.payload; break;
      case "borrarMedicion": copia.composicion = copia.composicion.filter(m => m.fecha !== op.payload); break;
      case "guardarMedicion": copia.composicion = [...copia.composicion.filter(m => m.fecha !== op.payload.fecha), op.payload]; break;
    }
  }
  copia.composicion.sort((a, b) => a.fecha.localeCompare(b.fecha));
  return copia;
}

/** Conserva primero la operación; envía en orden y confirma por ID, no posición. */
export class QueuedAdapter implements Adapter {
  private key: string;
  private readonly origen = crypto.randomUUID();
  private cola: Entrada[] = [];
  private vuelo: string | null = null;
  private tarea: Promise<void> | null = null;
  private cerrado = false;
  private revision = 0;
  private ultimaSincronizacion?: string;
  private listeners = new Set<() => void>();
  hydrationSource: "cloud" | "backup" = "cloud";
  private readonly alVolverOnline = () => { void this.flush().catch(() => registrarDiagnostico("sync", "warning", "cola pendiente de sincronización")); };
  private readonly alCambiarStorage = (event: StorageEvent) => {
    if (event.key !== this.key && event.key !== `${this.key}:last-sync`) return;
    try {
      this.refrescar();
      this.listeners.forEach(cb => cb());
    } catch { registrarDiagnostico("sync", "error", "no se pudo reconciliar la cola de otra pestaña"); }
  };

  constructor(private inner: Adapter, private userId: string) {
    this.key = "ritmo:writequeue:" + userId;
    this.refrescar();
    this.revision = this.cola.length;
    // La instancia activa es el destino explícito del botón global Reintentar.
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    activo = this;
    this.notificar();
    if (typeof window !== "undefined") {
      window.addEventListener("online", this.alVolverOnline);
      window.addEventListener("storage", this.alCambiarStorage);
    }
  }
  private leer(): Entrada[] {
    const raw = localStorage.getItem(this.key);
    const datos: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(datos) || datos.some(o => !operacionValida(o)) || new Set(datos.map(o => o.id).filter(Boolean)).size !== datos.filter(o => o.id).length) {
      throw new Error("No se pudo leer la cola local. Conserva una copia del dispositivo antes de limpiarlo.");
    }
    return datos.map(o => ({ ...o, id: o.id || crypto.randomUUID(), revision: o.revision ?? 0,
      // Una cola antigua no incluía revisión: no inventar una precondición
      // tomando la revisión más reciente y sobrescribir otro dispositivo.
      revisionRemota: o.revisionRemota === undefined && this.inner.revisionActual ? null : o.revisionRemota,
    }));
  }
  private refrescar() {
    this.cola = this.leer();
    const ultima = localStorage.getItem(`${this.key}:last-sync`);
    this.ultimaSincronizacion = ultima && Number.isFinite(Date.parse(ultima)) ? ultima : undefined;
    this.notificar();
  }
  private async conBloqueo<T>(tipo: "storage" | "sender", tarea: () => Promise<T> | T): Promise<T> {
    if (typeof navigator === "undefined" || !navigator.locks?.request) throw new Error("Este navegador no puede proteger los cambios entre pestañas. Actualízalo antes de guardar.");
    return navigator.locks.request(`${this.key}:${tipo}`, async () => {
      if (this.cerrado) throw new Error("La cuenta ha cambiado. Abre de nuevo el registro.");
      return tarea();
    });
  }
  private async escribir(actualizar: (actual: Entrada[]) => Entrada[]) {
    // localStorage solo hace atómico setItem, no leer-modificar-escribir.
    // El bloqueo compartido entre pestañas protege la lectura fresca y las
    // bajas por ID; nunca vuelve a publicar una instantánea antigua.
    await this.conBloqueo("storage", () => {
      const siguiente = actualizar(this.leer());
      try { localStorage.setItem(this.key, JSON.stringify(siguiente)); }
      catch { throw new Error("El dispositivo no pudo conservar el cambio. Libera espacio y vuelve a intentarlo."); }
      this.cola = siguiente;
      this.notificar();
    });
  }
  private notificar() {
    if (activo !== this) return;
    estadoCola = {
      pendientes: this.cola.length,
      requiereAtencion: this.cola.some(o => o.bloqueada),
      sincronizando: Boolean(this.vuelo),
      ultimaSincronizacion: this.ultimaSincronizacion,
      detalles: this.cola.map((op) => ({
        id: op.id,
        tipo: op.type === "guardarPerfil" ? "perfil" : op.type.includes("Dia") ? "día" : "medición",
        fecha: op.type === "guardarPerfil" ? undefined : typeof op.payload === "string" ? op.payload : op.payload.fecha,
        bloqueada: Boolean(op.bloqueada),
      })),
    };
    listeners.forEach(l => l(estadoCola));
  }
  private revisionRemota(op: Op): string | null | undefined {
    if (!this.inner.revisionActual) return undefined;
    const tipo = op.type === "guardarPerfil" ? "perfil" : op.type.includes("Dia") ? "dia" : "medicion";
    const fecha = op.type === "guardarPerfil" ? undefined : typeof op.payload === "string" ? op.payload : op.payload.fecha;
    // Sin una carga remota previa no hay prueba de la revisión: exigir que
    // no exista evita sobrescribir datos conocidos solo por una copia offline.
    return this.inner.revisionActual(tipo, fecha) ?? null;
  }
  private ejecutar(op: Entrada): Promise<void> {
    const condicion = { revisionEsperada: op.revisionRemota };
    switch (op.type) {
      case "guardarDia": return this.inner.guardarDia(op.payload, condicion);
      case "borrarDia": return this.inner.borrarDia(op.payload, condicion);
      case "guardarMedicion": return this.inner.guardarMedicion(op.payload, condicion);
      case "borrarMedicion": return this.inner.borrarMedicion(op.payload, condicion);
      case "guardarPerfil": return this.inner.guardarPerfil(op.payload, condicion);
    }
  }
  private async intentar(op: Op) {
    if (this.cerrado) throw new Error("La cuenta ha cambiado. Abre de nuevo el registro.");
    // Valida exactamente lo que puede conservar JSON: los opcionales undefined
    // se omiten y un dato inválido nunca contamina la cola ya recuperable.
    const serializada: unknown = JSON.parse(JSON.stringify({ ...op, id: crypto.randomUUID(), origen: this.origen, revision: ++this.revision, revisionRemota: this.revisionRemota(op) }));
    if (!operacionValida(serializada)) throw new Error("Revisa los valores del registro. El cambio no se ha guardado.");
    const entrada = serializada as Entrada;
    await this.escribir(actual => [...actual.filter(o => o.id === this.vuelo || o.origen !== this.origen || claveOp(o) !== claveOp(op)), entrada]);
    await this.flush();
    if (this.cola.some(o => o.id === entrada.id && o.bloqueada)) {
      throw new Error("El cambio necesita revisión. Sigue conservado en este dispositivo.");
    }
  }
  flush(): Promise<void> {
    if (this.cerrado || offline()) return Promise.resolve();
    if (this.tarea) return this.tarea;
    // Solo una pestaña envía por cuenta, pero libera el bloqueo de storage
    // durante la red: otra pestaña puede conservar un cambio inmediatamente.
    this.tarea = this.conBloqueo("sender", () => this.enviar()).finally(() => { this.tarea = null; });
    return this.tarea;
  }
  private async enviar() {
    while (!this.cerrado && !offline()) {
      await this.escribir(actual => actual);
      const op = this.cola[0];
      if (!op || op.bloqueada) break;
      this.vuelo = op.id;
      this.notificar();
      try {
        await this.ejecutar(op);
        // Una segunda edición propia depende de esta confirmación, no de la
        // revisión anterior que había cuando se pulsó por segunda vez.
        const revisionRemota = this.revisionRemota(op);
        await this.escribir(actual => actual.filter(o => o.id !== op.id).map(o => o.origen === op.origen && claveOp(o) === claveOp(op) ? { ...o, revisionRemota } : o));
        this.ultimaSincronizacion = new Date().toISOString();
        // Esta marca es informativa: si no cabe, el envío confirmado no debe
        // reaparecer en la cola ni provocar un conflicto al reintentarse.
        try { localStorage.setItem(`${this.key}:last-sync`, this.ultimaSincronizacion); }
        catch { registrarDiagnostico("sync", "warning", "fecha de sincronización no disponible"); }
      } catch (e) {
        if (!esErrorDeRed(e)) {
          try { await this.escribir(actual => actual.map(o => o.id === op.id ? { ...o, bloqueada: true } : o)); }
          catch { op.bloqueada = true; }
          registrarDiagnostico("sync", "error", "escritura pendiente requiere atención");
        }
        break;
      } finally {
        this.vuelo = null;
        this.notificar();
      }
    }
  }
  async reintentar(id?: string) {
    if (this.cerrado) throw new Error("La cuenta ha cambiado. Abre de nuevo el registro.");
    this.refrescar();
    const objetivos = new Set(this.cola.filter(o => !id || o.id === id).map(o => o.id));
    // Actualiza las revisiones remotas antes de una resolución explícita.
    await this.inner.load();
    if (this.cerrado) throw new Error("La cuenta ha cambiado. Abre de nuevo el registro.");
    await this.escribir(actual => actual.map(o => objetivos.has(o.id) ? ({ ...o, bloqueada: false, revisionRemota: this.revisionRemota(o) }) : o));
    await this.flush();
    if (this.cola.some(o => objetivos.has(o.id))) throw new Error("El cambio sigue pendiente en este dispositivo. No se ha confirmado la sincronización.");
  }
  async load(): Promise<StoreData> {
    const disponeBloqueos = typeof navigator !== "undefined" && Boolean(navigator.locks?.request);
    const cargar = async () => {
      let data: StoreData;
      try {
        data = await this.inner.load();
        this.hydrationSource = "cloud";
      } catch (error) {
        if (!esErrorDeRed(error)) throw error;
        const respaldo = leerBackupLocal(this.userId)?.data as Partial<StoreData> | undefined;
        if (!respaldo?.perfil || !respaldo.dias || !Array.isArray(respaldo.composicion) || !analizarImportacion(respaldo, BASE_VALIDACION).valido) throw error;
        data = respaldo as StoreData;
        this.hydrationSource = "backup";
      }
      const superponer = () => {
        this.refrescar();
        return aplicarOperaciones(data, this.cola);
      };
      return disponeBloqueos ? this.conBloqueo("storage", superponer) : superponer();
    };
    // Ninguna pestaña confirma y retira operaciones durante la lectura. Al
    // terminar basta superponer los pendientes actuales: una edición antigua
    // ya confirmada nunca pisa un snapshot remoto más reciente. Mientras tanto
    // storage queda libre para conservar nuevas ediciones sin esperar a la red.
    const resultado = await (disponeBloqueos ? this.conBloqueo("sender", cargar) : cargar());
    // Fuera del bloqueo de lectura: flush necesita adquirir el mismo sender.
    this.alVolverOnline();
    return resultado;
  }
  guardarDia(dia: Dia) { return this.intentar({ type: "guardarDia", payload: dia }); }
  borrarDia(fecha: string) { return this.intentar({ type: "borrarDia", payload: fecha }); }
  guardarMedicion(m: Composicion) { return this.intentar({ type: "guardarMedicion", payload: m }); }
  borrarMedicion(fecha: string) { return this.intentar({ type: "borrarMedicion", payload: fecha }); }
  guardarPerfil(perfil: Perfil) { return this.intentar({ type: "guardarPerfil", payload: perfil }); }
  async borrarTodo() {
    await this.flush();
    if (this.cola.length) throw new Error("Resuelve los cambios pendientes antes de borrar tus datos.");
    if (!this.inner.borrarTodo) throw new Error("Borrado no disponible.");
    await this.inner.borrarTodo();
  }
  async sembrar(data: StoreData) {
    await this.flush();
    if (this.cola.length || offline()) throw new Error("Sincroniza los cambios pendientes antes de importar.");
    if (!this.inner.sembrar) throw new Error("Importación no disponible.");
    await this.inner.sembrar(data);
  }
  subscribe(cb: () => void) {
    this.listeners.add(cb);
    const cancelar = this.inner.subscribe?.(cb);
    return () => { this.listeners.delete(cb); cancelar?.(); };
  }
  dispose() {
    this.cerrado = true;
    this.inner.dispose?.();
    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.alVolverOnline);
      window.removeEventListener("storage", this.alCambiarStorage);
    }
    this.listeners.clear();
    if (activo === this) {
      activo = null;
      estadoCola = { pendientes: 0, requiereAtencion: false, sincronizando: false, ultimaSincronizacion: this.ultimaSincronizacion, detalles: [] };
      listeners.forEach(l => l(estadoCola));
    }
  }
}
