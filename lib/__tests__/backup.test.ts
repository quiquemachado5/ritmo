import { afterEach, describe, expect, it, vi } from "vitest";
import { ejecutarSimulacroRestauracion, guardarBackupLocal, leerBackupLocal, limpiarDatosLocales, validarRestauracionLocal } from "../backup";
import { PERFIL_DEFECTO } from "../model/config";

afterEach(() => vi.unstubAllGlobals());

describe("copias locales por cuenta", () => {
  it("no mezcla los datos de dos usuarios del mismo dispositivo", () => {
    const datos = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => datos.get(key) ?? null,
      setItem: (key: string, value: string) => datos.set(key, value),
      removeItem: (key: string) => datos.delete(key),
    });

    guardarBackupLocal({ perfil: "A" }, "usuario-a");
    guardarBackupLocal({ perfil: "B" }, "usuario-b");

    expect(leerBackupLocal("usuario-a")?.data).toEqual({ perfil: "A" });
    expect(leerBackupLocal("usuario-b")?.data).toEqual({ perfil: "B" });
    limpiarDatosLocales("usuario-a");
    expect(leerBackupLocal("usuario-a")).toBeNull();
    expect(leerBackupLocal("usuario-b")?.data).toEqual({ perfil: "B" });
  });

  it("simula la deserialización y validación sin tocar el estado activo", () => {
    const actual = { perfil: PERFIL_DEFECTO, dias: { "2026-09-08": { fecha: "2026-09-08", habitos: { agua: true } } }, composicion: [] };
    const snapshot = { at: "2026-09-08T10:00:00Z", data: { app: "ritmo", version: 4, ...actual } };
    expect(validarRestauracionLocal(snapshot, actual)).toBe(true);
    expect(validarRestauracionLocal({ ...snapshot, data: { app: "otra", ...actual } }, actual)).toBe(false);
    expect(actual.dias["2026-09-08"].habitos.agua).toBe(true);
  });

  it("recupera la copia anterior si la última no puede deserializarse", () => {
    const datos = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => datos.get(key) ?? null,
      setItem: (key: string, value: string) => datos.set(key, value),
      removeItem: (key: string) => datos.delete(key),
    });
    guardarBackupLocal({ perfil: "Primera" }, "usuario-a");
    guardarBackupLocal({ perfil: "Segunda" }, "usuario-a");
    datos.set("ritmo:backup:usuario-a", "copia incompleta");
    expect(leerBackupLocal("usuario-a")?.data).toEqual({ perfil: "Primera" });
    expect(datos.get("ritmo:backup:usuario-a")).toBe("copia incompleta");
    guardarBackupLocal({ perfil: "Tercera" }, "usuario-a");
    expect(JSON.parse(datos.get("ritmo:backup:previous:usuario-a")!).data).toEqual({ perfil: "Primera" });
  });

  it("actualiza la copia actual aunque no quede espacio para duplicarla", () => {
    const datos = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => datos.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (key.includes(":previous:")) throw new Error("QuotaExceededError");
        datos.set(key, value);
      },
      removeItem: (key: string) => datos.delete(key),
    });
    guardarBackupLocal({ perfil: "Primera" }, "usuario-a");
    guardarBackupLocal({ perfil: "Actual" }, "usuario-a");
    expect(leerBackupLocal("usuario-a")?.data).toEqual({ perfil: "Actual" });
  });

  it("devuelve el resultado del simulacro aunque el almacenamiento esté bloqueado", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => { throw new Error("Storage disabled"); },
      setItem: () => { throw new Error("Storage disabled"); },
      removeItem: () => { throw new Error("Storage disabled"); },
    });
    await expect(ejecutarSimulacroRestauracion({ perfil: PERFIL_DEFECTO, dias: {}, composicion: [] }, "usuario-a", true)).resolves.toMatchObject({ ok: false, local: false });
  });
});
