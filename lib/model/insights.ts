import { curvaBalanceModelo, pesajes, tdeeVigente } from "./analytics";
import { composicionInicial, proyectarComposicion } from "./body-composition";
import { habitosModelo } from "./config";
import { diaSemanaLunes, diasEntre, hoy, sumarDias } from "./dates";
import { calibracionLiquidosAlcohol } from "./fluid-retention";
import type { Estado } from "./types";

const DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

function ratioDia(estado: Estado, fecha: string) {
  const activos = habitosModelo(estado.perfil);
  const hechos = activos.filter((habito) => estado.dias[fecha]?.habitos?.[habito.clave]).length;
  return activos.length ? hechos / activos.length : 0;
}

function observado(estado: Estado, fecha: string) {
  const dia = estado.dias[fecha];
  return Boolean(dia && (Object.values(dia.habitos || {}).some(Boolean) || dia.comidas?.length || dia.peso != null));
}

export type EstadoVisualRitmo = "neutro" | "recuperacion" | "estable" | "flujo";

export function estadoVisualRitmo(estado: Estado, fecha = hoy()): { estado: EstadoVisualRitmo; constancia: number; dias: number } {
  const ratios: number[] = [];
  for (let i = 0; i < 7; i++) {
    const f = sumarDias(fecha, -i);
    if (observado(estado, f)) ratios.push(ratioDia(estado, f));
  }
  if (!ratios.length) return { estado: "neutro", constancia: 0, dias: 0 };
  const constancia = Math.round((ratios.reduce((a, b) => a + b, 0) / ratios.length) * 100);
  return { estado: constancia >= 78 ? "flujo" : constancia >= 48 ? "estable" : "recuperacion", constancia, dias: ratios.length };
}

export interface RescateRitmo {
  activo: boolean;
  constancia: number;
  dias: number;
  habitoClave: string | null;
  habitoEtiqueta: string | null;
}

export function diagnosticoRescate(estado: Estado, fecha = hoy()): RescateRitmo {
  const fechas: string[] = [];
  for (let i = 1; i <= 8 && fechas.length < 3; i++) {
    const f = sumarDias(fecha, -i);
    if (observado(estado, f)) fechas.push(f);
  }
  const constancia = fechas.length ? Math.round(fechas.reduce((suma, f) => suma + ratioDia(estado, f), 0) / fechas.length * 100) : 0;
  const activos = habitosModelo(estado.perfil);
  const pendientesHoy = activos.filter((habito) => !estado.dias[fecha]?.habitos?.[habito.clave]);
  const habito = [...pendientesHoy].sort((a, b) => {
    const cuenta = (clave: string) => fechas.filter((f) => estado.dias[f]?.habitos?.[clave]).length;
    return cuenta(b.clave) - cuenta(a.clave);
  })[0] ?? null;
  return {
    activo: fechas.length === 3 && constancia < 35 && Boolean(habito),
    constancia,
    dias: fechas.length,
    habitoClave: habito?.clave ?? null,
    habitoEtiqueta: habito?.etiqueta ?? null,
  };
}

export interface SenalRitmo {
  id: string;
  titulo: string;
  descripcion: string;
  metrica: string;
  evidencia: string;
  confianza: "inicial" | "media" | "alta";
  tono: "weight" | "habit" | "water" | "warning";
}

export function detectarSenales(estado: Estado, fecha = hoy()): SenalRitmo[] {
  const salida: SenalRitmo[] = [];
  const alcohol = calibracionLiquidosAlcohol(estado);
  if (alcohol.personalizada) {
    salida.push({
      id: "alcohol-peso",
      titulo: "Alcohol y báscula",
      descripcion: "En tus pesajes consecutivos, el día posterior al alcohol coincide con una subida transitoria mayor. No se interpreta como grasa.",
      metrica: `+${alcohol.kgDiaSiguiente.toLocaleString("es-ES", { maximumFractionDigits: 2 })} kg`,
      evidencia: `${alcohol.muestras} pares de pesajes`,
      confianza: alcohol.muestras >= 10 ? "alta" : "media",
      tono: "water",
    });
  }

  const activos = habitosModelo(estado.perfil);
  const claves = new Set(activos.map((h) => h.clave));
  if (claves.has("dormirBien") && claves.has("deporte")) {
    const conSueno: boolean[] = []; const sinSueno: boolean[] = [];
    for (let i = 2; i <= 90; i++) {
      const anterior = sumarDias(fecha, -i); const siguiente = sumarDias(anterior, 1);
      if (!observado(estado, anterior) || !observado(estado, siguiente)) continue;
      (estado.dias[anterior]?.habitos?.dormirBien ? conSueno : sinSueno).push(Boolean(estado.dias[siguiente]?.habitos?.deporte));
    }
    if (conSueno.length >= 3 && sinSueno.length >= 3) {
      const pct = (valores: boolean[]) => valores.filter(Boolean).length / valores.length * 100;
      const diferencia = Math.round(pct(conSueno) - pct(sinSueno));
      if (Math.abs(diferencia) >= 15) salida.push({
        id: "sueno-deporte",
        titulo: "Sueño y movimiento",
        descripcion: diferencia > 0 ? "Después de dormir bien, al día siguiente registras deporte con más frecuencia." : "Dormir bien no está coincidiendo todavía con más deporte al día siguiente.",
        metrica: `${diferencia > 0 ? "+" : ""}${diferencia} pts`,
        evidencia: `${conSueno.length + sinSueno.length} días comparables`,
        confianza: conSueno.length + sinSueno.length >= 20 ? "alta" : "media",
        tono: diferencia > 0 ? "habit" : "warning",
      });
    }
  }

  const semana = Array.from({ length: 7 }, () => [] as number[]);
  for (let i = 1; i <= 98; i++) {
    const f = sumarDias(fecha, -i);
    if (observado(estado, f)) semana[diaSemanaLunes(f)].push(ratioDia(estado, f));
  }
  const comparables = semana.map((valores, indice) => ({ indice, n: valores.length, media: valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : 0 })).filter((v) => v.n >= 2).sort((a, b) => b.media - a.media);
  if (comparables.length >= 4 && comparables[0].media - comparables[comparables.length - 1].media >= 0.2) {
    const mejor = comparables[0]; const peor = comparables[comparables.length - 1];
    salida.push({
      id: "dia-semana",
      titulo: "Tu mapa semanal",
      descripcion: `${DIAS[mejor.indice]} concentra tu mejor constancia; ${DIAS[peor.indice]} es el día donde más suele romperse el ritmo.`,
      metrica: `${Math.round((mejor.media - peor.media) * 100)} pts`,
      evidencia: `${mejor.n + peor.n} días comparados`,
      confianza: mejor.n + peor.n >= 12 ? "alta" : "media",
      tono: "weight",
    });
  }

  const recuperaciones: number[] = [];
  for (let i = 8; i <= 100; i++) {
    const f = sumarDias(fecha, -i);
    if (!observado(estado, f) || ratioDia(estado, f) > 0.34) continue;
    for (let salto = 1; salto <= 7; salto++) {
      const siguiente = sumarDias(f, salto);
      if (observado(estado, siguiente) && ratioDia(estado, siguiente) >= 0.83) { recuperaciones.push(salto); break; }
    }
  }
  if (recuperaciones.length >= 2) {
    const media = recuperaciones.reduce((a, b) => a + b, 0) / recuperaciones.length;
    salida.push({
      id: "recuperacion",
      titulo: "Sabes volver",
      descripcion: "Tras un día flojo, este es el tiempo medio que tardas en recuperar un día de constancia alta.",
      metrica: `${media.toLocaleString("es-ES", { maximumFractionDigits: 1 })} días`,
      evidencia: `${recuperaciones.length} recuperaciones`,
      confianza: recuperaciones.length >= 6 ? "alta" : "media",
      tono: "habit",
    });
  }

  return salida.slice(0, 4);
}

export interface EscenarioRitmo {
  cumplidos: number;
  total: number;
  balanceDiario: number;
  peso7: number;
  peso28: number;
  peso90: number;
}

export function escenariosRitmo(estado: Estado): EscenarioRitmo[] {
  const puntos = pesajes(estado);
  const peso = puntos[puntos.length - 1]?.peso;
  if (!peso) return [];
  const grasa = [...estado.composicion].sort((a, b) => b.fecha.localeCompare(a.fecha)).find((c) => c.grasaPct != null)?.grasaPct;
  const inicial = composicionInicial(peso, estado.perfil, grasa);
  const tdee = tdeeVigente(estado);
  return curvaBalanceModelo(estado).map((punto) => ({
    ...punto,
    balanceDiario: punto.balance,
    peso7: Math.round(proyectarComposicion(inicial, punto.balance, tdee, 7).peso * 10) / 10,
    peso28: Math.round(proyectarComposicion(inicial, punto.balance, tdee, 28).peso * 10) / 10,
    peso90: Math.round(proyectarComposicion(inicial, punto.balance, tdee, 90).peso * 10) / 10,
  }));
}

export interface MemoriaCorporal {
  fechaActual: string;
  pesoActual: number;
  fechaAnterior: string;
  pesoAnterior: number;
  diasEntre: number;
  constanciaActual: number;
  constanciaAnterior: number;
}

function constanciaAlrededor(estado: Estado, fecha: string) {
  let suma = 0; let dias = 0;
  for (let i = 0; i < 14; i++) {
    const f = sumarDias(fecha, -i);
    if (!observado(estado, f)) continue;
    suma += ratioDia(estado, f); dias++;
  }
  return dias ? Math.round(suma / dias * 100) : 0;
}

export function memoriaCorporal(estado: Estado): MemoriaCorporal | null {
  const puntos = pesajes(estado);
  const actual = puntos[puntos.length - 1];
  if (!actual) return null;
  const candidatos = puntos.slice(0, -1)
    .filter((p) => diasEntre(p.fecha, actual.fecha) >= 45 && Math.abs(p.peso - actual.peso) <= 0.45)
    .sort((a, b) => Math.abs(a.peso - actual.peso) - Math.abs(b.peso - actual.peso) || b.fecha.localeCompare(a.fecha));
  const anterior = candidatos[0];
  if (!anterior) return null;
  return {
    fechaActual: actual.fecha,
    pesoActual: actual.peso,
    fechaAnterior: anterior.fecha,
    pesoAnterior: anterior.peso,
    diasEntre: diasEntre(anterior.fecha, actual.fecha),
    constanciaActual: constanciaAlrededor(estado, actual.fecha),
    constanciaAnterior: constanciaAlrededor(estado, anterior.fecha),
  };
}
