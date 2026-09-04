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
  private revisiones = new Map<string, string>();
  constructor(
    private client: SupabaseClient,
    private userId: string,
  ) {}

  private async historial(tabla: "dias" | "composicion"): Promise<Record<string, unknown>[]> {
    const filas: Record<string, unknown>[] = [];
    const bloque = 500;
    for (let desde = 0; ; desde += bloque) {
      const { data, error } = await this.client.from(tabla).select("*").eq("user_id", this.userId)
        .order("fecha").range(desde, desde + bloque - 1);
      if (error) throw error;
      filas.push(...(data || []));
      if (!data || data.length < bloque) return filas;
    }
  }

  async load(): Promise<StoreData> {
    const [perfilRes, diasFilas, compFilas] = await Promise.all([
      this.client.from("perfiles").select("*").eq("user_id", this.userId).maybeSingle(),
      this.historial("dias"),
      this.historial("composicion"),
    ]);
    if (perfilRes.error) throw perfilRes.error;
    for (const [tabla, filas] of [["dias", diasFilas], ["composicion", compFilas], ["perfiles", perfilRes.data ? [perfilRes.data] : []]] as const) {
      for (const fila of filas) if (typeof fila.actualizado_en === "string") this.revisiones.set(`${tabla}:${fila.fecha ?? "perfil"}`, fila.actualizado_en);
    }

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
    for (const fila of diasFilas as unknown as DiaFila[]) dias[fila.fecha] = diaDesdeFila(fila);

    return {
      perfil,
      dias,
      composicion: compFilas.map(compDesdeFila),
    };
  }

  private async guardarFila(tabla: "dias" | "composicion" | "perfiles", fila: Record<string, unknown>) {
    const clave = `${tabla}:${fila.fecha ?? "perfil"}`;
    const revision = this.revisiones.get(clave);
    let query;
    if (revision) {
      let update = this.client.from(tabla).update(fila).eq("user_id", this.userId).eq("actualizado_en", revision);
      if (fila.fecha) update = update.eq("fecha", fila.fecha);
      query = update.select("actualizado_en").maybeSingle();
    } else query = this.client.from(tabla).insert(fila).select("actualizado_en").single();
    const { data, error } = await query;
    if (error?.code === "23505" || (!error && !data)) throw new Error("Conflicto: otro dispositivo cambió el registro. Recarga y revisa antes de reintentar.");
    if (error) throw error;
    if (!data) throw new Error("No se confirmó el guardado. Recarga antes de reintentar.");
    this.revisiones.set(clave, data.actualizado_en);
  }

  async guardarDia(dia: Dia) {
    await this.guardarFila("dias", diaAFila(dia, this.userId));
  }
  async borrarDia(fecha: string) {
    const { error } = await this.client.from("dias").delete().eq("user_id", this.userId).eq("fecha", fecha);
    if (error) throw error;
    this.revisiones.delete(`dias:${fecha}`);
  }
  async guardarMedicion(m: Composicion) {
    await this.guardarFila("composicion", compAFila(m, this.userId));
  }
  async borrarMedicion(fecha: string) {
    const { error } = await this.client.from("composicion").delete().eq("user_id", this.userId).eq("fecha", fecha);
    if (error) throw error;
    this.revisiones.delete(`composicion:${fecha}`);
  }
  async guardarPerfil(perfil: Perfil) {
    // Escritura del perfil con revisión: null vacía los campos opcionales
    // ausentes, de modo que vaciar un objetivo (p. ej. proteína) sí se guarde
    // en vez de conservar el valor antiguo.
    const fila: Record<string, unknown> = { user_id: this.userId };
    for (const [js, sql] of Object.entries(PERFIL_COLS)) {
      const v = (perfil as unknown as Record<string, unknown>)[js];
      fila[sql] = v === undefined ? null : v;
    }
    await this.guardarFila("perfiles", fila);
  }
  private async borrarBackups() {
    const bucket = this.client.storage.from("backups");
    const { data, error } = await bucket.list(this.userId, { limit: 1000 });
    if (error) {
      // Instalaciones antiguas pueden no tener aún el bucket: en ese caso no
      // existe ninguna copia que eliminar.
      if (/bucket.*not found/i.test(error.message)) return;
      throw error;
    }
    const rutas = (data || []).map((archivo) => `${this.userId}/${archivo.name}`);
    if (!rutas.length) return;
    const { error: removeError } = await bucket.remove(rutas);
    if (removeError) throw removeError;
  }
  async borrarTodo() {
    const { error: cacheError } = await this.client.rpc("clear_my_nutrition_data");
    // Instalaciones anteriores al caché nutricional no tienen este RPC.
    // No ocultar errores de permisos, red ni del borrado cuando sí existe.
    if (cacheError && cacheError.code !== "PGRST202") throw cacheError;
    const resultados = await Promise.all([
      this.client.from("dias").delete().eq("user_id", this.userId),
      this.client.from("composicion").delete().eq("user_id", this.userId),
      this.client.from("user_prefs").delete().eq("user_id", this.userId),
      this.client.from("perfiles").delete().eq("user_id", this.userId),
      this.borrarBackups().then(() => ({ error: null })).catch((error: unknown) => ({ error })),
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
    const filtro = `user_id=eq.${this.userId}`;
    const canal = this.client
      .channel("ritmo-cambios")
      .on("postgres_changes", { event: "*", schema: "public", table: "dias", filter: filtro }, cb)
      .on("postgres_changes", { event: "*", schema: "public", table: "composicion", filter: filtro }, cb)
      .on("postgres_changes", { event: "*", schema: "public", table: "perfiles", filter: filtro }, cb)
      .subscribe();
    return () => {
      this.client.removeChannel(canal);
    };
  }
}
