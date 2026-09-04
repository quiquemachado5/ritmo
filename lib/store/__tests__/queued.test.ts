import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueuedAdapter, onColaCambia, type EstadoCola } from "../queued";
import type { Adapter, StoreData } from "../types";
import { PERFIL_DEFECTO } from "../../model/config";

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}
const vacio = (): StoreData => ({ perfil: { ...PERFIL_DEFECTO }, dias: {}, composicion: [] });
function adapter(): Adapter {
  return { load: vi.fn(async () => vacio()), guardarDia: vi.fn(async () => {}), borrarDia: vi.fn(async () => {}),
    guardarMedicion: vi.fn(async () => {}), borrarMedicion: vi.fn(async () => {}), guardarPerfil: vi.fn(async () => {}) };
}
let storage: Map<string, string>;
let instances: QueuedAdapter[];
function cola(inner: Adapter, user = "a") { const q = new QueuedAdapter(inner, user); instances.push(q); return q; }
beforeEach(() => {
  storage = new Map(); instances = [];
  vi.stubGlobal("navigator", { onLine: true });
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("localStorage", { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v), removeItem: (k: string) => storage.delete(k) });
});
afterEach(() => { instances.forEach(q => q.dispose()); vi.unstubAllGlobals(); });

describe("persistencia segura", () => {
  it("no sustituye un error de permisos por una copia aparentemente válida", async () => {
    const inner = adapter();
    storage.set("ritmo:backup:a", JSON.stringify({ at: new Date().toISOString(), data: vacio() }));
    vi.mocked(inner.load).mockRejectedValue(new Error("permission denied"));
    await expect(cola(inner).load()).rejects.toThrow("permission denied");
  });
  it("no borra una cola corrupta al intentar inicializar", () => {
    storage.set("ritmo:writequeue:a", "malformed");
    expect(() => cola(adapter())).toThrow();
    expect(storage.get("ritmo:writequeue:a")).toBe("malformed");
  });
  it("no pierde una edición creada durante el envío de la anterior", async () => {
    const inner = adapter(); const gate = deferred();
    vi.mocked(inner.guardarDia).mockImplementationOnce(() => gate.promise);
    const q = cola(inner);
    const first = q.guardarDia({ fecha: "2026-09-04", habitos: { agua: true } });
    const second = q.guardarDia({ fecha: "2026-09-04", habitos: { agua: true, deporte: true } });
    gate.resolve(); await Promise.all([first, second]);
    expect(inner.guardarDia).toHaveBeenCalledTimes(2);
    expect(vi.mocked(inner.guardarDia).mock.calls[1][0].habitos.deporte).toBe(true);
    expect(JSON.parse(storage.get("ritmo:writequeue:a")!)).toEqual([]);
  });
  it("una edición reciente sustituye la pendiente antes de volver online", async () => {
    const inner = adapter(); const q = cola(inner);
    vi.stubGlobal("navigator", { onLine: false });
    await q.guardarDia({ fecha: "2026-09-04", habitos: { agua: true } });
    vi.stubGlobal("navigator", { onLine: true });
    await q.guardarDia({ fecha: "2026-09-04", habitos: { deporte: true } });
    expect(inner.guardarDia).toHaveBeenCalledTimes(1);
    expect(vi.mocked(inner.guardarDia).mock.calls[0][0].habitos).toEqual({ deporte: true });
  });
  it("recupera la copia del mismo usuario y superpone sus pendientes", async () => {
    const inner = adapter(); const q = cola(inner);
    storage.set("ritmo:backup:a", JSON.stringify({ at: new Date().toISOString(), data: vacio() }));
    vi.stubGlobal("navigator", { onLine: false });
    await q.guardarDia({ fecha: "2026-09-04", habitos: { agua: true } });
    vi.mocked(inner.load).mockRejectedValue(new TypeError("Failed to fetch"));
    expect((await q.load()).dias["2026-09-04"].habitos.agua).toBe(true);
    expect(q.hydrationSource).toBe("backup");
    await expect(cola(inner, "b").load()).rejects.toThrow();
  });
  it("rechaza el guardado si no puede conservarlo en el dispositivo", async () => {
    const inner = adapter(); const q = cola(inner);
    localStorage.setItem = () => { throw new Error("QuotaExceededError"); };
    await expect(q.guardarDia({ fecha: "2026-09-04", habitos: {} })).rejects.toThrow("conservar");
    expect(inner.guardarDia).not.toHaveBeenCalled();
  });
  it("conserva un cambio rechazado y permite reintentarlo explícitamente", async () => {
    const inner = adapter(); vi.mocked(inner.guardarDia).mockRejectedValueOnce(new Error("permission denied"));
    const q = cola(inner);
    let state: EstadoCola | undefined; const off = onColaCambia(s => { state = s; });
    await expect(q.guardarDia({ fecha: "2026-09-04", habitos: {} })).rejects.toThrow("revisión");
    expect(state?.requiereAtencion).toBe(true);
    expect(state?.pendientes).toBe(1);
    await q.reintentar(); expect(state?.pendientes).toBe(0); off();
  });
  it("no envía operaciones nuevas después de cambiar de cuenta", async () => {
    const inner = adapter(); const q = cola(inner); q.dispose();
    await expect(q.guardarDia({ fecha: "2026-09-04", habitos: {} })).rejects.toThrow("cuenta");
    expect(inner.guardarDia).not.toHaveBeenCalled();
  });
  it("no pierde un guardado confirmado mientras estaba leyendo la nube", async () => {
    const inner = adapter(); const gate = deferred<StoreData>();
    vi.mocked(inner.load).mockReturnValue(gate.promise);
    const q = cola(inner); const read = q.load();
    await q.guardarDia({ fecha: "2026-09-04", habitos: { agua: true } });
    gate.resolve(vacio());
    expect((await read).dias["2026-09-04"].habitos.agua).toBe(true);
  });
});
