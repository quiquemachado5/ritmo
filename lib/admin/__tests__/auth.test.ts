import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { isAdminUser } from "../auth";
import type { createClient } from "@/lib/supabase/server";

const abortSignal = vi.fn();
const rpc = vi.fn(() => ({ abortSignal }));
const client = { rpc } as unknown as Awaited<ReturnType<typeof createClient>>;
function user(extra: Partial<User> = {}): User {
  return { id: "synthetic-user", email: "user@example.test", app_metadata: {}, ...extra } as User;
}

describe("autorización administrativa coherente con la base de datos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    abortSignal.mockResolvedValue({ data: false, error: null });
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it("solo concede acceso al rol confirmado por BD", async () => {
    abortSignal.mockResolvedValue({ data: true, error: null });
    expect(await isAdminUser(client, user())).toBe(true);
    expect(rpc).toHaveBeenCalledWith("is_ritmo_admin");
    expect(abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it("aplica una revocación aunque siga existiendo rol en el JWT", async () => {
    const admin = user({ app_metadata: { role: "admin" } });
    abortSignal.mockResolvedValueOnce({ data: true, error: null }).mockResolvedValueOnce({ data: false, error: null });
    expect(await isAdminUser(client, admin)).toBe(true);
    expect(await isAdminUser(client, admin)).toBe(false);
  });

  it("un correo configurado no sustituye el permiso de BD", async () => {
    vi.stubEnv("RITMO_ADMIN_EMAILS", "configured@example.test");
    expect(await isAdminUser(client, user({ email: "configured@example.test" }))).toBe(false);
    expect(rpc).toHaveBeenCalledOnce();
  });

  it("un usuario anónimo nunca consulta privilegios", async () => {
    expect(await isAdminUser(client, null)).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    { data: true, error: { code: "NETWORK" } },
    { data: "true", error: null },
    { data: null, error: null },
  ])("deniega respuestas incompletas o fallidas: %j", async (response) => {
    abortSignal.mockResolvedValue(response);
    expect(await isAdminUser(client, user())).toBe(false);
  });

  it("limita la consulta a cinco segundos y deniega al agotarse", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    abortSignal.mockRejectedValue(new DOMException("Timed out", "TimeoutError"));
    expect(await isAdminUser(client, user({ app_metadata: { role: "admin" } }))).toBe(false);
    expect(timeout).toHaveBeenCalledWith(5_000);
  });
});
