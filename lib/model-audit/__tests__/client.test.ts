import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PERFIL_DEFECTO } from "../../model/config";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), getSession: vi.fn(), rpc: vi.fn(), header: vi.fn() }));
vi.mock("../../supabase/client", () => ({ createClient: () => ({ auth: { getUser: mocks.getUser, getSession: mocks.getSession }, rpc: mocks.rpc }) }));

describe("Cliente de auditoría por cuenta", () => {
  beforeEach(() => {
    vi.resetModules(); vi.clearAllMocks();
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k) });
    vi.stubGlobal("window", new EventTarget());
    mocks.getUser.mockResolvedValue({ data: { user: { id: "A" } }, error: null });
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: "A" }, access_token: "synthetic-A" } }, error: null });
    mocks.rpc.mockReturnValue({ setHeader: mocks.header });
  });
  afterEach(() => vi.unstubAllGlobals());
  const fila = { id: "config-1", user_id: "A", effective_from: "2026-09-04T10:00:00Z", effective_date: "2026-09-04", perfil: PERFIL_DEFECTO };

  it("fija la autorización original si la cuenta cambia durante la petición", { timeout: 15_000 }, async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: "A" } }, error: null }).mockResolvedValue({ data: { user: { id: "B" } }, error: null });
    mocks.header.mockResolvedValue({ data: fila, error: null });
    const { registrarConfiguracion, leerAuditoriaLocal } = await import("../client");
    await expect(registrarConfiguracion("A", PERFIL_DEFECTO)).rejects.toThrow(/cuenta ha cambiado/i);
    expect(mocks.header).toHaveBeenCalledWith("Authorization", "Bearer synthetic-A");
    expect(leerAuditoriaLocal("A").configuraciones).toHaveLength(0);
    expect(leerAuditoriaLocal("B").configuraciones).toHaveLength(0);
  });
  it("no guarda respuestas ajenas ni oculta fallos de conexión", async () => {
    mocks.header.mockResolvedValueOnce({ data: { ...fila, user_id: "B" }, error: null }).mockResolvedValueOnce({ data: null, error: new Error("offline") });
    const { registrarConfiguracion, leerAuditoriaLocal } = await import("../client");
    await expect(registrarConfiguracion("A", PERFIL_DEFECTO)).rejects.toThrow(/no pertenece/);
    await expect(registrarConfiguracion("A", PERFIL_DEFECTO)).rejects.toThrow("offline");
    expect(leerAuditoriaLocal("A").configuraciones).toHaveLength(0);
  });
  it("admite la fila compuesta del RPC en objeto o colección y conserva el sello", async () => {
    mocks.header.mockResolvedValue({ data: [fila], error: null });
    const { registrarConfiguracion, leerAuditoriaLocal } = await import("../client");
    const result = await registrarConfiguracion("A", PERFIL_DEFECTO);
    expect(result[0].effectiveFrom).toBe(fila.effective_from);
    expect(leerAuditoriaLocal("A").configuraciones).toHaveLength(1);
    expect(leerAuditoriaLocal("B").configuraciones).toHaveLength(0);
  });
  it("una copia inválida no se acepta como predicción histórica", async () => {
    localStorage.setItem("ritmo:model-audit:v1:A", JSON.stringify({ configuraciones: [], predicciones: [{}] }));
    const { leerAuditoriaLocal } = await import("../storage");
    expect(() => leerAuditoriaLocal("A")).toThrow(/copia local/);
  });
});
