import type { Composicion, Dia, Perfil } from "@/lib/model/types";
import type { Adapter, StoreData } from "./types";
import { leerBackupLocal } from "../backup";
import { registrarDiagnostico } from "../observability";

type Op =
  | { type: "guardarDia"; payload: Dia }
  | { type: "borrarDia"; payload: string }
  | { type: "guardarMedicion"; payload: Composicion }
  | { type: "borrarMedicion"; payload: string }
  | { type: "guardarPerfil"; payload: Perfil };
type Entrada = Op & { id: string; bloqueada?: boolean; revision: number; revisionRemota?: string | null };
export interface EstadoCola { pendientes: number; requiereAtencion: boolean; sincronizando: boolean; ultimaSincronizacion?: string }
const listeners = new Set<(estado: EstadoCola) => void>();
let estadoCola: EstadoCola = { pendientes: 0, requiereAtencion: false, sincronizando: false };
let activo: QueuedAdapter | null = null;

export function onColaCambia(cb: (estado: EstadoCola) => void): () => void {
  listeners.add(cb);
  cb(estadoCola);
  return () => { listeners.delete(cb); };
}
export async function reintentarCola(): Promise<void> { await activo?.reintentar(); }
function claveOp(op: Op): string {
  if (op.type === "guardarPerfil") return "perfil";
  return (op.type.includes("Dia") ? "dia:" : "med:") + (typeof op.payload === "string" ? op.payload : op.payload.fecha);
}
function offline(): boolean { return typeof navigator !== "undefined" && !navigator.onLine; }
function esErrorDeRed(e: unknown): boolean {
  const mensaje = e instanceof Error ? e.message : e && typeof e === "object" && "message" in e ? String(e.message) : String(e);
  return offline() || /failed to fetch|fetch failed|network|timeout|load failed/i.test(mensaje);
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
  private cola: Entrada[] = [];
  private vuelo: string | null = null;
  private tarea: Promise<void> | null = null;
  private cerrado = false;
  private revision = 0;
  private recientes: Entrada[] = [];
  private ultimaSincronizacion?: string;
  hydrationSource: "cloud" | "backup" = "cloud";
  private readonly alVolverOnline = () => { void this.flush(); };

  constructor(private inner: Adapter, private userId: string) {
    this.key = "ritmo:writequeue:" + userId;
    this.ultimaSincronizacion = localStorage.getItem(`${this.key}:last-sync`) ?? undefined;
    const raw = localStorage.getItem(this.key);
    const datos: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(datos) || datos.some(o => !o || !["guardarDia", "borrarDia", "guardarMedicion", "borrarMedicion", "guardarPerfil"].includes(o.type) || !o.payload || (o.revisionRemota !== undefined && o.revisionRemota !== null && typeof o.revisionRemota !== "string"))) {
      throw new Error("No se pudo leer la cola local. Conserva una copia del dispositivo antes de limpiarlo.");
    }
    this.cola = datos.map(o => ({ ...o, id: o.id || crypto.randomUUID(), revision: ++this.revision,
      // Una cola antigua no incluía revisión: no inventar una precondición
      // tomando la revisión más reciente y sobrescribir otro dispositivo.
      revisionRemota: o.revisionRemota === undefined && this.inner.revisionActual ? null : o.revisionRemota,
    }));
    // La instancia activa es el destino explícito del botón global Reintentar.
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    activo = this;
    this.notificar();
    if (typeof window !== "undefined") window.addEventListener("online", this.alVolverOnline);
  }
  private escribir(siguiente: Entrada[]) {
    try { localStorage.setItem(this.key, JSON.stringify(siguiente)); }
    catch { throw new Error("El dispositivo no pudo conservar el cambio. Libera espacio y vuelve a intentarlo."); }
    this.cola = siguiente;
    this.notificar();
  }
  private notificar() {
    if (activo !== this) return;
    estadoCola = { pendientes: this.cola.length, requiereAtencion: this.cola.some(o => o.bloqueada), sincronizando: Boolean(this.vuelo), ultimaSincronizacion: this.ultimaSincronizacion };
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
    const entrada: Entrada = { ...structuredClone(op), id: crypto.randomUUID(), revision: ++this.revision, revisionRemota: this.revisionRemota(op) };
    this.escribir([...this.cola.filter(o => o.id === this.vuelo || claveOp(o) !== claveOp(op)), entrada]);
    this.recientes.push(entrada);
    await this.flush();
    if (this.cola.some(o => o.id === entrada.id && o.bloqueada)) {
      throw new Error("El cambio necesita revisión. Sigue conservado en este dispositivo.");
    }
  }
  flush(): Promise<void> {
    if (this.tarea) return this.tarea;
    this.tarea = this.enviar().finally(() => { this.tarea = null; });
    return this.tarea;
  }
  private async enviar() {
    while (!this.cerrado && !offline() && this.cola.length) {
      const op = this.cola[0];
      if (op.bloqueada) break;
      this.vuelo = op.id;
      this.notificar();
      try {
        await this.ejecutar(op);
        this.ultimaSincronizacion = new Date().toISOString();
        localStorage.setItem(`${this.key}:last-sync`, this.ultimaSincronizacion);
        // Una segunda edición propia depende de esta confirmación, no de la
        // revisión anterior que había cuando se pulsó por segunda vez.
        const revisionRemota = this.revisionRemota(op);
        this.escribir(this.cola.filter(o => o.id !== op.id).map(o => claveOp(o) === claveOp(op) ? { ...o, revisionRemota } : o));
      } catch (e) {
        if (!esErrorDeRed(e)) {
          try { this.escribir(this.cola.map(o => o.id === op.id ? { ...o, bloqueada: true } : o)); }
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
  async reintentar() {
    // Actualiza las revisiones remotas antes de una resolución explícita.
    await this.inner.load();
    this.escribir(this.cola.map(o => ({ ...o, bloqueada: false, revisionRemota: this.revisionRemota(o) })));
    await this.flush();
  }
  async load(): Promise<StoreData> {
    const revision = this.revision;
    const iniciales = [...this.cola];
    let data: StoreData;
    try {
      data = await this.inner.load();
      this.hydrationSource = "cloud";
    } catch (error) {
      if (!esErrorDeRed(error)) throw error;
      const respaldo = leerBackupLocal(this.userId)?.data as Partial<StoreData> | undefined;
      if (!respaldo?.perfil || !respaldo.dias || !Array.isArray(respaldo.composicion)) throw error;
      data = respaldo as StoreData;
      this.hydrationSource = "backup";
    }
    const resultado = aplicarOperaciones(data, [...iniciales, ...this.recientes.filter(o => o.revision > revision), ...this.cola]);
    this.recientes = this.recientes.filter(o => o.revision > revision);
    void this.flush();
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
  subscribe(cb: () => void) { return this.inner.subscribe?.(cb) ?? (() => {}); }
  dispose() {
    this.cerrado = true;
    this.inner.dispose?.();
    if (typeof window !== "undefined") window.removeEventListener("online", this.alVolverOnline);
    if (activo === this) {
      activo = null;
      estadoCola = { pendientes: 0, requiereAtencion: false, sincronizando: false, ultimaSincronizacion: this.ultimaSincronizacion };
      listeners.forEach(l => l(estadoCola));
    }
  }
}
