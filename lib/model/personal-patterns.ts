import { habitosModelo } from "./config";
import { diasEntre } from "./dates";
import type { Estado } from "./types";

export type EventoContextual = "viaje" | "comida-libre" | "enfermedad" | "entrenamiento-especial";

export const EVENTOS_CONTEXTO: ReadonlyArray<{ id: EventoContextual; etiqueta: string; priorKg: number }> = [
  { id: "viaje", etiqueta: "Viaje", priorKg: 0.25 },
  { id: "comida-libre", etiqueta: "Comida libre", priorKg: 0.45 },
  { id: "enfermedad", etiqueta: "Enfermedad", priorKg: 0.3 },
  { id: "entrenamiento-especial", etiqueta: "Entrenamiento especial", priorKg: 0.2 },
] as const;

function normalizar(texto = "") {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function eventosDeNota(notas?: string): EventoContextual[] {
  const texto = normalizar(notas);
  if (!texto) return [];
  return EVENTOS_CONTEXTO.filter((evento) => {
    if (evento.id === "comida-libre") return texto.includes("comida libre");
    if (evento.id === "entrenamiento-especial") return texto.includes("entrenamiento especial");
    return texto.includes(evento.id);
  }).map((evento) => evento.id);
}

function mediana(valores: number[]) {
  const ordenados = [...valores].sort((a, b) => a - b);
  const mitad = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 ? ordenados[mitad] : (ordenados[mitad - 1] + ordenados[mitad]) / 2;
}

export function pesajesReales(estado: Estado) {
  const porFecha = new Map<string, number>();
  for (const medicion of estado.composicion || []) porFecha.set(medicion.fecha, medicion.peso);
  for (const dia of Object.values(estado.dias || {})) if (Number.isFinite(dia.peso)) porFecha.set(dia.fecha, dia.peso as number);
  return [...porFecha.entries()].map(([fecha, peso]) => ({ fecha, peso })).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

function tramosConsecutivos(estado: Estado) {
  const puntos = pesajesReales(estado);
  return puntos.slice(1).flatMap((actual, indice) => {
    const anterior = puntos[indice];
    return diasEntre(anterior.fecha, actual.fecha) === 1
      ? [{ fecha: anterior.fecha, delta: actual.peso - anterior.peso }]
      : [];
  });
}

export interface MemoriaEvento {
  id: EventoContextual;
  etiqueta: string;
  efectoKg: number;
  muestras: number;
  controles: number;
  personalizada: boolean;
  confianza: "inicial" | "media" | "alta";
}

const cacheEventos = new WeakMap<Estado, { version: number; valor: MemoriaEvento[] }>();

/**
 * Estima asociaciones de corta duración contra días comparables con pesajes
 * consecutivos. Es memoria de báscula, no una atribución de grasa ni causalidad.
 */
export function memoriaEventosContexto(estado: Estado): MemoriaEvento[] {
  const guardada = cacheEventos.get(estado);
  if (guardada?.version === (estado.version ?? 0)) return guardada.valor;
  const tramos = tramosConsecutivos(estado);
  const valor = EVENTOS_CONTEXTO.map((evento) => {
    const conEvento = tramos.filter((tramo) => eventosDeNota(estado.dias[tramo.fecha]?.notas).includes(evento.id)).map((tramo) => tramo.delta);
    const sinEvento = tramos.filter((tramo) => !eventosDeNota(estado.dias[tramo.fecha]?.notas).includes(evento.id)).map((tramo) => tramo.delta);
    const personalizada = conEvento.length >= 2 && sinEvento.length >= 4;
    const efecto = personalizada ? mediana(conEvento) - mediana(sinEvento) : evento.priorKg;
    return {
      id: evento.id,
      etiqueta: evento.etiqueta,
      efectoKg: Math.round(Math.max(-1, Math.min(1.25, efecto)) * 100) / 100,
      muestras: conEvento.length,
      controles: sinEvento.length,
      personalizada,
      confianza: personalizada ? (conEvento.length >= 6 && sinEvento.length >= 12 ? "alta" : "media") : "inicial",
    } satisfies MemoriaEvento;
  }).filter((evento) => evento.muestras > 0 || Object.values(estado.dias).some((dia) => eventosDeNota(dia.notas).includes(evento.id)));
  cacheEventos.set(estado, { version: estado.version ?? 0, valor });
  return valor;
}

export interface AsociacionHabito {
  clave: string;
  etiqueta: string;
  efectoKg: number;
  cumplidos: number;
  noCumplidos: number;
  confianza: "inicial" | "media" | "alta";
}

/** Diferencia de mediana del cambio al pesaje del día siguiente. */
export function mapaAsociacionesHabitos(estado: Estado): AsociacionHabito[] {
  const tramos = tramosConsecutivos(estado);
  return habitosModelo(estado.perfil).flatMap((habito) => {
    const cumplidos = tramos.filter((tramo) => estado.dias[tramo.fecha]?.habitos?.[habito.clave] === true).map((tramo) => tramo.delta);
    const noCumplidos = tramos.filter((tramo) => estado.dias[tramo.fecha] && estado.dias[tramo.fecha]?.habitos?.[habito.clave] !== true).map((tramo) => tramo.delta);
    if (cumplidos.length < 2 || noCumplidos.length < 2) return [];
    const efectoKg = Math.round((mediana(cumplidos) - mediana(noCumplidos)) * 100) / 100;
    const total = cumplidos.length + noCumplidos.length;
    return [{
      clave: habito.clave,
      etiqueta: habito.etiqueta,
      efectoKg,
      cumplidos: cumplidos.length,
      noCumplidos: noCumplidos.length,
      confianza: total >= 24 ? "alta" : total >= 10 ? "media" : "inicial",
    } satisfies AsociacionHabito];
  }).sort((a, b) => a.efectoKg - b.efectoKg);
}
