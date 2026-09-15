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
  const turnos = new Map<string, Promise<unknown>>();
  const locks = { request: <T>(name: string, tarea: () => Promise<T> | T): Promise<T> => {
    const resultado = (turnos.get(name) ?? Promise.resolve()).then(tarea);
    turnos.set(name, resultado.catch(() => {}));
    return resultado;
  } };
  vi.stubGlobal("navigator", { onLine: true, locks });
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
  it.each([
    { type: "guardarDia", payload: { fecha: "2026-09-04", habitos: {}, comidas: [{}] } },
    { type: "guardarMedicion", payload: { fecha: "2026-09-04", peso: "roto" } },
    { type: "borrarDia", payload: "2026-02-31" },
  ])("rechaza operaciones dañadas sin enviarlas ni modificar su copia", (entrada) => {
    const inner = adapter(); const raw = JSON.stringify([entrada]);
    storage.set("ritmo:writequeue:a", raw);
    expect(() => cola(inner)).toThrow("cola local");
    expect(storage.get("ritmo:writequeue:a")).toBe(raw);
    expect(inner.guardarDia).not.toHaveBeenCalled();
  });
  it("no acepta IDs duplicados que podrían confirmar dos operaciones a la vez", () => {
    storage.set("ritmo:writequeue:a", JSON.stringify([
      { id: "duplicado", type: "borrarDia", payload: "2026-09-04" },
      { id: "duplicado", type: "borrarDia", payload: "2026-09-05" },
    ]));
    expect(() => cola(adapter())).toThrow("cola local");
  });
  it("ignora una fecha de sincronización corrupta", () => {
    storage.set("ritmo:writequeue:a:last-sync", "no es una fecha");
    cola(adapter());
    let state: EstadoCola | undefined; const off = onColaCambia(s => { state = s; });
    expect(state?.ultimaSincronizacion).toBeUndefined(); off();
  });
  it("no pierde una edición creada durante el envío de la anterior", async () => {
    const inner = adapter(); const gate = deferred(); const iniciado = deferred();
    vi.mocked(inner.guardarDia).mockImplementationOnce(() => { iniciado.resolve(); return gate.promise; });
    const q = cola(inner);
    const first = q.guardarDia({ fecha: "2026-09-04", habitos: { agua: true } });
    await iniciado.promise;
    const second = q.guardarDia({ fecha: "2026-09-04", habitos: { agua: true, deporte: true } });
    gate.resolve(); await Promise.all([first, second]);
    expect(inner.guardarDia).toHaveBeenCalledTimes(2);
    expect(vi.mocked(inner.guardarDia).mock.calls[1][0].habitos.deporte).toBe(true);
    expect(JSON.parse(storage.get("ritmo:writequeue:a")!)).toEqual([]);
  });
  it("una edición reciente sustituye la pendiente antes de volver online", async () => {
    const inner = adapter(); const q = cola(inner);
    vi.stubGlobal("navigator", { ...navigator, onLine: false });
    await q.guardarDia({ fecha: "2026-09-04", habitos: { agua: true } });
    vi.stubGlobal("navigator", { ...navigator, onLine: true });
    await q.guardarDia({ fecha: "2026-09-04", habitos: { deporte: true } });
    expect(inner.guardarDia).toHaveBeenCalledTimes(1);
    expect(vi.mocked(inner.guardarDia).mock.calls[0][0].habitos).toEqual({ deporte: true });
  });
  it("recupera la copia del mismo usuario y superpone sus pendientes", async () => {
    const inner = adapter(); const q = cola(inner);
    storage.set("ritmo:backup:a", JSON.stringify({ at: new Date().toISOString(), data: vacio() }));
    vi.stubGlobal("navigator", { ...navigator, onLine: false });
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
  it("confirma un envío aunque no pueda guardar la marca informativa de sincronización", async () => {
    const inner = adapter(); const q = cola(inner);
    localStorage.setItem = (key: string, value: string) => {
      if (key.endsWith(":last-sync")) throw new Error("QuotaExceededError");
      storage.set(key, value);
    };
    await expect(q.guardarDia({ fecha: "2026-09-04", habitos: {} })).resolves.toBeUndefined();
    expect(JSON.parse(storage.get("ritmo:writequeue:a")!)).toEqual([]);
    expect(inner.guardarDia).toHaveBeenCalledOnce();
  });
  it("rechaza una copia con comidas corruptas en lugar de hidratar la aplicación", async () => {
    const inner = adapter();
    storage.set("ritmo:backup:a", JSON.stringify({ at: new Date().toISOString(), data: { ...vacio(), dias: { "2026-09-04": { fecha: "2026-09-04", habitos: {}, comidas: [{}] } } } }));
    vi.mocked(inner.load).mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(cola(inner).load()).rejects.toThrow("Failed to fetch");
    expect(storage.has("ritmo:backup:a")).toBe(true);
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
  it("no informa de éxito al reintentar si el servidor vuelve a rechazar el cambio", async () => {
    const inner = adapter(); vi.mocked(inner.guardarDia).mockRejectedValue(new Error("permission denied"));
    const q = cola(inner);
    await expect(q.guardarDia({ fecha: "2026-09-04", habitos: {} })).rejects.toThrow("revisión");
    await expect(q.reintentar()).rejects.toThrow("sigue pendiente");
    expect(JSON.parse(storage.get("ritmo:writequeue:a")!)).toHaveLength(1);
  });
  it("conserva un guardado local durante una lectura y confirma después de liberar el snapshot", async () => {
    const inner = adapter(); const gate = deferred<StoreData>(); const iniciado = deferred();
    vi.mocked(inner.load).mockImplementation(() => { iniciado.resolve(); return gate.promise; });
    const q = cola(inner); const read = q.load();
    await iniciado.promise;
    const guardado = q.guardarDia({ fecha: "2026-09-04", habitos: { agua: true } });
    await vi.waitFor(() => expect(JSON.parse(storage.get("ritmo:writequeue:a") ?? "[]")).toHaveLength(1));
    expect(inner.guardarDia).not.toHaveBeenCalled();
    gate.resolve(vacio());
    expect((await read).dias["2026-09-04"].habitos.agua).toBe(true);
    await guardado;
    expect(inner.guardarDia).toHaveBeenCalledOnce();
  });

  it("rechaza una medición inválida sin contaminar la cola y permite guardar y reabrir después", async () => {
    vi.stubGlobal("navigator", { ...navigator, onLine: false });
    const q = cola(adapter());
    await q.guardarDia({ fecha: "2026-09-04", habitos: { agua: true } });
    const anterior = storage.get("ritmo:writequeue:a");
    await expect(q.guardarMedicion({ fecha: "2026-09-15", peso: 80, grasaVisceral: 3.5 })).rejects.toThrow("Revisa los valores");
    expect(storage.get("ritmo:writequeue:a")).toBe(anterior);
    await q.guardarMedicion({ fecha: "2026-09-15", peso: 80, grasaVisceral: 3, cintura: undefined });
    q.dispose();
    const recuperado = await cola(adapter()).load();
    expect(recuperado.dias["2026-09-04"].habitos.agua).toBe(true);
    expect(recuperado.composicion).toEqual([{ fecha: "2026-09-15", peso: 80, grasaVisceral: 3 }]);
  });

  it("conserva la revisión original offline aunque una recarga vea cambios remotos", async () => {
    const inner = adapter(); let conocida = "v1"; let remota = "v1";
    inner.revisionActual = () => conocida;
    vi.mocked(inner.load).mockImplementation(async () => { conocida = remota; return vacio(); });
    vi.mocked(inner.guardarDia).mockImplementation(async (_dia, condicion) => {
      if (condicion?.revisionEsperada !== remota) throw new Error("Conflicto");
      conocida = remota = "v3";
    });
    const q = cola(inner); vi.stubGlobal("navigator", { ...navigator, onLine: false });
    await q.guardarDia({ fecha: "2026-09-04", habitos: { agua: true } });
    expect(JSON.parse(storage.get("ritmo:writequeue:a")!)[0].revisionRemota).toBe("v1");
    remota = "v2"; vi.stubGlobal("navigator", { ...navigator, onLine: true });
    await q.load(); await q.flush();
    expect(vi.mocked(inner.guardarDia).mock.calls[0][1]?.revisionEsperada).toBe("v1");
    expect(JSON.parse(storage.get("ritmo:writequeue:a")!)[0].bloqueada).toBe(true);
    await q.reintentar();
    expect(vi.mocked(inner.guardarDia).mock.calls[1][1]?.revisionEsperada).toBe("v2");
    expect(JSON.parse(storage.get("ritmo:writequeue:a")!)).toEqual([]);
  });

  it("una edición posterior adopta la revisión de su propia escritura anterior", async () => {
    const inner = adapter(); const gate = deferred(); const iniciado = deferred(); let revision = "v1";
    inner.revisionActual = () => revision;
    vi.mocked(inner.guardarDia).mockImplementationOnce(async () => { iniciado.resolve(); await gate.promise; revision = "v2"; });
    const q = cola(inner);
    const first = q.guardarDia({ fecha: "2026-09-04", habitos: { agua: true } });
    await iniciado.promise;
    const second = q.guardarDia({ fecha: "2026-09-04", habitos: { agua: true, deporte: true } });
    gate.resolve(); await Promise.all([first, second]);
    expect(vi.mocked(inner.guardarDia).mock.calls.map(call => call[1]?.revisionEsperada)).toEqual(["v1", "v2"]);
  });

  it("una cola persistida mantiene su revisión al crear otra instancia", async () => {
    const inner = adapter(); inner.revisionActual = () => "v2";
    storage.set("ritmo:writequeue:a", JSON.stringify([{ type: "borrarDia", payload: "2026-09-04", revisionRemota: "v1" }]));
    const q = cola(inner); await q.load(); await q.flush();
    expect(inner.borrarDia).toHaveBeenCalledWith("2026-09-04", { revisionEsperada: "v1" });
  });

  it("una cola antigua sin revisión no adopta silenciosamente la versión remota", async () => {
    const inner = adapter(); inner.revisionActual = () => "v2";
    storage.set("ritmo:writequeue:a", JSON.stringify([{ type: "guardarDia", payload: { fecha: "2026-09-04", habitos: {} } }]));
    const q = cola(inner); await q.load(); await q.flush();
    expect(vi.mocked(inner.guardarDia).mock.calls[0][1]?.revisionEsperada).toBeNull();
  });
});

describe("cola compartida entre pestañas", () => {
  it("una lectura lenta no reaplica un pendiente antiguo sobre dos confirmaciones más nuevas", async () => {
    const fecha = "2026-09-15";
    let remoto = { fecha, habitos: {} as Record<string, boolean> };
    let revisionRemota = "v1"; let version = 1;
    const primeraPeticion = deferred(); const liberarPrimera = deferred(); const liberarLectura = deferred();
    function remotoAdapter(lenta: boolean): Adapter {
      const inner = adapter(); let conocida = "v1";
      inner.revisionActual = () => conocida;
      vi.mocked(inner.load).mockImplementation(async () => {
        if (lenta) await liberarLectura.promise;
        conocida = revisionRemota;
        return { ...vacio(), dias: { [fecha]: structuredClone(remoto) } };
      });
      vi.mocked(inner.guardarDia).mockImplementation(async (dia, condicion) => {
        if (!lenta && version === 1) { primeraPeticion.resolve(); await liberarPrimera.promise; }
        if (condicion?.revisionEsperada !== revisionRemota) throw new Error("Conflicto");
        remoto = structuredClone(dia);
        conocida = revisionRemota = `v${++version}`;
      });
      return inner;
    }
    vi.stubGlobal("navigator", { ...navigator, onLine: false });
    const primera = cola(remotoAdapter(false));
    await primera.guardarDia({ fecha, habitos: { agua: true } });
    const segunda = cola(remotoAdapter(true));
    vi.stubGlobal("navigator", { ...navigator, onLine: true });
    const envio = primera.flush(); await primeraPeticion.promise;
    const lectura = segunda.load();
    const edicion = primera.guardarDia({ fecha, habitos: { agua: true, deporte: true } });
    await vi.waitFor(() => expect(JSON.parse(storage.get("ritmo:writequeue:a")!)).toHaveLength(2));
    liberarPrimera.resolve(); await Promise.all([envio, edicion]);
    expect(remoto.habitos).toEqual({ agua: true, deporte: true });
    liberarLectura.resolve();
    const cargado = (await lectura).dias[fecha];
    expect(cargado.habitos).toEqual({ agua: true, deporte: true });
    await segunda.guardarDia({ ...cargado, habitos: { ...cargado.habitos, sueno: true } });
    expect(remoto.habitos).toEqual({ agua: true, deporte: true, sueno: true });
    expect(JSON.parse(storage.get("ritmo:writequeue:a")!)).toEqual([]);
  });

  it("conserva ambos guardados offline aunque las dos pestañas partan de una cola vacía", async () => {
    vi.stubGlobal("navigator", { ...navigator, onLine: false });
    const primera = cola(adapter()); const segunda = cola(adapter());
    await Promise.all([
      primera.guardarDia({ fecha: "2026-09-04", habitos: { agua: true } }),
      segunda.guardarDia({ fecha: "2026-09-05", habitos: { deporte: true } }),
    ]);
    const pendientes = JSON.parse(storage.get("ritmo:writequeue:a")!);
    expect(pendientes.map((op: { payload: { fecha: string } }) => op.payload.fecha)).toEqual(["2026-09-04", "2026-09-05"]);
    primera.dispose(); segunda.dispose();
    expect(Object.keys((await cola(adapter()).load()).dias)).toEqual(["2026-09-04", "2026-09-05"]);
  });

  it("una pestaña con una instantánea antigua no resucita el envío ya confirmado", async () => {
    vi.stubGlobal("navigator", { ...navigator, onLine: false });
    const innerA = adapter(); const primera = cola(innerA);
    await primera.guardarDia({ fecha: "2026-09-04", habitos: { agua: true } });
    const innerB = adapter(); const segunda = cola(innerB);
    vi.stubGlobal("navigator", { ...navigator, onLine: true });
    await primera.flush();
    expect(JSON.parse(storage.get("ritmo:writequeue:a")!)).toEqual([]);
    vi.stubGlobal("navigator", { ...navigator, onLine: false });
    await segunda.guardarDia({ fecha: "2026-09-05", habitos: { deporte: true } });
    expect(JSON.parse(storage.get("ritmo:writequeue:a")!)).toHaveLength(1);
    vi.stubGlobal("navigator", { ...navigator, onLine: true });
    await segunda.flush();
    expect(innerA.guardarDia).toHaveBeenCalledOnce();
    expect(innerB.guardarDia).toHaveBeenCalledExactlyOnceWith({ fecha: "2026-09-05", habitos: { deporte: true } }, { revisionEsperada: undefined });
  });

  it("confirmar un envío en vuelo no elimina lo que acaba de guardar otra pestaña", async () => {
    const innerA = adapter(); const innerB = adapter(); const iniciado = deferred(); const terminar = deferred();
    vi.mocked(innerA.guardarDia).mockImplementationOnce(() => { iniciado.resolve(); return terminar.promise; });
    const primera = cola(innerA); const segunda = cola(innerB);
    const envio = primera.guardarDia({ fecha: "2026-09-04", habitos: { agua: true } });
    await iniciado.promise;
    vi.stubGlobal("navigator", { ...navigator, onLine: false });
    await segunda.guardarDia({ fecha: "2026-09-05", habitos: { deporte: true } });
    expect(JSON.parse(storage.get("ritmo:writequeue:a")!)).toHaveLength(2);
    vi.stubGlobal("navigator", { ...navigator, onLine: true });
    terminar.resolve(); await envio; await segunda.flush();
    const fechas = [...vi.mocked(innerA.guardarDia).mock.calls, ...vi.mocked(innerB.guardarDia).mock.calls].map(([dia]) => dia.fecha);
    expect(fechas).toEqual(["2026-09-04", "2026-09-05"]);
    expect(JSON.parse(storage.get("ritmo:writequeue:a")!)).toEqual([]);
    const innerC = adapter(); await cola(innerC).flush();
    expect(innerC.guardarDia).not.toHaveBeenCalled();
  });

  it("dos reconexiones simultáneas envían cada operación una sola vez", async () => {
    vi.stubGlobal("navigator", { ...navigator, onLine: false });
    const innerA = adapter(); const innerB = adapter(); const primera = cola(innerA); const segunda = cola(innerB);
    await primera.guardarDia({ fecha: "2026-09-04", habitos: { agua: true } });
    await segunda.borrarDia("2026-09-05");
    vi.stubGlobal("navigator", { ...navigator, onLine: true });
    await Promise.all([primera.flush(), segunda.flush()]);
    expect(vi.mocked(innerA.guardarDia).mock.calls.length + vi.mocked(innerB.guardarDia).mock.calls.length).toBe(1);
    expect(vi.mocked(innerA.borrarDia).mock.calls.length + vi.mocked(innerB.borrarDia).mock.calls.length).toBe(1);
    expect(JSON.parse(storage.get("ritmo:writequeue:a")!)).toEqual([]);
  });

  it("mantiene en revisión dos ediciones independientes del mismo día", async () => {
    vi.stubGlobal("navigator", { ...navigator, onLine: false });
    let revisionRemota = "v1";
    function remoto() {
      const inner = adapter(); let revisionConocida = "v1";
      inner.revisionActual = () => revisionConocida;
      vi.mocked(inner.guardarDia).mockImplementation(async (_dia, condicion) => {
        if (condicion?.revisionEsperada !== revisionRemota) throw new Error("Conflicto entre pestañas");
        revisionConocida = revisionRemota = "v2";
      });
      return inner;
    }
    const primera = cola(remoto()); const segunda = cola(remoto());
    await primera.guardarDia({ fecha: "2026-09-04", habitos: { agua: true } });
    await segunda.guardarDia({ fecha: "2026-09-04", habitos: { deporte: true } });
    expect(JSON.parse(storage.get("ritmo:writequeue:a")!)).toHaveLength(2);
    vi.stubGlobal("navigator", { ...navigator, onLine: true });
    await Promise.all([primera.flush(), segunda.flush()]);
    const pendientes = JSON.parse(storage.get("ritmo:writequeue:a")!);
    expect(pendientes).toHaveLength(1);
    expect(pendientes[0]).toMatchObject({ bloqueada: true, revisionRemota: "v1", payload: { habitos: { deporte: true } } });
  });

  it("avisa a la aplicación cuando otra pestaña modifica la cola", async () => {
    vi.stubGlobal("navigator", { ...navigator, onLine: false });
    const primera = cola(adapter()); const segunda = cola(adapter()); const actualizado = vi.fn();
    const cancelar = primera.subscribe(actualizado);
    await segunda.guardarDia({ fecha: "2026-09-04", habitos: { agua: true } });
    window.dispatchEvent(Object.assign(new Event("storage"), { key: "ritmo:writequeue:a" }));
    expect(actualizado).toHaveBeenCalledOnce();
    expect((await primera.load()).dias["2026-09-04"].habitos).toEqual({ agua: true });
    cancelar();
  });

  it("rechaza guardados sin soporte de locks conservando intactos los pendientes", async () => {
    vi.stubGlobal("navigator", { ...navigator, onLine: false });
    const inner = adapter(); const primera = cola(inner);
    await primera.guardarDia({ fecha: "2026-09-04", habitos: { agua: true } });
    const anterior = storage.get("ritmo:writequeue:a");
    vi.stubGlobal("navigator", { onLine: false });
    await expect(primera.guardarDia({ fecha: "2026-09-05", habitos: { deporte: true } })).rejects.toThrow("proteger los cambios entre pestañas");
    expect(storage.get("ritmo:writequeue:a")).toBe(anterior);
    expect(inner.guardarDia).not.toHaveBeenCalled();
    expect((await primera.load()).dias["2026-09-04"].habitos).toEqual({ agua: true });
  });
});
