import { afterEach, describe, expect, it, vi } from "vitest";
import { guardarBackupLocal, leerBackupLocal, limpiarDatosLocales } from "../backup";

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
});
