/* ============================================================================
   CONFIG — punto único de configuración.

   Para activar la sincronización en la nube, rellena SUPABASE con los datos de
   tu proyecto (Project Settings → API). Mientras estén vacíos, la aplicación
   funciona íntegramente contra el almacenamiento local del navegador.

   La clave `anonKey` es pública por diseño: quien protege los datos es la
   política RLS definida en `supabase/schema.sql`, no el secreto de la clave.
   ========================================================================= */

export const SUPABASE = {
  url: 'https://twslzgzmvgoaqusrmukt.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3c2x6Z3ptdmdvYXF1c3JtdWt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3ODk0MTMsImV4cCI6MjEwMTM2NTQxM30.hDPj5neyGIw01EukGXCVdHCStT-DvKKII5MSBPqTqQ0',
};

/** Hábitos diarios. El orden es el de aparición en la interfaz. */
export const HABITOS = [
  { clave: 'comida',      etiqueta: 'Comida',      codigo: 'COM' },
  { clave: 'cena',        etiqueta: 'Cena',        codigo: 'CEN' },
  { clave: 'noAlcohol',   etiqueta: 'Sin alcohol', codigo: '0%'  },
  { clave: 'deporte',     etiqueta: 'Deporte',     codigo: 'DEP' },
  { clave: 'beberAgua',   etiqueta: 'Beber agua',  codigo: 'AGU' },
  { clave: 'dormirBien',  etiqueta: 'Dormir bien', codigo: 'ZZZ' },
];

export const TOTAL_HABITOS = HABITOS.length;

/** Perfil por defecto. El usuario lo ajusta desde Ajustes y se persiste. */
export const PERFIL_DEFECTO = {
  alturaCm: 185,
  edad: 34,
  sexo: 'hombre',
  pesoObjetivo: 85,
  kcalObjetivo: 1350,
  factorActividad: 1.375,
  umbralRacha: 4,

  // --- Imputación de días sin registro -----------------------------------
  // A partir de `imputarDesde`, un día que no aparece en el historial NO se
  // trata como desconocido: se asume que fue un día malo y se le imputa el
  // superávit indicado. El criterio es del usuario, no del modelo — si no lo
  // registró, fue porque se salió de la pauta.
  //
  // Antes de esa fecha los huecos siguen siendo desconocidos y se excluyen,
  // porque el historial antiguo tiene huecos por otros motivos (vacaciones,
  // cambios de móvil) y aplicarles esta regla falsearía la base de datos.
  imputarActiva: true,
  imputarDesde: '2026-07-01',
  imputarSuperavitKcal: 500,
};

/** Clave del almacenamiento local. Cambiarla invalida los datos guardados. */
export const CLAVE_LOCAL = 'dieta.v2';

/** Ventana por defecto (en días) de los gráficos del panel. */
export const VENTANA_GRAFICO = 120;
