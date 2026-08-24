/* ============================================================================
   ADAPTADOR SUPABASE — persistencia en PostgreSQL con RLS.

   Mismo contrato que `local-adapter.js`. La autenticación se hace por enlace
   mágico (OTP por correo): no hay contraseñas que gestionar ni almacenar, y la
   sesión funciona en cualquier dispositivo con el mismo correo.

   Cada fila lleva `user_id`; las políticas RLS de `supabase/schema.sql` impiden
   a nivel de motor que un usuario lea o escriba filas de otro.
   ========================================================================= */

import { SUPABASE } from '../config.js';

const CDN = 'https://esm.sh/@supabase/supabase-js@2.45.4';

/** ¿Hay credenciales configuradas? */
export function supabaseConfigurado() {
  return Boolean(SUPABASE.url && SUPABASE.anonKey);
}

/* ------------------------------------------------- conversión de columnas */

const dia_aFila = (d, userId) => ({
  user_id: userId,
  fecha: d.fecha,
  habitos: d.habitos || {},
  peso: d.peso ?? null,
  kcal_consumidas: d.kcalConsumidas ?? null,
  kcal_quemadas: d.kcalQuemadas ?? null,
  grasa_pct: d.grasaPct ?? null,
  notas: d.notas ?? null,
});

const dia_desdeFila = (f) => {
  const d = { fecha: f.fecha, habitos: f.habitos || {} };
  if (f.peso !== null) d.peso = Number(f.peso);
  if (f.kcal_consumidas !== null) d.kcalConsumidas = Number(f.kcal_consumidas);
  if (f.kcal_quemadas !== null) d.kcalQuemadas = Number(f.kcal_quemadas);
  if (f.grasa_pct !== null) d.grasaPct = Number(f.grasa_pct);
  if (f.notas) d.notas = f.notas;
  return d;
};

const COMP_COLS = {
  peso: 'peso',
  grasaPct: 'grasa_pct',
  masaMuscularKg: 'masa_muscular_kg',
  imc: 'imc',
  grasaVisceral: 'grasa_visceral',
  metabBasalKcal: 'metab_basal_kcal',
  gastoDiarioKcal: 'gasto_diario_kcal',
  masaOseaKg: 'masa_osea_kg',
  aguaPct: 'agua_pct',
};

const comp_aFila = (m, userId) => {
  const fila = { user_id: userId, fecha: m.fecha };
  for (const [js, sql] of Object.entries(COMP_COLS)) fila[sql] = m[js] ?? null;
  return fila;
};

const comp_desdeFila = (f) => {
  const m = { fecha: f.fecha };
  for (const [js, sql] of Object.entries(COMP_COLS)) {
    if (f[sql] !== null && f[sql] !== undefined) m[js] = Number(f[sql]);
  }
  return m;
};

const PERFIL_COLS = {
  alturaCm: 'altura_cm',
  edad: 'edad',
  sexo: 'sexo',
  pesoObjetivo: 'peso_objetivo',
  kcalObjetivo: 'kcal_objetivo',
  factorActividad: 'factor_actividad',
  umbralRacha: 'umbral_racha',
};

/* ------------------------------------------------------------- adaptador */

export class AdaptadorSupabase {
  constructor() {
    this.nombre = 'supabase';
    this.cliente = null;
    this.usuario = null;
    this.oyentes = new Set();
    this.canal = null;
  }

  /** Carga el SDK y restaura la sesión. Devuelve true si hay sesión activa. */
  async iniciar() {
    if (!supabaseConfigurado()) return false;
    const { createClient } = await import(/* @vite-ignore */ CDN);
    this.cliente = createClient(SUPABASE.url, SUPABASE.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });

    const { data } = await this.cliente.auth.getSession();
    this.usuario = data.session?.user ?? null;

    this.cliente.auth.onAuthStateChange((_evento, sesion) => {
      this.usuario = sesion?.user ?? null;
    });

    return Boolean(this.usuario);
  }

  get autenticado() {
    return Boolean(this.usuario);
  }

  get correo() {
    return this.usuario?.email ?? null;
  }

  /** Envía el enlace mágico de acceso al correo indicado. */
  async enviarEnlace(email) {
    const { error } = await this.cliente.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + window.location.pathname },
    });
    if (error) throw error;
  }

  async cerrarSesion() {
    this.desuscribirRealtime();
    await this.cliente.auth.signOut();
    this.usuario = null;
  }

  /* ------------------------------------------------------------ lectura */

  async cargar() {
    const uid = this.usuario.id;

    const [perfilRes, diasRes, compRes] = await Promise.all([
      this.cliente.from('perfiles').select('*').eq('user_id', uid).maybeSingle(),
      this.cliente.from('dias').select('*').eq('user_id', uid).order('fecha'),
      this.cliente.from('composicion').select('*').eq('user_id', uid).order('fecha'),
    ]);

    for (const r of [perfilRes, diasRes, compRes]) {
      if (r.error) throw r.error;
    }

    const perfil = {};
    if (perfilRes.data) {
      for (const [js, sql] of Object.entries(PERFIL_COLS)) {
        const v = perfilRes.data[sql];
        if (v !== null && v !== undefined) perfil[js] = js === 'sexo' ? v : Number(v);
      }
    }

    const dias = {};
    for (const fila of diasRes.data || []) dias[fila.fecha] = dia_desdeFila(fila);

    return {
      perfil,
      dias,
      composicion: (compRes.data || []).map(comp_desdeFila),
      actualizado: Date.now(),
    };
  }

  async hayDatos() {
    const { count, error } = await this.cliente
      .from('dias')
      .select('fecha', { count: 'exact', head: true })
      .eq('user_id', this.usuario.id);
    if (error) throw error;
    return (count || 0) > 0;
  }

  /* ---------------------------------------------------------- escritura */

  async sembrar({ dias, composicion, perfil }) {
    const uid = this.usuario.id;
    if (perfil) await this.guardarPerfil(perfil);

    // Se sube por lotes: una sola sentencia con 263 filas puede exceder límites.
    const lotes = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) },
      (_, i) => arr.slice(i * n, i * n + n));

    for (const lote of lotes((dias || []).map((d) => dia_aFila(d, uid)), 200)) {
      const { error } = await this.cliente.from('dias').upsert(lote, { onConflict: 'user_id,fecha' });
      if (error) throw error;
    }
    for (const lote of lotes((composicion || []).map((m) => comp_aFila(m, uid)), 200)) {
      const { error } = await this.cliente.from('composicion').upsert(lote, { onConflict: 'user_id,fecha' });
      if (error) throw error;
    }
    return this.cargar();
  }

  async guardarDia(dia) {
    const { error } = await this.cliente
      .from('dias')
      .upsert(dia_aFila(dia, this.usuario.id), { onConflict: 'user_id,fecha' });
    if (error) throw error;
  }

  async borrarDia(fecha) {
    const { error } = await this.cliente
      .from('dias').delete().eq('user_id', this.usuario.id).eq('fecha', fecha);
    if (error) throw error;
  }

  async guardarMedicion(medicion) {
    const { error } = await this.cliente
      .from('composicion')
      .upsert(comp_aFila(medicion, this.usuario.id), { onConflict: 'user_id,fecha' });
    if (error) throw error;
  }

  async borrarMedicion(fecha) {
    const { error } = await this.cliente
      .from('composicion').delete().eq('user_id', this.usuario.id).eq('fecha', fecha);
    if (error) throw error;
  }

  async guardarPerfil(perfil) {
    const fila = { user_id: this.usuario.id };
    for (const [js, sql] of Object.entries(PERFIL_COLS)) {
      if (perfil[js] !== undefined) fila[sql] = perfil[js];
    }
    const { error } = await this.cliente.from('perfiles').upsert(fila, { onConflict: 'user_id' });
    if (error) throw error;
  }

  /* ------------------------------------------------------------ realtime */

  suscribir(callback) {
    this.oyentes.add(callback);
    if (!this.canal) {
      const refrescar = async () => {
        try {
          const datos = await this.cargar();
          this.oyentes.forEach((cb) => cb(datos));
        } catch (e) {
          console.warn('Fallo al refrescar desde Supabase', e);
        }
      };
      this.canal = this.cliente
        .channel('cambios-dieta')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'dias' }, refrescar)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'composicion' }, refrescar)
        .subscribe();
    }
    return () => this.oyentes.delete(callback);
  }

  desuscribirRealtime() {
    if (this.canal) {
      this.cliente.removeChannel(this.canal);
      this.canal = null;
    }
  }
}
