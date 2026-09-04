import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { conservarAuditoriaDocumental, leerAuditoriaDocumental, limpiarAuditoriaDocumental } from "../documentary";
import { PERFIL_DEFECTO } from "../../model/config";

describe("Copias documentales del modelo", () => {
  let storage: Map<string, string>;
  beforeEach(() => {
    storage = new Map();
    vi.stubGlobal("localStorage", { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) });
  });
  afterEach(() => vi.unstubAllGlobals());
  const documento = { configuraciones: [{ id: "config-a", effectiveFrom: "2026-09-04T10:00:00Z", perfil: PERFIL_DEFECTO }], predicciones: [] };
  it("conserva la copia, evita duplicados y nunca toca la caché de emisiones", () => {
    conservarAuditoriaDocumental("a", documento, documento);
    expect(leerAuditoriaDocumental("a").configuraciones).toHaveLength(1);
    expect([...storage.keys()]).toEqual(["ritmo:model-documentary:v1:a"]);
  });
  it("aísla las cuentas y limpia solo la copia solicitada", () => {
    conservarAuditoriaDocumental("a", documento);
    conservarAuditoriaDocumental("b", documento);
    limpiarAuditoriaDocumental("a");
    expect(leerAuditoriaDocumental("a").configuraciones).toHaveLength(0);
    expect(leerAuditoriaDocumental("b").configuraciones).toHaveLength(1);
  });
  it("rechaza un documento corrupto sin sustituir el anterior", () => {
    conservarAuditoriaDocumental("a", documento);
    expect(() => conservarAuditoriaDocumental("a", { predicciones: [{}] })).toThrow();
    expect(leerAuditoriaDocumental("a")).toEqual(documento);
  });
});
