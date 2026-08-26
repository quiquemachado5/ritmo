"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { PERFIL_DEFECTO } from "@/lib/model/config";
import type { Comida, Composicion, Dia, Perfil } from "@/lib/model/types";
import type { Adapter, StoreData } from "./types";

/* --------------------------------------------------- conversión de columnas */

const diaAFila = (d: Dia, userId: string) => ({
  user_id: userId,
  fecha: d.fecha,
  habitos: d.habitos || {},
  peso: d.peso ?? null,
  kcal_consumidas: d.kcalConsumidas ?? null,
  kcal_quemadas: d.kcalQuemadas ?? null,
  grasa_pct: d.grasaPct ?? null,
  notas: d.notas ?? null,
  comidas: d.comidas ?? [],
});

interface DiaFila {
  fecha: string;
  habitos: Record<string, boolean> | null;
  peso: number | null;
  kcal_consumidas: number | null;
  kcal_quemadas: number | null;
  grasa_pct: number | null;
  notas: string | null;
  comidas: Comida[] | null;
}

const diaDesdeFila = (f: DiaFila): Dia => {
  const d: Dia = { fecha: f.fecha, habitos: f.habitos || {} };
  if (f.peso !== null) d.peso = Number(f.peso);
  if (f.kcal_consumidas !== null) d.kcalConsumidas = Number(f.kcal_consumidas);
  if (f.kcal_quemadas !== null) d.kcalQuemadas = Number(f.kcal_quemadas);
  if (f.grasa_pct !== null) d.grasaPct = Number(f.grasa_pct);
  if (f.notas) d.notas = f.notas;
  if (Array.isArray(f.comidas) && f.comidas.length) d.comidas = f.comidas;
  return d;
};

const COMP_COLS: Record<string, string> = {
  peso: "peso",
  grasaPct: "grasa_pct",
  masaMuscularKg: "masa_muscular_kg",
  imc: "imc",
  grasaVisceral: "grasa_visceral",
  metabBasalKcal: "metab_basal_kcal",
  gastoDiarioKcal: "gasto_diario_kcal",
  masaOseaKg: "masa_osea_kg",
  aguaPct: "agua_pct",
  cintura: "cintura",
  cadera: "cadera",
  pecho: "pecho",
  brazo: "brazo",
  muslo: "muslo",
  cuello: "cuello",
};

const compAFila = (m: Composicion, userId: string) => {
  const fila: Record<string, unknown> = { user_id: userId, fecha: m.fecha };
  for (const [js, sql] of Object.entries(COMP_COLS)) fila[sql] = (m as unknown as Record<string, unknown>)[js] ?? null;
  return fila;
};

const compDesdeFila = (f: Record<string, unknown>): Composicion => {
  const m: Record<string, unknown> = { fecha: f.fecha };
  for (const [js, sql] of Object.entries(COMP_COLS)) {
    if (f[sql] !== null && f[sql] !== undefined) m[js] = Number(f[sql]);
  }
  return m as unknown as Composicion;
};

const PERFIL_COLS: Record<string, string> = {
  nombre: "nombre",
  alturaCm: "altura_cm",
  edad: "edad",
  sexo: "sexo",
  objetivo: "objetivo",
  pesoObjetivo: "peso_objetivo",
  kcalObjetivo: "kcal_objetivo",
  proteinaObjetivo: "proteina_objetivo",
  factorActividad: "factor_actividad",
  umbralRacha: "umbral_racha",
  onboardingCompleto: "onboarding_completo",
};

/* ------------------------------------------------------------- adaptador */

export class CloudAdapter implements Adapter {
  constructor(
    private client: SupabaseClient,
    private userId: string,
  ) {}

  async load(): Promise<StoreData> {
    const [perfilRes, diasRes, compRes] = await Promise.all([
      this.client.from("perfiles").select("*").eq("user_id", this.userId).maybeSingle(),
      this.client.from("dias").select("*").eq("user_id", this.userId).order("fecha"),
      this.client.from("composicion").select("*").eq("user_id", this.userId).order("fecha"),
    ]);
    for (const r of [perfilRes, diasRes, compRes]) if (r.error) throw r.error;

    const perfil: Perfil = { ...PERFIL_DEFECTO };
    if (perfilRes.data) {
      for (const [js, sql] of Object.entries(PERFIL_COLS)) {
        const v = (perfilRes.data as Record<string, unknown>)[sql];
        if (v !== null && v !== undefined) {
          (perfil as unknown as Record<string, unknown>)[js] =
            js === "sexo" || js === "objetivo" || js === "nombre"
              ? v
              : js === "onboardingCompleto"
                ? Boolean(v)
                : Number(v);
        }
      }
    }

    const dias: StoreData["dias"] = {};
    for (const fila of (diasRes.data as DiaFila[]) || []) dias[fila.fecha] = diaDesdeFila(fila);

    return {
      perfil,
      dias,
      composicion: ((compRes.data as Record<string, unknown>[]) || []).map(compDesdeFila),
    };
  }

  async guardarDia(dia: Dia) {
    const { error } = await this.client
      .from("dias")
      .upsert(diaAFila(dia, this.userId), { onConflict: "user_id,fecha" });
    if (error) throw error;
  }
  async borrarDia(fecha: string) {
    const { error } = await this.client.from("dias").delete().eq("user_id", this.userId).eq("fecha", fecha);
    if (error) throw error;
  }
  async guardarMedicion(m: Composicion) {
    const { error } = await this.client
      .from("composicion")
      .upsert(compAFila(m, this.userId), { onConflict: "user_id,fecha" });
    if (error) throw error;
  }
  async borrarMedicion(fecha: string) {
    const { error } = await this.client.from("composicion").delete().eq("user_id", this.userId).eq("fecha", fecha);
    if (error) throw error;
  }
  async guardarPerfil(perfil: Perfil) {
    // Upsert completo del perfil: escribimos null para los campos opcionales
    // ausentes, de modo que vaciar un objetivo (p. ej. proteína) sí se guarde
    // en vez de conservar el valor antiguo.
    const fila: Record<string, unknown> = { user_id: this.userId };
    for (const [js, sql] of Object.entries(PERFIL_COLS)) {
      const v = (perfil as unknown as Record<string, unknown>)[js];
      fila[sql] = v === undefined ? null : v;
    }
    const { error } = await this.client.from("perfiles").upsert(fila, { onConflict: "user_id" });
    if (error) throw error;
  }
  async borrarTodo() {
    const resultados = await Promise.all([
      this.client.from("dias").delete().eq("user_id", this.userId),
      this.client.from("composicion").delete().eq("user_id", this.userId),
      this.client.from("user_prefs").delete().eq("user_id", this.userId),
      this.client.from("perfiles").delete().eq("user_id", this.userId),
    ]);
    const fallo = resultados.find((r) => r.error)?.error;
    if (fallo) throw fallo;
  }

  async sembrar(data: StoreData) {
    await this.guardarPerfil(data.perfil);
    const lotes = <T>(arr: T[], n: number): T[][] =>
      Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
    for (const lote of lotes(Object.values(data.dias).map((d) => diaAFila(d, this.userId)), 200)) {
      const { error } = await this.client.from("dias").upsert(lote, { onConflict: "user_id,fecha" });
      if (error) throw error;
    }
    for (const lote of lotes(data.composicion.map((m) => compAFila(m, this.userId)), 200)) {
      const { error } = await this.client.from("composicion").upsert(lote, { onConflict: "user_id,fecha" });
      if (error) throw error;
    }
  }

  subscribe(cb: () => void): () => void {
    const canal = this.client
      .channel("ritmo-cambios")
      .on("postgres_changes", { event: "*", schema: "public", table: "dias" }, cb)
      .on("postgres_changes", { event: "*", schema: "public", table: "composicion" }, cb)
      .subscribe();
    return () => {
      this.client.removeChannel(canal);
    };
  }
}
