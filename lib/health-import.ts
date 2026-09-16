import type { Estado } from "@/lib/model/types";
import type { StoreData } from "@/lib/store/types";

export type FuenteSalud = "apple-health" | "health-connect";
export type MetricaSalud = "peso" | "pasos" | "sueno" | "entrenamiento";

export interface DiaImportadoSalud {
  fecha: string;
  peso?: number;
  pasos?: number;
  suenoMinutos?: number;
  entrenamientoMinutos?: number;
}

export interface ImportacionSalud {
  fuente: FuenteSalud;
  dias: Record<string, DiaImportadoSalud>;
  registrosLeidos: number;
  desde: string | null;
  hasta: string | null;
  avisos: string[];
}

export interface SeleccionSalud {
  peso: boolean;
  pasos: boolean;
  sueno: boolean;
  entrenamiento: boolean;
}

export interface ResumenAplicacionSalud {
  dias: number;
  peso: number;
  pasos: number;
  sueno: number;
  entrenamiento: number;
  omitidos: number;
}

const FECHA = /^\d{4}-\d{2}-\d{2}/;
const MAX_REGISTROS = 250_000;

type Intervalo = [number, number];
type DiaAcumulado = {
  peso?: { valor: number; instante: number };
  pasosPorFuente: Map<string, number>;
  sueno: Intervalo[];
  entrenamientos: Map<string, number>;
};

function nuevoDia(): DiaAcumulado {
  return { pasosPorFuente: new Map(), sueno: [], entrenamientos: new Map() };
}

function fechaDe(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const match = valor.match(FECHA);
  const compacta = valor.trim().match(/^(\d{4})(\d{2})(\d{2})/);
  if (!match && !compacta) return null;
  const fecha = match?.[0] ?? `${compacta?.[1]}-${compacta?.[2]}-${compacta?.[3]}`;
  const d = new Date(`${fecha}T12:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === fecha ? fecha : null;
}

function instante(valor: unknown): number | null {
  if (typeof valor !== "string") return null;
  const compacta = valor.trim().match(/^(\d{4})(\d{2})(\d{2})(?:(\d{2})(\d{2})(\d{2}))?([+-]\d{2})(\d{2})$/);
  if (compacta) {
    const [, ano, mes, dia, hora = "12", minuto = "00", segundo = "00", zonaHora, zonaMinuto] = compacta;
    const n = Date.parse(`${ano}-${mes}-${dia}T${hora}:${minuto}:${segundo}${zonaHora}:${zonaMinuto}`);
    return Number.isFinite(n) ? n : null;
  }
  // Apple usa "+0200"; Date.parse es más consistente con "+02:00".
  const normalizado = valor.trim().replace(/ ([+-]\d{2})(\d{2})$/, "$1:$2").replace(" ", "T");
  const n = Date.parse(normalizado);
  return Number.isFinite(n) ? n : null;
}

function numero(valor: unknown): number | null {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  if (typeof valor === "string") {
    const n = Number(valor.trim().replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  if (valor && typeof valor === "object") {
    const objeto = valor as Record<string, unknown>;
    for (const clave of ["inKilograms", "kilograms", "kg", "value", "magnitude", "count", "minutes"]) {
      const n = numero(objeto[clave]);
      if (n !== null) return n;
    }
  }
  return null;
}

function minutos(valor: unknown, unidad: unknown): number | null {
  const n = numero(valor);
  if (n === null) return null;
  const u = String(unidad ?? "min").toLowerCase();
  if (u.includes("hour") || u === "h" || u.includes("hora")) return n * 60;
  if (u.includes("second") || u === "s" || u.includes("seg")) return n / 60;
  if (u.includes("millisecond") || u === "ms") return n / 60_000;
  return n;
}

function kg(valor: unknown, unidad: unknown): number | null {
  const n = numero(valor);
  if (n === null) return null;
  const u = String(unidad ?? "kg").toLowerCase();
  if (u.includes("lb") || u.includes("pound")) return n * 0.45359237;
  if (u.includes("stone") || u === "st") return n * 6.35029318;
  return n;
}

function atributos(tag: string): Record<string, string> {
  const resultado: Record<string, string> = {};
  for (const match of tag.matchAll(/([\w:.-]+)="([^"]*)"/g)) resultado[match[1]] = match[2];
  return resultado;
}

function unirIntervalos(intervalos: Intervalo[]): number {
  const ordenados = intervalos.filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0]);
  if (!ordenados.length) return 0;
  let total = 0;
  let [inicio, fin] = ordenados[0];
  for (const [siguienteInicio, siguienteFin] of ordenados.slice(1)) {
    if (siguienteInicio <= fin) fin = Math.max(fin, siguienteFin);
    else { total += fin - inicio; inicio = siguienteInicio; fin = siguienteFin; }
  }
  return total + fin - inicio;
}

class AcumuladorSalud {
  readonly dias = new Map<string, DiaAcumulado>();
  registros = 0;

  private dia(fecha: string) {
    const actual = this.dias.get(fecha) ?? nuevoDia();
    this.dias.set(fecha, actual);
    return actual;
  }

  contar() {
    this.registros += 1;
    if (this.registros > MAX_REGISTROS) throw new Error("La exportación supera 250.000 registros compatibles. Divide el historial antes de importarlo.");
  }

  peso(fecha: string | null, valor: number | null, momento: number | null) {
    if (!fecha || valor === null || valor < 25 || valor > 400) return;
    const dia = this.dia(fecha);
    if (!dia.peso || (momento ?? 0) >= dia.peso.instante) dia.peso = { valor: Math.round(valor * 100) / 100, instante: momento ?? 0 };
  }

  pasos(fecha: string | null, valor: number | null, fuente = "dispositivo") {
    if (!fecha || valor === null || valor < 0 || valor > 200_000) return;
    const dia = this.dia(fecha);
    dia.pasosPorFuente.set(fuente, (dia.pasosPorFuente.get(fuente) ?? 0) + valor);
  }

  sueno(fecha: string | null, inicio: number | null, fin: number | null, duracion?: number | null) {
    if (!fecha) return;
    if (inicio !== null && fin !== null && fin > inicio) this.dia(fecha).sueno.push([inicio, fin]);
    else if (duracion !== null && duracion !== undefined && duracion > 0 && duracion <= 1_440) {
      const ancla = Date.parse(`${fecha}T12:00:00Z`);
      this.dia(fecha).sueno.push([ancla, ancla + duracion * 60_000]);
    }
  }

  entrenamiento(fecha: string | null, duracion: number | null, clave: string) {
    if (!fecha || duracion === null || duracion <= 0 || duracion > 1_440) return;
    this.dia(fecha).entrenamientos.set(clave, duracion);
  }

  resultado(fuente: FuenteSalud, avisos: string[] = []): ImportacionSalud {
    const dias: Record<string, DiaImportadoSalud> = {};
    for (const [fecha, acumulado] of this.dias) {
      const dia: DiaImportadoSalud = { fecha };
      if (acumulado.peso) dia.peso = acumulado.peso.valor;
      if (acumulado.pasosPorFuente.size) dia.pasos = Math.min(200_000, Math.round(Math.max(...acumulado.pasosPorFuente.values())));
      if (acumulado.sueno.length) dia.suenoMinutos = Math.min(1_440, Math.round(unirIntervalos(acumulado.sueno) / 60_000));
      if (acumulado.entrenamientos.size) dia.entrenamientoMinutos = Math.min(1_440, Math.round([...acumulado.entrenamientos.values()].reduce((a, b) => a + b, 0)));
      if (Object.keys(dia).length > 1) dias[fecha] = dia;
    }
    const fechas = Object.keys(dias).sort();
    return { fuente, dias, registrosLeidos: this.registros, desde: fechas[0] ?? null, hasta: fechas.at(-1) ?? null, avisos };
  }
}

function procesarEtiquetasAppleHealth(xml: string, acumulador: AcumuladorSalud, avisos: Set<string>) {
  for (const match of xml.matchAll(/<(Record|Workout)\b[^>]*\/?>/g)) {
    const clase = match[1];
    const a = atributos(match[0]);
    if (clase === "Workout") {
      acumulador.contar();
      const duracion = minutos(a.duration, a.durationUnit);
      const fecha = fechaDe(a.startDate);
      acumulador.entrenamiento(fecha, duracion, `${a.startDate}|${a.endDate}|${a.workoutActivityType}`);
      continue;
    }
    const tipo = (a.type ?? "").toLowerCase();
    if (tipo.endsWith("bodymass")) {
      acumulador.contar();
      acumulador.peso(fechaDe(a.startDate), kg(a.value, a.unit), instante(a.startDate));
    } else if (tipo.includes("stepcount")) {
      acumulador.contar();
      acumulador.pasos(fechaDe(a.startDate), numero(a.value), a.sourceName || "Apple Health");
    }
    else if (tipo.includes("sleepanalysis")) {
      const estado = (a.value ?? "").toLowerCase();
      if (estado.includes("asleep") || estado.includes("inbed")) {
        acumulador.contar();
        acumulador.sueno(fechaDe(a.endDate) ?? fechaDe(a.startDate), instante(a.startDate), instante(a.endDate));
        if (estado.includes("inbed")) avisos.add("Apple registró tiempo en cama. RITMO lo mostrará como sueño y puede incluir periodos despierto.");
      }
    }
  }
}

function contenidoElemento(xml: string, nombre: string): string | null {
  return xml.match(new RegExp(`<${nombre}\\b[^>]*>([^<]*)<\\/${nombre}>`, "i"))?.[1]?.trim() || null;
}

/**
 * Apple también genera export_cda.xml. Algunos historiales concatenan entradas
 * después de cerrar ClinicalDocument; leer las observaciones de forma tolerante
 * recupera los datos sin exigir que ese documento sea XML estricto.
 */
function procesarAppleHealthCda(xml: string, acumulador: AcumuladorSalud) {
  for (const match of xml.matchAll(/<observation\b[\s\S]*?<\/observation>/gi)) {
    const observacion = match[0];
    const tipo = (contenidoElemento(observacion, "type") ?? "").toLowerCase();
    if (!/(?:bodymass|stepcount|sleepanalysis)$/.test(tipo)) continue;
    const despuesDelTexto = observacion.split(/<\/text>/i).at(-1) ?? observacion;
    const valorTag = despuesDelTexto.match(/<value\b[^>]*\/?>/i)?.[0] ?? "";
    const valor = atributos(valorTag);
    const inicio = atributos(observacion.match(/<low\b[^>]*\/?>/i)?.[0] ?? "").value;
    const fin = atributos(observacion.match(/<high\b[^>]*\/?>/i)?.[0] ?? "").value;
    const fuente = contenidoElemento(observacion, "sourceName") ?? "Apple Health";
    acumulador.contar();
    if (tipo.endsWith("bodymass")) acumulador.peso(fechaDe(inicio ?? fin), kg(valor.value, valor.unit), instante(inicio ?? fin));
    else if (tipo.includes("stepcount")) acumulador.pasos(fechaDe(inicio ?? fin), numero(valor.value), fuente);
    else if ((valor.code ?? valor.value ?? "").toLowerCase().includes("asleep")) {
      acumulador.sueno(fechaDe(fin) ?? fechaDe(inicio), instante(inicio), instante(fin));
    }
  }
}

export function interpretarAppleHealthXml(xml: string): ImportacionSalud {
  const acumulador = new AcumuladorSalud();
  const avisos = new Set<string>();
  procesarEtiquetasAppleHealth(xml, acumulador, avisos);
  if (/<ClinicalDocument\b|<observation\b/i.test(xml)) procesarAppleHealthCda(xml, acumulador);
  return acumulador.resultado("apple-health", [...avisos]);
}

/** Lee export.xml por bloques para que historiales grandes no dupliquen cientos
 * de megabytes en memoria. Los tags de Apple contienen toda la información
 * compatible en su apertura; el pequeño remanente conserva tags entre bloques. */
export async function interpretarAppleHealthArchivo(archivo: Blob): Promise<ImportacionSalud> {
  const cabecera = await archivo.slice(0, 8_192).text();
  if (/<ClinicalDocument\b/i.test(cabecera)) return interpretarAppleHealthXml(await archivo.text());
  const acumulador = new AcumuladorSalud();
  const avisos = new Set<string>();
  const lector = archivo.stream().getReader();
  const decoder = new TextDecoder();
  let pendiente = "";
  for (;;) {
    const { value, done } = await lector.read();
    pendiente += decoder.decode(value, { stream: !done });
    if (done) break;
    const ultimoTag = pendiente.lastIndexOf("<");
    if (ultimoTag <= 0) continue;
    procesarEtiquetasAppleHealth(pendiente.slice(0, ultimoTag), acumulador, avisos);
    pendiente = pendiente.slice(ultimoTag);
  }
  procesarEtiquetasAppleHealth(pendiente, acumulador, avisos);
  return acumulador.resultado("apple-health", [...avisos]);
}

function claveNormalizada(valor: string): string {
  return valor.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

function valorPorClaves(objeto: Record<string, unknown>, claves: string[]): unknown {
  const entradas = new Map(Object.entries(objeto).map(([k, v]) => [claveNormalizada(k), v]));
  for (const clave of claves) if (entradas.has(claveNormalizada(clave))) return entradas.get(claveNormalizada(clave));
  return undefined;
}

function procesarRegistro(objeto: Record<string, unknown>, pista: string, acumulador: AcumuladorSalud): boolean {
  const tipo = String(valorPorClaves(objeto, ["recordType", "dataType", "type", "name"]) ?? pista).toLowerCase();
  const inicioRaw = valorPorClaves(objeto, ["startTime", "startDate", "start", "time", "date", "fecha"]);
  const finRaw = valorPorClaves(objeto, ["endTime", "endDate", "end"]);
  const fechaInicio = fechaDe(inicioRaw);
  const fechaFin = fechaDe(finRaw);
  const unidad = valorPorClaves(objeto, ["unit", "unidad", "durationUnit"]);
  const valor = valorPorClaves(objeto, ["value", "valor", "count", "weight", "mass", "duration", "minutes"]);
  if (/weight|bodymass|peso/.test(tipo)) {
    acumulador.peso(fechaInicio ?? fechaFin, kg(valor, unidad), instante(inicioRaw));
    return true;
  }
  if (/step|pasos/.test(tipo)) {
    acumulador.pasos(fechaInicio ?? fechaFin, numero(valor), String(valorPorClaves(objeto, ["source", "sourceName", "device", "origin"]) ?? "Health Connect"));
    return true;
  }
  if (/sleep|sueno/.test(tipo)) {
    const duracion = minutos(valorPorClaves(objeto, ["duration", "minutes", "value"]), unidad);
    acumulador.sueno(fechaFin ?? fechaInicio, instante(inicioRaw), instante(finRaw), duracion);
    return true;
  }
  if (/exercise|workout|activitysession|entrenamiento/.test(tipo)) {
    const inicio = instante(inicioRaw);
    const fin = instante(finRaw);
    const calculada = inicio !== null && fin !== null && fin > inicio ? (fin - inicio) / 60_000 : null;
    const duracion = calculada ?? minutos(valorPorClaves(objeto, ["duration", "minutes", "value"]), unidad);
    acumulador.entrenamiento(fechaInicio ?? fechaFin, duracion, `${String(inicioRaw)}|${String(finRaw)}|${tipo}`);
    return true;
  }
  return false;
}

export function interpretarHealthConnectJson(texto: string): ImportacionSalud {
  let raiz: unknown;
  try { raiz = JSON.parse(texto); }
  catch { throw new Error("El JSON de salud no tiene un formato válido."); }
  const acumulador = new AcumuladorSalud();
  const visitar = (valor: unknown, pista = "", profundidad = 0) => {
    if (profundidad > 18) return;
    if (Array.isArray(valor)) { for (const item of valor) visitar(item, pista, profundidad + 1); return; }
    if (!valor || typeof valor !== "object") return;
    const objeto = valor as Record<string, unknown>;
    if (procesarRegistro(objeto, pista, acumulador)) acumulador.contar();
    for (const [clave, hijo] of Object.entries(objeto)) if (hijo && typeof hijo === "object") visitar(hijo, clave, profundidad + 1);
  };
  visitar(raiz);
  return acumulador.resultado("health-connect");
}

function filasCsv(texto: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = "";
  let comillas = false;
  for (let i = 0; i < texto.length; i += 1) {
    const c = texto[i];
    if (c === '"') {
      if (comillas && texto[i + 1] === '"') { campo += '"'; i += 1; }
      else comillas = !comillas;
    } else if (c === "," && !comillas) { fila.push(campo); campo = ""; }
    else if ((c === "\n" || c === "\r") && !comillas) {
      if (c === "\r" && texto[i + 1] === "\n") i += 1;
      fila.push(campo); campo = "";
      if (fila.some(Boolean)) filas.push(fila);
      fila = [];
    } else campo += c;
  }
  fila.push(campo);
  if (fila.some(Boolean)) filas.push(fila);
  return filas;
}

export function interpretarHealthConnectCsv(texto: string, nombre = "health-connect.csv"): ImportacionSalud {
  const filas = filasCsv(texto.replace(/^\uFEFF/, ""));
  if (filas.length < 2) throw new Error("El CSV de salud está vacío.");
  const cabecera = filas[0].map(c => c.trim());
  const acumulador = new AcumuladorSalud();
  for (const valores of filas.slice(1)) {
    const objeto = Object.fromEntries(cabecera.map((clave, i) => [clave, valores[i]?.trim() ?? ""]));
    if (procesarRegistro(objeto, nombre, acumulador)) acumulador.contar();
  }
  return acumulador.resultado("health-connect");
}

export function interpretarTextoSalud(texto: string, nombre: string): ImportacionSalud {
  const minusculas = nombre.toLowerCase();
  if (minusculas.endsWith(".xml") || /<HealthData\b|<Record\b|<Workout\b/.test(texto.slice(0, 5_000))) return interpretarAppleHealthXml(texto);
  if (minusculas.endsWith(".csv")) return interpretarHealthConnectCsv(texto, nombre);
  return interpretarHealthConnectJson(texto);
}

export function combinarImportacionesSalud(importaciones: ImportacionSalud[]): ImportacionSalud {
  if (!importaciones.length) throw new Error("No se encontró ningún archivo de salud compatible.");
  const dias: Record<string, DiaImportadoSalud> = {};
  for (const importacion of importaciones) {
    for (const [fecha, dia] of Object.entries(importacion.dias)) dias[fecha] = { ...(dias[fecha] ?? { fecha }), ...dia, fecha };
  }
  const fechas = Object.keys(dias).sort();
  return {
    fuente: importaciones.some(i => i.fuente === "apple-health") ? "apple-health" : "health-connect",
    dias,
    registrosLeidos: importaciones.reduce((total, i) => total + i.registrosLeidos, 0),
    desde: fechas[0] ?? null,
    hasta: fechas.at(-1) ?? null,
    avisos: [...new Set(importaciones.flatMap(i => i.avisos))],
  };
}

export function prepararImportacionSalud(
  importacion: ImportacionSalud,
  estado: Estado,
  seleccion: SeleccionSalud,
  conservarExistentes: boolean,
): { datos: Partial<StoreData>; resumen: ResumenAplicacionSalud } {
  const dias: StoreData["dias"] = {};
  const composicion = [] as StoreData["composicion"];
  const resumen: ResumenAplicacionSalud = { dias: 0, peso: 0, pasos: 0, sueno: 0, entrenamiento: 0, omitidos: 0 };
  for (const [fecha, origen] of Object.entries(importacion.dias)) {
    const actual = estado.dias[fecha];
    const siguiente = structuredClone(actual ?? { fecha, habitos: {} });
    let cambio = false;
    const aplicar = (metrica: Exclude<MetricaSalud, "peso">, campo: "pasos" | "suenoMinutos" | "entrenamientoMinutos", valor: number | undefined) => {
      if (!seleccion[metrica] || valor === undefined) return;
      if (conservarExistentes && siguiente[campo] !== undefined) { resumen.omitidos += 1; return; }
      siguiente[campo] = valor;
      resumen[metrica] += 1;
      cambio = true;
    };
    aplicar("pasos", "pasos", origen.pasos);
    aplicar("sueno", "suenoMinutos", origen.suenoMinutos);
    aplicar("entrenamiento", "entrenamientoMinutos", origen.entrenamientoMinutos);
    if (seleccion.peso && origen.peso !== undefined) {
      const medicionActual = estado.composicion.find(m => m.fecha === fecha);
      if (conservarExistentes && (medicionActual?.peso !== undefined || actual?.peso !== undefined)) resumen.omitidos += 1;
      else {
        siguiente.peso = origen.peso;
        composicion.push({ ...(medicionActual ?? {}), fecha, peso: origen.peso });
        resumen.peso += 1;
        cambio = true;
      }
    }
    if (cambio) { dias[fecha] = siguiente; resumen.dias += 1; }
  }
  return { datos: { dias, composicion }, resumen };
}

export function totalesImportacionSalud(importacion: ImportacionSalud) {
  const dias = Object.values(importacion.dias);
  return {
    dias: dias.length,
    peso: dias.filter(d => d.peso !== undefined).length,
    pasos: dias.filter(d => d.pasos !== undefined).length,
    sueno: dias.filter(d => d.suenoMinutos !== undefined).length,
    entrenamiento: dias.filter(d => d.entrenamientoMinutos !== undefined).length,
  };
}
