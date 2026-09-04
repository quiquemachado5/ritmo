"use client";

import * as React from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Download, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRitmo } from "@/lib/store/provider";
import { useMealPrefs, guardarPlan } from "@/lib/meal-prefs";
import { bibliotecaComidas } from "@/lib/model/analytics";
import { sumarDias } from "@/lib/model/dates";
import { escalarNutrientes, escalarIngrediente, listaCompra } from "@/lib/nutrition/portions";
import type { Comida, TipoComida } from "@/lib/model/types";
import { cn, uid } from "@/lib/utils";

export function MealPlanner({ fecha }: { fecha: string }) {
  const prefs = useMealPrefs();
  const { estado, registrarComida } = useRitmo();
  const [inicio, setInicio] = React.useState(fecha);
  const [dia, setDia] = React.useState(fecha);
  const [seleccion, setSeleccion] = React.useState("");
  const [tipo, setTipo] = React.useState<TipoComida>("comida");
  const [factor, setFactor] = React.useState(1);
  const [busy, setBusy] = React.useState<string | null>(null);
  const saving = React.useRef(false);
  const opciones = React.useMemo(() => {
    const historico = Object.values(bibliotecaComidas(estado)).flat();
    const items = [...prefs.templates.map(t => ({ ...t, texto: t.nombre, key: t.id })), ...prefs.catalog.map(c => ({ ...c, key: c.clave })), ...historico.map(c => ({ ...c, key: c.clave }))];
    return [...new Map(items.map(c => [c.key, c])).values()];
  }, [estado, prefs.templates, prefs.catalog]);
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(inicio, i));
  const semana = prefs.plan.filter(p => dias.includes(p.fecha));
  const compras = listaCompra(semana);
  function anadir() {
    const base = opciones.find(o => o.key === seleccion);
    if (!base || factor <= 0 || factor > 8) { toast.error("Elige un plato y una porción entre 0 y 8."); return; }
    const comida: Comida = { ...escalarNutrientes(base, factor), id: uid(), tipo, texto: base.texto,
      ingredientes: base.ingredientes?.map(i => escalarIngrediente(i, factor)), estimado: true };
    if (!guardarPlan([...prefs.plan, { id: uid(), fecha: dia, comida }])) return;
    toast.success("Añadido al plan. Todavía no cuenta como comida consumida.");
  }
  function descargarCompra() {
    const text = [`Compra · ${inicio} a ${dias[6]}`, ...compras.map(i => `${i.nombre}: ${i.cantidades.join(" + ")}`)].join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `compra-${inicio}.txt`; a.click(); URL.revokeObjectURL(url);
  }
  return <details className="overflow-hidden rounded-2xl border border-border bg-card">
    <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-4 py-3 marker:hidden sm:px-5"><CalendarDays className="size-5 text-primary" /><div className="min-w-0 flex-1"><p className="text-sm font-semibold">Plan de comidas</p><p className="mt-0.5 text-xs text-muted-foreground">Organiza tu semana y prepara la compra.</p></div><Plus className="size-4 text-muted-foreground" /></summary>
    <div className="flex flex-col gap-4 border-t border-border p-4 sm:p-5">
      <div className="flex items-center justify-between"><Button variant="ghost" size="icon" aria-label="Semana anterior" onClick={() => { const next = sumarDias(inicio, -7); setInicio(next); setDia(next); }}><ChevronLeft /></Button><span className="text-sm font-medium">{inicio} – {dias[6]}</span><Button variant="ghost" size="icon" aria-label="Semana siguiente" onClick={() => { const next = sumarDias(inicio, 7); setInicio(next); setDia(next); }}><ChevronRight /></Button></div>
      <div className="flex snap-x gap-2 overflow-x-auto pb-1" aria-label="Día del plan">
        {dias.map(f => <button key={f} onClick={() => setDia(f)} aria-pressed={dia === f} className={cn("min-h-14 min-w-14 flex-1 snap-start rounded-lg border px-2 text-center", dia === f ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground")}><span className="block text-xs">{new Date(f + "T12:00:00").toLocaleDateString("es-ES", { weekday: "short" })}</span><span className="text-sm font-semibold">{Number(f.slice(-2))}</span></button>)}
      </div>
      {opciones.length ? <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_6rem_auto] sm:items-end">
        <label className="min-w-0 text-xs text-muted-foreground">Plato de mi biblioteca<select aria-label="Plato para planificar" value={seleccion} onChange={e => setSeleccion(e.target.value)} className="mt-1 h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-foreground"><option value="">Selecciona un plato</option>{opciones.map(o => <option key={o.key} value={o.key}>{o.texto}</option>)}</select></label>
        <label className="text-xs text-muted-foreground">Momento<select value={tipo} onChange={e => setTipo(e.target.value as TipoComida)} className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 text-foreground">{["desayuno", "comida", "cena", "snack"].map(t => <option key={t}>{t}</option>)}</select></label>
        <label className="text-xs text-muted-foreground">Porciones<Input type="number" min={0.25} max={8} step={0.25} value={factor} onChange={e => setFactor(Number(e.target.value))} className="mt-1" /></label>
        <Button onClick={anadir} disabled={!seleccion}><Plus className="size-4" />Planificar</Button>
      </div> : <p className="text-sm text-muted-foreground">Guarda tu primera comida o plantilla en la biblioteca para poder organizarla aquí.</p>}
      <ul className="divide-y divide-border">
        {semana.filter(p => p.fecha === dia).map(p => <li key={p.id} className="flex items-center gap-2 py-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{p.comida.texto}</p><p className="text-xs text-muted-foreground">{p.comida.tipo} · {p.comida.kcal} kcal{p.registrada ? " · registrada" : " · planificada"}</p></div>
          <Button variant="secondary" size="sm" aria-label={p.registrada ? "Comida registrada" : `Registrar ${p.comida.texto} como consumida`} disabled={Boolean(busy) || p.registrada} onClick={async () => {
            if (saving.current) return; saving.current = true; setBusy(p.id);
            const ok = await registrarComida(p.fecha, { ...p.comida, id: `plan-${p.id}`, creado: new Date().toISOString() });
            if (ok) guardarPlan(prefs.plan.map(x => x.id === p.id ? { ...x, registrada: true } : x));
            saving.current = false; setBusy(null);
          }}><Check className="size-4" /><span className="hidden sm:inline">{p.registrada ? "Registrada" : "Ya la comí"}</span></Button>
          <Button variant="ghost" size="icon" aria-label={`Quitar ${p.comida.texto} del plan`} onClick={() => guardarPlan(prefs.plan.filter(x => x.id !== p.id))}><Trash2 className="size-4" /></Button>
        </li>)}
      </ul>
      {!semana.some(p => p.fecha === dia) && <p className="text-sm text-muted-foreground">Todavía no has planificado comidas para este día. Planificar no modifica tu balance.</p>}
      {compras.length > 0 && <details className="border-t border-border pt-3"><summary className="cursor-pointer text-sm font-semibold">Lista de compra · {compras.length} ingredientes</summary><p className="mt-2 text-xs text-muted-foreground">Las cantidades se muestran tal como las registraste; revisa unidades antes de comprar.</p><ul className="my-3 divide-y divide-border">{compras.map(i => <li key={i.nombre} className="py-2 text-sm"><span className="font-medium">{i.nombre}</span><span className="ml-2 text-muted-foreground">{i.cantidades.join(" + ")}</span></li>)}</ul><Button variant="secondary" onClick={descargarCompra}><Download className="size-4" />Descargar lista</Button></details>}
    </div>
  </details>;
}
