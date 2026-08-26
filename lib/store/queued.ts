import type { Composicion, Dia, Perfil } from "@/lib/model/types";
import type { Adapter, StoreData } from "./types";

/* Cola de escritura offline. Envuelve al adaptador real: si una escritura falla
   por falta de red (o el dispositivo está offline), la operación se guarda en
   localStorage y se resuelve como si hubiera ido bien —para que la UI mantenga
   el cambio optimista en vez de revertirlo— y se reintenta al volver la
   conexión. Todas las operaciones son idempotentes (upserts/deletes), así que
   reproducir la cola es seguro. */

type Op =
  | { type: "guardarDia"; payload: Dia }
  | { type: "borrarDia"; payload: string }
  | { type: "guardarMedicion"; payload: Composicion }
  | { type: "borrarMedicion"; payload: string }
  | { type: "guardarPerfil"; payload: Perfil };

function claveOp(op: Op): string {
  switch (op.type) {
    case "guardarDia":
    case "borrarDia":
      return "dia:" + (typeof op.payload === "string" ? op.payload : op.payload.fecha);
    case "guardarMedicion":
    case "borrarMedicion":
      return "med:" + (typeof op.payload === "string" ? op.payload : op.payload.fecha);
    case "guardarPerfil":
      return "perfil";
  }
}

function esErrorDeRed(e: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  if (e instanceof TypeError) return true; // fetch abortado / sin red
  const msg = e instanceof Error ? e.message.toLowerCase() : String(e).toLowerCase();
  return msg.includes("fetch") || msg.includes("network") || msg.includes("failed to");
}

const listeners = new Set<(n: number) => void>();
let pendientes = 0;

export function onColaCambia(cb: (n: number) => void): () => void {
  listeners.add(cb);
  cb(pendientes);
  return () => listeners.delete(cb);
}

export class QueuedAdapter implements Adapter {
  private key: string;
  private cola: Op[] = [];
  private flushing = false;

  constructor(private inner: Adapter, userId: string) {
    this.key = `ritmo:writequeue:${userId}`;
    this.cola = this.leer();
    this.notificar();
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => void this.flush());
      // Intento inicial por si quedó cola de una sesión anterior.
      if (navigator.onLine) void this.flush();
    }
  }

  private leer(): Op[] {
    try {
      const raw = localStorage.getItem(this.key);
      return raw ? (JSON.parse(raw) as Op[]) : [];
    } catch {
      return [];
    }
  }
  private escribir() {
    try {
      localStorage.setItem(this.key, JSON.stringify(this.cola));
    } catch {
      /* cuota / modo privado */
    }
    this.notificar();
  }
  private notificar() {
    pendientes = this.cola.length;
    listeners.forEach((l) => l(pendientes));
  }

  /** Coalesce: una nueva op sustituye a la pendiente de la misma clave. */
  private encolar(op: Op) {
    const k = claveOp(op);
    this.cola = this.cola.filter((o) => claveOp(o) !== k);
    this.cola.push(op);
    this.escribir();
  }

  private async ejecutar(op: Op): Promise<void> {
    switch (op.type) {
      case "guardarDia": return this.inner.guardarDia(op.payload);
      case "borrarDia": return this.inner.borrarDia(op.payload);
      case "guardarMedicion": return this.inner.guardarMedicion(op.payload);
      case "borrarMedicion": return this.inner.borrarMedicion(op.payload);
      case "guardarPerfil": return this.inner.guardarPerfil(op.payload);
    }
  }

  /** Ejecuta ahora; si falla por red, encola y resuelve OK. */
  private async intentar(op: Op): Promise<void> {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      this.encolar(op);
      return;
    }
    try {
      await this.ejecutar(op);
      // Si había cola previa, aprovecha para vaciarla.
      if (this.cola.length) void this.flush();
    } catch (e) {
      if (esErrorDeRed(e)) {
        this.encolar(op);
        return;
      }
      throw e; // error real (permisos, validación): que la UI lo gestione
    }
  }

  async flush(): Promise<void> {
    if (this.flushing) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    this.flushing = true;
    try {
      while (this.cola.length) {
        const op = this.cola[0];
        try {
          await this.ejecutar(op);
        } catch (e) {
          if (esErrorDeRed(e)) break; // sigue offline: reintentar más tarde
          // Error no recuperable: descarta esa op para no bloquear la cola.
          console.error("Op descartada de la cola de sincronización", op.type, e);
        }
        this.cola.shift();
        this.escribir();
      }
    } finally {
      this.flushing = false;
    }
  }

  // --- Adapter ---
  load() { return this.inner.load(); }
  guardarDia(dia: Dia) { return this.intentar({ type: "guardarDia", payload: dia }); }
  borrarDia(fecha: string) { return this.intentar({ type: "borrarDia", payload: fecha }); }
  guardarMedicion(m: Composicion) { return this.intentar({ type: "guardarMedicion", payload: m }); }
  borrarMedicion(fecha: string) { return this.intentar({ type: "borrarMedicion", payload: fecha }); }
  guardarPerfil(perfil: Perfil) { return this.intentar({ type: "guardarPerfil", payload: perfil }); }
  borrarTodo() { this.cola = []; this.escribir(); return this.inner.borrarTodo?.() ?? Promise.resolve(); }
  sembrar(data: StoreData) { return this.inner.sembrar?.(data) ?? Promise.resolve(); }
  subscribe(cb: () => void) { return this.inner.subscribe?.(cb) ?? (() => {}); }
}
