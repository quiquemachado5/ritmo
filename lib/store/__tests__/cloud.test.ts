import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CloudAdapter } from "../cloud";
import { PERFIL_DEFECTO } from "../../model/config";

type Row = Record<string, unknown>;
type Call = { table: string; mode: string; columns: string; gt?: string; keys?: string[]; authorization?: string };
const stamp = "2026-09-04T10:00:00.000Z";
function fecha(i: number) { return new Date(Date.UTC(2020, 0, i + 1)).toISOString().slice(0, 10); }
function day(i: number, user = "a"): Row {
  return { user_id: user, fecha: fecha(i), actualizado_en: stamp, habitos: { agua: true }, peso: null,
    kcal_consumidas: null, kcal_quemadas: null, grasa_pct: null, notas: null, comidas: [] };
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => { resolve = r; });
  return { promise, resolve };
}
function database(days: Row[] = []) {
  const db: Record<string, Row[]> = { dias: structuredClone(days), composicion: [], perfiles: [], user_prefs: [] };
  const calls: Call[] = [];
  const rpcOwners: string[] = [];
  let tick = 0;
  const controls: {
    fail?: (call: Call) => boolean;
    afterRead?: (call: Call) => void;
    hold?: (call: Call) => Promise<void> | undefined;
    authUser?: string;
    afterRpc?: (name: string) => void;
    holdRpc?: (name: string) => Promise<void> | undefined;
    rpcError?: { code: string; message: string };
  } = {};
  class Query implements PromiseLike<{ data: Row[] | Row | null; error: { code: string; message: string } | null }> {
    mode = "read"; columns = "*"; filters: Array<(row: Row) => boolean> = [];
    amount = Infinity; singleRow = false; payload: Row[] = []; ascending = false;
    cursor?: string; keys?: string[];
    authorization?: string;
    constructor(readonly table: string) {}
    select(columns: string) { this.columns = columns; return this; }
    eq(key: string, value: unknown) { this.filters.push(row => row[key] === value); return this; }
    gt(key: string, value: string) { this.cursor = value; this.filters.push(row => String(row[key]) > value); return this; }
    in(key: string, values: string[]) { this.keys = values; this.filters.push(row => values.includes(String(row[key]))); return this; }
    order() { this.ascending = true; return this; }
    limit(n: number) { this.amount = n; return this; }
    maybeSingle() { this.singleRow = true; return this; }
    single() { return this.maybeSingle(); }
    update(row: Row) { this.mode = "update"; this.payload = [row]; return this; }
    insert(row: Row) { this.mode = "insert"; this.payload = [row]; return this; }
    upsert(rows: Row[]) { this.mode = "upsert"; this.payload = rows; return this; }
    delete() { this.mode = "delete"; return this; }
    setHeader(name: string, value: string) { if (name === "Authorization") this.authorization = value; return this; }
    async run() {
      const call = { table: this.table, mode: this.mode, columns: this.columns, gt: this.cursor, keys: this.keys, authorization: this.authorization };
      calls.push(call);
      if (controls.fail?.(call)) return { data: null, error: { code: "NETWORK", message: "Failed to fetch" } };
      let rows = (db[this.table] ?? []).filter(row => this.filters.every(f => f(row)));
      if (this.mode === "insert" || this.mode === "upsert") {
        rows = [];
        for (const payload of this.payload) {
          const index = db[this.table].findIndex(row => row.user_id === payload.user_id && row.fecha === payload.fecha);
          if (index >= 0 && this.mode === "insert") return { data: null, error: { code: "23505", message: "duplicate" } };
          const row = { ...structuredClone(payload), actualizado_en: `2026-09-04T10:01:${String(++tick).padStart(2, "0")}.000Z` };
          if (index >= 0) db[this.table][index] = row; else db[this.table].push(row);
          rows.push(row);
        }
      } else if (this.mode === "update") {
        rows.forEach(row => Object.assign(row, structuredClone(this.payload[0]), { actualizado_en: `2026-09-04T10:02:${String(++tick).padStart(2, "0")}.000Z` }));
      } else if (this.mode === "delete") {
        db[this.table] = db[this.table].filter(row => !rows.includes(row));
      }
      if (this.ascending) rows = [...rows].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
      rows = rows.slice(0, this.amount);
      const projected = structuredClone(rows.map(row => this.columns === "*" ? row : Object.fromEntries(this.columns.split(",").map(key => [key, row[key]]))));
      controls.afterRead?.(call);
      await controls.hold?.(call);
      return { data: this.singleRow ? projected[0] ?? null : projected, error: null };
    }
    then<TResult1 = Awaited<ReturnType<Query["run"]>>, TResult2 = never>(
      resolve?: ((value: Awaited<ReturnType<Query["run"]>>) => TResult1 | PromiseLike<TResult1>) | null,
      reject?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) { return this.run().then(resolve, reject); }
  }
  const callbacks: Array<() => void> = [];
  const channel = { on: vi.fn((_event, _filter, cb: () => void) => { callbacks.push(cb); return channel; }), subscribe: vi.fn(() => channel) };
  const client = {
    from: (table: string) => new Query(table),
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: controls.authUser ?? "a" } }, error: null })),
      getSession: vi.fn(async () => ({ data: { session: { user: { id: controls.authUser ?? "a" }, access_token: `synthetic-${controls.authUser ?? "a"}` } }, error: null })),
    },
    rpc: vi.fn((name: string) => ({ setHeader: async (_header: string, authorization: string) => {
      rpcOwners.push(authorization.replace("Bearer synthetic-", ""));
      controls.afterRpc?.(name);
      await controls.holdRpc?.(name);
      return { data: null, error: controls.rpcError ?? null };
    } })),
    storage: { from: () => ({ list: async () => ({ data: [], error: null }) }) },
    channel: vi.fn(() => channel), removeChannel: vi.fn(),
  };
  return { db, calls, rpcOwners, controls, callbacks, client, adapter: (user = "a") => new CloudAdapter(client as unknown as SupabaseClient, user) };
}

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("sincronización incremental por cuenta", () => {
  it("carga más de 500 filas, ordena por clave y no pierde timestamps iguales", async () => {
    const env = database(Array.from({ length: 1102 }, (_, i) => day(i)).reverse());
    const adapter = env.adapter();
    expect(Object.keys((await adapter.load()).dias)).toHaveLength(1102);
    expect(env.calls.filter(c => c.table === "dias").map(c => c.gt)).toEqual([undefined, fecha(499), fecha(999)]);
    env.calls.length = 0;
    env.db.dias.find(row => row.fecha === fecha(700))!.notas = "Cambio";
    env.db.dias.find(row => row.fecha === fecha(700))!.actualizado_en = "2026-09-04T11:00:00Z";
    env.db.dias.push(day(1102)); // La nueva fila tiene el mismo timestamp que el resto.
    const result = await adapter.load();
    expect(Object.keys(result.dias)).toHaveLength(1103);
    expect(result.dias[fecha(700)].notas).toBe("Cambio");
    const payload = env.calls.filter(c => c.table === "dias" && c.columns === "*");
    expect(payload).toHaveLength(1);
    expect(payload[0].keys).toEqual([fecha(700), fecha(1102)]);
  });

  it("el manifiesto detecta borrados y no vuelve a descargar filas sin cambios", async () => {
    const env = database([day(0), day(1)]); const adapter = env.adapter();
    await adapter.load(); env.calls.length = 0;
    env.db.dias.shift();
    const result = await adapter.load();
    expect(Object.keys(result.dias)).toEqual([fecha(1)]);
    expect(env.calls.filter(c => c.table === "dias" && c.columns === "*")).toEqual([]);
  });

  it("pagina cambios masivos en lotes acotados", async () => {
    const env = database(); const adapter = env.adapter(); await adapter.load(); env.calls.length = 0;
    env.db.dias = Array.from({ length: 613 }, (_, i) => day(i));
    expect(Object.keys((await adapter.load()).dias)).toHaveLength(613);
    expect(env.calls.filter(c => c.table === "dias" && c.columns === "*").map(c => c.keys?.length)).toEqual([100, 100, 100, 100, 100, 100, 13]);
  });

  it("borrar una fila de una página anterior no salta la siguiente página", async () => {
    const env = database(Array.from({ length: 650 }, (_, i) => day(i))); const adapter = env.adapter();
    env.controls.afterRead = call => {
      if (call.table === "dias" && !call.gt) env.db.dias = env.db.dias.filter(row => row.fecha !== fecha(0));
    };
    const initial = await adapter.load();
    expect(initial.dias[fecha(500)]).toBeDefined();
    expect(initial.dias[fecha(649)]).toBeDefined();
    env.controls.afterRead = undefined;
    expect((await adapter.load()).dias[fecha(0)]).toBeUndefined();
  });

  it("reconcilia un borrado ocurrido entre manifiesto y descarga del cambio", async () => {
    const env = database([day(0)]); const adapter = env.adapter(); await adapter.load();
    env.db.dias[0].actualizado_en = "changed";
    env.controls.afterRead = call => { if (call.table === "dias" && call.columns !== "*") env.db.dias = []; };
    expect((await adapter.load()).dias).toEqual({});
  });

  it("un fallo de red no adelanta revisiones ni deja una reconciliación parcial", async () => {
    const env = database([day(0)]); const adapter = env.adapter(); await adapter.load();
    env.db.dias[0] = { ...env.db.dias[0], actualizado_en: "changed", notas: "Nuevo" };
    env.controls.fail = call => call.table === "dias" && call.columns === "*";
    await expect(adapter.load()).rejects.toMatchObject({ message: "Failed to fetch" });
    env.controls.fail = undefined;
    expect((await adapter.load()).dias[fecha(0)].notas).toBe("Nuevo");
  });

  it("serializa una edición durante una lectura y conserva su revisión nueva", async () => {
    const env = database([day(0)]); const adapter = env.adapter(); await adapter.load();
    const gate = deferred(); let held = false;
    env.controls.hold = call => { if (!held && call.table === "dias") { held = true; return gate.promise; } };
    const read = adapter.load();
    const write = adapter.guardarDia({ fecha: fecha(0), habitos: { deporte: true } });
    await Promise.resolve(); await Promise.resolve();
    expect(env.calls.some(c => c.mode === "update")).toBe(false);
    gate.resolve(); await read; await write;
    env.calls.length = 0;
    expect((await adapter.load()).dias[fecha(0)].habitos).toEqual({ deporte: true });
    expect(env.calls.some(c => c.table === "dias" && c.columns === "*")).toBe(false);
    await expect(adapter.guardarDia({ fecha: fecha(0), habitos: { agua: true } })).resolves.toBeUndefined();
  });

  it("protege también el borrado frente a una edición remota no revisada", async () => {
    const env = database([day(0)]); const adapter = env.adapter(); await adapter.load();
    env.db.dias[0].actualizado_en = "remote-change";
    await expect(adapter.borrarDia(fecha(0))).rejects.toThrow("Conflicto");
    expect(env.db.dias).toHaveLength(1);
    await adapter.load(); await adapter.borrarDia(fecha(0));
    expect((await adapter.load()).dias).toEqual({});
  });

  it("una carga nueva no autoriza a sobreescribir con una operación offline antigua", async () => {
    const env = database([day(0)]); const adapter = env.adapter(); await adapter.load();
    const revisionEsperada = adapter.revisionActual("dia", fecha(0));
    env.db.dias[0].actualizado_en = "changed-remotely";
    await adapter.load();
    await expect(adapter.guardarDia({ fecha: fecha(0), habitos: {} }, { revisionEsperada })).rejects.toThrow("Conflicto");
    await expect(adapter.borrarDia(fecha(0), { revisionEsperada })).rejects.toThrow("Conflicto");
    expect(env.db.dias[0].actualizado_en).toBe("changed-remotely");
    env.db.dias = []; await adapter.load();
    await expect(adapter.guardarDia({ fecha: fecha(0), habitos: {} }, { revisionEsperada })).rejects.toThrow("Conflicto");
    expect(env.db.dias).toEqual([]); // No resucita una fila borrada remotamente.
  });

  it("sin revisión conocida nunca borra una fila remota a ciegas", async () => {
    const env = database([day(0)]); const adapter = env.adapter();
    await expect(adapter.borrarDia(fecha(0))).rejects.toThrow("Conflicto");
    expect(env.db.dias).toHaveLength(1);
    await expect(adapter.borrarDia(fecha(1))).resolves.toBeUndefined();
  });

  it("aísla cuentas y devuelve copias que no alteran la caché", async () => {
    const env = database([day(0), { ...day(0, "b"), notas: "Privado B" }]);
    const a = env.adapter(); const b = env.adapter("b");
    const first = await a.load(); first.dias[fecha(0)].habitos.agua = false;
    expect((await a.load()).dias[fecha(0)].habitos.agua).toBe(true);
    expect((await a.load()).dias[fecha(0)].notas).toBeUndefined();
    expect((await b.load()).dias[fecha(0)].notas).toBe("Privado B");
    a.dispose();
    await expect(a.guardarDia({ fecha: fecha(0), habitos: {} })).rejects.toThrow("cuenta");
  });

  it("actualiza caché y revisiones tras importar, guardar mediciones y borrar todo", async () => {
    const env = database([day(0)]); const adapter = env.adapter(); await adapter.load();
    await adapter.sembrar({ perfil: { ...PERFIL_DEFECTO }, dias: { [fecha(1)]: { fecha: fecha(1), habitos: { deporte: true } } }, composicion: [{ fecha: fecha(0), peso: 80 }] });
    await adapter.guardarMedicion({ fecha: fecha(0), peso: 79 });
    env.calls.length = 0;
    const data = await adapter.load();
    expect(data.composicion[0].peso).toBe(79);
    expect(data.dias[fecha(1)].habitos.deporte).toBe(true);
    expect(env.calls.some(c => c.table !== "perfiles" && c.columns === "*")).toBe(false);
    await adapter.borrarMedicion(fecha(0));
    await adapter.borrarTodo();
    expect((await adapter.load()).dias).toEqual({});
    expect(env.client.rpc).toHaveBeenCalledWith("clear_my_model_audit");
  });

  it("fija la cuenta del borrado aunque el singleton cambie entre los RPC", async () => {
    const env = database([day(0), day(0, "b")]);
    env.controls.afterRpc = () => { env.controls.authUser = "b"; };
    await env.adapter().borrarTodo();
    expect(env.rpcOwners).toEqual(["a", "a"]);
    expect(env.db.dias).toEqual([day(0, "b")]);
    expect(env.calls.filter(c => c.mode === "delete").every(c => c.authorization === "Bearer synthetic-a")).toBe(true);
  });

  it("dispose durante un RPC detiene los siguientes RPC y borrados", async () => {
    const env = database([day(0), day(0, "b")]); const adapter = env.adapter();
    const empezado = deferred(); const terminar = deferred();
    env.controls.afterRpc = () => empezado.resolve();
    env.controls.holdRpc = () => terminar.promise;
    const borrado = adapter.borrarTodo();
    const esperado = expect(borrado).rejects.toThrow("cuenta ha cambiado");
    await empezado.promise; adapter.dispose(); terminar.resolve(); await esperado;
    expect(env.rpcOwners).toEqual(["a"]);
    expect(env.calls.filter(c => c.mode === "delete")).toEqual([]);
    expect(env.db.dias).toHaveLength(2);
  });

  it("no inicia un borrado con una sesión de otra cuenta", async () => {
    const env = database([day(0), day(0, "b")]); env.controls.authUser = "b";
    await expect(env.adapter().borrarTodo()).rejects.toThrow("No se ha iniciado el borrado");
    expect(env.client.rpc).not.toHaveBeenCalled(); expect(env.calls).toEqual([]);
  });

  it("no oculta errores de permisos de los RPC ni continúa borrando", async () => {
    const env = database([day(0)]); env.controls.rpcError = { code: "42501", message: "permission denied" };
    await expect(env.adapter().borrarTodo()).rejects.toMatchObject({ code: "42501" });
    expect(env.rpcOwners).toEqual(["a"]);
    expect(env.calls.filter(c => c.mode === "delete")).toEqual([]);
  });

  it("reconcilia por foco, conexión y sondeo visible sin necesitar Realtime", () => {
    vi.useFakeTimers();
    const events = new EventTarget(); const doc = Object.assign(new EventTarget(), { visibilityState: "visible" });
    vi.stubGlobal("window", events); vi.stubGlobal("document", doc); vi.stubGlobal("navigator", { onLine: true });
    const env = database(); const adapter = env.adapter(); const changed = vi.fn();
    const unsubscribe = adapter.subscribe(changed);
    events.dispatchEvent(new Event("online")); events.dispatchEvent(new Event("focus"));
    vi.advanceTimersByTime(60_000);
    expect(changed).toHaveBeenCalledTimes(3);
    doc.visibilityState = "hidden"; vi.advanceTimersByTime(60_000);
    expect(changed).toHaveBeenCalledTimes(3);
    doc.visibilityState = "visible"; doc.dispatchEvent(new Event("visibilitychange"));
    expect(changed).toHaveBeenCalledTimes(4);
    unsubscribe(); adapter.dispose(); events.dispatchEvent(new Event("online")); vi.advanceTimersByTime(60_000);
    expect(changed).toHaveBeenCalledTimes(4);
    expect(env.client.removeChannel).toHaveBeenCalledOnce();
  });
});
