/* ============================================================================
   Pruebas de fusionarImport — la garantía de que importar NO borra datos.
   Es la operación más peligrosa de la app: si falla, el usuario pierde meses
   de registro. Estos tests fijan el contrato.
   ========================================================================= */

import { describe, it, expect } from "vitest";
import { fusionarImport } from "../merge";
import { PERFIL_DEFECTO } from "../../model/config";
import type { StoreData } from "../types";
import type { Dia, Composicion } from "../../model/types";

const dia = (fecha: string, extra: Partial<Dia> = {}): Dia => ({ fecha, habitos: {}, ...extra });
const comp = (fecha: string, extra: Partial<Composicion> = {}): Composicion => ({ fecha, ...extra } as Composicion);

const base = (): StoreData => ({
  perfil: { ...PERFIL_DEFECTO, nombre: "Quique", edad: 34 },
  dias: {
    "2026-01-01": dia("2026-01-01", { peso: 90 }),
    "2026-01-02": dia("2026-01-02", { habitos: { comida: true } }),
  },
  composicion: [comp("2026-01-01", { peso: 90, grasaPct: 20 })],
});

describe("fusionarImport", () => {
  it("conserva los días previos que el import no menciona", () => {
    const prev = base();
    const next = fusionarImport(prev, { dias: { "2026-02-01": dia("2026-02-01", { peso: 88 }) } });
    // Los dos días originales siguen ahí + el nuevo.
    expect(Object.keys(next.dias).sort()).toEqual(["2026-01-01", "2026-01-02", "2026-02-01"]);
    expect(next.dias["2026-01-01"].peso).toBe(90);
  });

  it("un día del import reemplaza al mismo día previo", () => {
    const prev = base();
    const next = fusionarImport(prev, { dias: { "2026-01-01": dia("2026-01-01", { peso: 91 }) } });
    expect(next.dias["2026-01-01"].peso).toBe(91);
  });

  it("no borra nada cuando el import viene vacío", () => {
    const prev = base();
    const next = fusionarImport(prev, {});
    expect(next.dias).toEqual(prev.dias);
    expect(next.composicion).toEqual(prev.composicion);
    expect(next.perfil).toEqual(prev.perfil);
  });

  it("fusiona campos de composición por fecha sin perder los previos", () => {
    const prev = base();
    // El import añade masa muscular a la MISMA fecha; grasaPct previo debe seguir.
    const next = fusionarImport(prev, { composicion: [comp("2026-01-01", { masaMuscularKg: 70 })] });
    const m = next.composicion.find((c) => c.fecha === "2026-01-01")!;
    expect(m.grasaPct).toBe(20);
    expect(m.masaMuscularKg).toBe(70);
    expect(m.peso).toBe(90);
  });

  it("añade nuevas mediciones y las mantiene ordenadas por fecha", () => {
    const prev = base();
    const next = fusionarImport(prev, {
      composicion: [comp("2025-12-15", { peso: 92 }), comp("2026-03-01", { peso: 86 })],
    });
    expect(next.composicion.map((c) => c.fecha)).toEqual(["2025-12-15", "2026-01-01", "2026-03-01"]);
  });

  it("el perfil del import pisa campos, conserva el resto", () => {
    const prev = base();
    const next = fusionarImport(prev, { perfil: { ...PERFIL_DEFECTO, nombre: "Ana" } });
    expect(next.perfil.nombre).toBe("Ana");
    // edad viene del PERFIL_DEFECTO del import (30), no del previo (34): el
    // import es la fuente de verdad para los campos que trae.
    expect(next.perfil.edad).toBe(30);
  });

  it("no muta el estado previo (pureza)", () => {
    const prev = base();
    const snapshot = JSON.stringify(prev);
    fusionarImport(prev, { dias: { "2026-09-09": dia("2026-09-09") } });
    expect(JSON.stringify(prev)).toBe(snapshot);
  });
});
