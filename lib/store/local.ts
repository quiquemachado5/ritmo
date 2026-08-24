"use client";

import { PERFIL_DEFECTO } from "@/lib/model/config";
import { SEED_COMPOSICION, SEED_DIAS } from "@/lib/model/seed";
import type { Perfil } from "@/lib/model/types";
import type { Adapter, StoreData } from "./types";

const CLAVE = "ritmo.v1";

/** Perfil de la persona del histórico sembrado, listo para explorar la demo. */
const PERFIL_DEMO: Perfil = {
  ...PERFIL_DEFECTO,
  nombre: "Demo",
  alturaCm: 185,
  edad: 34,
  sexo: "hombre",
  objetivo: "perder",
  pesoObjetivo: 85,
  kcalObjetivo: 2000,
  factorActividad: 1.375,
  onboardingCompleto: true,
};

function leer(): StoreData | null {
  try {
    const raw = localStorage.getItem(CLAVE);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoreData;
    return {
      perfil: { ...PERFIL_DEFECTO, ...(parsed.perfil || {}) },
      dias: parsed.dias || {},
      composicion: Array.isArray(parsed.composicion) ? parsed.composicion : [],
    };
  } catch {
    return null;
  }
}

function escribir(data: StoreData) {
  localStorage.setItem(CLAVE, JSON.stringify(data));
}

function sembrarInicial(): StoreData {
  const dias: StoreData["dias"] = {};
  for (const d of SEED_DIAS) dias[d.fecha] = d;
  const data: StoreData = { perfil: PERFIL_DEMO, dias, composicion: [...SEED_COMPOSICION] };
  escribir(data);
  return data;
}

/** Adaptador de navegador. Siembra el histórico la primera vez. */
export class LocalAdapter implements Adapter {
  async load(): Promise<StoreData> {
    return leer() ?? sembrarInicial();
  }

  private mutar(cambio: (d: StoreData) => void) {
    const data = leer() ?? sembrarInicial();
    cambio(data);
    escribir(data);
  }

  async guardarDia(dia: import("@/lib/model/types").Dia) {
    this.mutar((d) => {
      d.dias[dia.fecha] = dia;
    });
  }
  async borrarDia(fecha: string) {
    this.mutar((d) => {
      delete d.dias[fecha];
    });
  }
  async guardarMedicion(m: import("@/lib/model/types").Composicion) {
    this.mutar((d) => {
      const i = d.composicion.findIndex((x) => x.fecha === m.fecha);
      if (i >= 0) d.composicion[i] = m;
      else d.composicion.push(m);
      d.composicion.sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
    });
  }
  async borrarMedicion(fecha: string) {
    this.mutar((d) => {
      d.composicion = d.composicion.filter((x) => x.fecha !== fecha);
    });
  }
  async guardarPerfil(perfil: Perfil) {
    this.mutar((d) => {
      d.perfil = perfil;
    });
  }
  async sembrar(data: StoreData) {
    escribir(data);
  }

  subscribe(cb: () => void): () => void {
    const handler = (e: StorageEvent) => {
      if (e.key === CLAVE) cb();
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }
}
