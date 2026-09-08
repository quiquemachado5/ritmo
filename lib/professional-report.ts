import { adherenciaPorHabito, pesajes } from "./model/analytics";
import { habitosModelo } from "./model/config";
import { hoy, sumarDias } from "./model/dates";
import type { Estado } from "./model/types";

export type ReportPeriod = "3m" | "6m" | "12m" | "all";
export interface ProfessionalReportOptions {
  period: ReportPeriod;
  identity: boolean;
  weight: boolean;
  body: boolean;
  habits: boolean;
  nutrition: boolean;
  notes: boolean;
  meals: boolean;
}

const escapeHtml = (value: unknown) => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const n = (value: number, digits = 1) => new Intl.NumberFormat("es-ES", { maximumFractionDigits: digits }).format(value);
const fecha = (value: string) => new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`));

function inicio(period: ReportPeriod, fin: string) {
  return period === "all" ? "0000-01-01" : sumarDias(fin, period === "3m" ? -90 : period === "6m" ? -180 : -365);
}

function seccion(title: string, content: string) {
  return `<section><h2>${escapeHtml(title)}</h2>${content}</section>`;
}

function tabla(headers: string[], rows: string[][]) {
  if (!rows.length) return `<p class="empty">Sin datos suficientes en este periodo.</p>`;
  return `<div class="table-wrap"><table><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

/** Documento autónomo, sin red ni identificadores de cuenta. */
export function generarInformeProfesional(estado: Estado, opciones: ProfessionalReportOptions, generado = hoy()): string {
  const desde = inicio(opciones.period, generado);
  const dias = Object.values(estado.dias).filter((d) => d.fecha >= desde && d.fecha <= generado).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const pesos = pesajes(estado).filter((p) => p.fecha >= desde && p.fecha <= generado);
  const primera = pesos[0]; const ultima = pesos.at(-1);
  const cambio = primera && ultima ? ultima.peso - primera.peso : null;
  const comidas = dias.flatMap((d) => (d.comidas ?? []).map((comida) => ({ fecha: d.fecha, ...comida })));
  const kcal = comidas.reduce((suma, comida) => suma + comida.kcal, 0);
  const macros = comidas.reduce((suma, comida) => ({ p: suma.p + comida.proteinas, c: suma.c + comida.carbohidratos, g: suma.g + comida.grasas }), { p: 0, c: 0, g: 0 });
  const activos = habitosModelo(estado.perfil);
  const inicioVentana = opciones.period === "all" ? (dias[0]?.fecha ?? generado) : desde;
  const ventana = Math.max(1, Math.min(36500, Math.round((Date.parse(`${generado}T12:00:00Z`) - Date.parse(`${inicioVentana}T12:00:00Z`)) / 86400000) + 1));
  const habitos = adherenciaPorHabito(estado, activos, ventana);
  const composicion = estado.composicion.filter((c) => c.fecha >= desde && c.fecha <= generado).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const ultimaComposicion = composicion.at(-1);
  const bloques: string[] = [];

  if (opciones.weight) bloques.push(seccion("Evolución de peso", `
    <div class="metrics"><div><strong>${ultima ? `${n(ultima.peso)} kg` : "—"}</strong><span>Último peso</span></div><div><strong>${cambio == null ? "—" : `${cambio > 0 ? "+" : ""}${n(cambio)} kg`}</strong><span>Cambio del periodo</span></div><div><strong>${pesos.length}</strong><span>Pesajes</span></div></div>
    ${tabla(["Fecha", "Peso", "Cambio"], pesos.slice(-24).reverse().map((p, i, lista) => {
      const anterior = lista[i + 1]; const delta = anterior ? p.peso - anterior.peso : null;
      return [escapeHtml(fecha(p.fecha)), `<strong>${n(p.peso)} kg</strong>`, delta == null ? "—" : `${delta > 0 ? "+" : ""}${n(delta)} kg`];
    }))}`));

  if (opciones.body) bloques.push(seccion("Composición corporal", ultimaComposicion ? `
    <p class="lead">Última medición completa: ${escapeHtml(fecha(ultimaComposicion.fecha))}</p>
    <div class="metrics compact"><div><strong>${ultimaComposicion.grasaPct == null ? "—" : `${n(ultimaComposicion.grasaPct)}%`}</strong><span>Grasa</span></div><div><strong>${ultimaComposicion.masaMuscularKg == null ? "—" : `${n(ultimaComposicion.masaMuscularKg)} kg`}</strong><span>Masa muscular</span></div><div><strong>${ultimaComposicion.cintura == null ? "—" : `${n(ultimaComposicion.cintura)} cm`}</strong><span>Cintura</span></div></div>` : `<p class="empty">Sin mediciones de composición en este periodo.</p>`));

  if (opciones.habits) bloques.push(seccion("Constancia de hábitos", `
    <p class="lead">Cumplimiento por hábito durante el periodo seleccionado. Los días sin marcar cuentan como no cumplidos.</p>
    ${tabla(["Hábito", "Días", "Constancia"], habitos.map((h) => [escapeHtml(h.etiqueta), `${h.hechos} de ${h.total}`, `<strong>${n(h.pct, 0)}%</strong>`]))}`));

  if (opciones.nutrition) bloques.push(seccion("Registro nutricional", `
    <div class="metrics"><div><strong>${comidas.length}</strong><span>Comidas registradas</span></div><div><strong>${comidas.length ? `${n(kcal / comidas.length, 0)} kcal` : "—"}</strong><span>Media por comida</span></div><div><strong>${n(macros.p, 0)} g</strong><span>Proteína acumulada</span></div></div>
    <p class="note">Las calorías y macros son estimaciones editables de los registros incluidos; no equivalen a una historia clínica.</p>`));

  if (opciones.meals) bloques.push(seccion("Detalle de comidas", tabla(["Fecha", "Tipo", "Descripción", "Energía"], comidas.slice(-80).reverse().map((comida) => [escapeHtml(fecha(comida.fecha)), escapeHtml(comida.tipo), escapeHtml(comida.texto), `${n(comida.kcal, 0)} kcal`]))));
  if (opciones.notes) bloques.push(seccion("Notas contextuales", tabla(["Fecha", "Nota"], dias.filter((d) => d.notas?.trim()).reverse().map((d) => [escapeHtml(fecha(d.fecha)), escapeHtml(d.notas)]))));

  const nombre = opciones.identity && estado.perfil.nombre?.trim() ? escapeHtml(estado.perfil.nombre.trim()) : "Informe sin nombre";
  const periodo = desde === "0000-01-01" ? "Todo el historial" : `${fecha(desde)} – ${fecha(generado)}`;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Informe RITMO · ${nombre}</title><style>
  :root{color-scheme:light;--ink:#201e18;--muted:#6b6453;--green:#1f6b53;--line:#ded8ca;--paper:#fffefb;--wash:#f1eee5}*{box-sizing:border-box}body{margin:0;background:#f7f5ef;color:var(--ink);font:15px/1.5 Arial,sans-serif}main{width:min(900px,calc(100% - 32px));margin:28px auto;background:var(--paper);padding:42px;border:1px solid var(--line)}header{display:flex;justify-content:space-between;gap:24px;padding-bottom:26px;border-bottom:2px solid var(--green)}.brand{font-size:30px;font-weight:800;letter-spacing:.08em;color:var(--green)}h1{margin:8px 0 2px;font-size:28px}h2{margin:0 0 16px;font-size:19px}p{margin:0}.meta,.lead,.note,.empty{color:var(--muted)}section{padding:26px 0;border-bottom:1px solid var(--line);break-inside:avoid}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--line);border:1px solid var(--line);margin-bottom:18px}.metrics div{display:flex;flex-direction:column;padding:15px;background:var(--wash)}.metrics strong{font-size:22px;color:var(--green)}.metrics span{font-size:12px;color:var(--muted)}.table-wrap{overflow:hidden;border:1px solid var(--line)}table{width:100%;border-collapse:collapse}th,td{padding:9px 11px;text-align:left;border-bottom:1px solid var(--line);vertical-align:top}th{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);background:var(--wash)}td:last-child,th:last-child{text-align:right}.note,.lead{margin-bottom:14px;font-size:13px}.empty{font-style:italic}footer{padding-top:22px;font-size:11px;color:var(--muted)}@media(max-width:600px){main{width:100%;margin:0;padding:24px 18px;border:0}header{display:block}.metrics{grid-template-columns:1fr}.table-wrap{overflow-x:auto}th,td{white-space:normal}}@media print{body{background:white}main{width:100%;margin:0;border:0;padding:12mm}section{break-inside:avoid}button{display:none}@page{size:A4;margin:10mm}}
  </style></head><body><main><header><div><div class="brand">RITMO</div><h1>${nombre}</h1><p class="meta">${escapeHtml(periodo)}</p></div><p class="meta">Generado el ${escapeHtml(fecha(generado))}</p></header>${bloques.join("")}<footer>Documento informativo generado localmente en RITMO. Solo contiene los apartados elegidos por la persona usuaria. No sustituye valoración médica ni nutricional.</footer></main></body></html>`;
}
