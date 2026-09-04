import { describe, expect, it } from "vitest";
import { erroresPerfil, PROFILE_LIMITS, validarPerfil } from "../profile-validation";
import { PERFIL_DEFECTO } from "../model/config";
import type { Perfil } from "../model/types";
it("admite proteína decimal y distingue límites de almacenamiento", () => {
  expect(validarPerfil({ ...PERFIL_DEFECTO, proteinaObjetivo: 1.6 })).toBeNull();
  expect(validarPerfil({ ...PERFIL_DEFECTO, proteinaObjetivo: 160 })).not.toBeNull();
  expect(validarPerfil({ ...PERFIL_DEFECTO, edad: 17 })).not.toBeNull();
  expect(validarPerfil({ ...PERFIL_DEFECTO, alturaCm: NaN })).not.toBeNull();
});

describe("errores en línea del perfil", () => {
  it.each(Object.entries(PROFILE_LIMITS))("valida ambos límites de %s sin recortar lo introducido", (campo, [min, max]) => {
    expect(erroresPerfil({ ...PERFIL_DEFECTO, [campo]: min })[campo as keyof Perfil]).toBeUndefined();
    expect(erroresPerfil({ ...PERFIL_DEFECTO, [campo]: max })[campo as keyof Perfil]).toBeUndefined();
    expect(erroresPerfil({ ...PERFIL_DEFECTO, [campo]: min - 0.1 })[campo as keyof Perfil]).toBeDefined();
    expect(erroresPerfil({ ...PERFIL_DEFECTO, [campo]: max + 0.1 })[campo as keyof Perfil]).toBeDefined();
  });

  it("señala todos los campos inválidos, no solo el primero", () => {
    const errores = erroresPerfil({ ...PERFIL_DEFECTO, edad: NaN, alturaCm: 99, kcalObjetivo: Infinity, proteinaObjetivo: 160 });
    expect(Object.keys(errores)).toEqual(["edad", "alturaCm", "kcalObjetivo", "proteinaObjetivo"]);
    expect(validarPerfil({ ...PERFIL_DEFECTO, edad: NaN })).toBe(errores.edad);
  });

  it("deja vacíos los objetivos opcionales, pero no los campos obligatorios", () => {
    expect(erroresPerfil({ ...PERFIL_DEFECTO, pesoObjetivo: undefined, proteinaObjetivo: undefined })).toEqual({});
    expect(erroresPerfil({ ...PERFIL_DEFECTO, edad: undefined } as unknown as Perfil).edad).toBeDefined();
    expect(erroresPerfil({ ...PERFIL_DEFECTO, kcalObjetivo: NaN }).kcalObjetivo).toBeDefined();
  });

  it("admite decimales donde corresponde y pide enteros donde se almacenan", () => {
    expect(erroresPerfil({ ...PERFIL_DEFECTO, pesoObjetivo: 79.5, proteinaObjetivo: 1.6, factorActividad: 1.375 })).toEqual({});
    for (const campo of ["edad", "alturaCm", "kcalObjetivo"] as const) {
      expect(erroresPerfil({ ...PERFIL_DEFECTO, [campo]: PERFIL_DEFECTO[campo] + 0.5 })[campo]).toContain("entero");
    }
  });

  it("asocia errores a los grupos de selección y al nombre", () => {
    const perfil = { ...PERFIL_DEFECTO, nombre: "a".repeat(81), sexo: "desconocido", objetivo: "otro" } as unknown as Perfil;
    expect(Object.keys(erroresPerfil(perfil))).toEqual(["sexo", "objetivo", "nombre"]);
    expect(erroresPerfil({ ...PERFIL_DEFECTO, nombre: "a".repeat(80) }).nombre).toBeUndefined();
  });
});
