"use client";

import * as React from "react";
import { CalendarDays, Flame, Search, Scale, UtensilsCrossed } from "lucide-react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NAV_ITEMS } from "./nav-items";
import { useRitmo } from "@/lib/store/provider";
import { useQuickLog } from "./quick-log-provider";
import { capitalizar, fmtFechaCorta, fmtFechaLarga } from "@/lib/format";
import type { Comida } from "@/lib/model/types";

type Resultado =
  | { id: string; tipo: "accion"; accion: "comida" | "peso" | "habitos"; titulo: string; detalle: string; icono: typeof Search }
  | { id: string; tipo: "ruta"; titulo: string; detalle: string; href: string; icono: typeof Search }
  | { id: string; tipo: "comida"; titulo: string; detalle: string; fecha: string; comida: Comida; icono: typeof Search }
  | { id: string; tipo: "peso"; titulo: string; detalle: string; fecha: string; icono: typeof Search }
  | { id: string; tipo: "dia"; titulo: string; detalle: string; fecha: string; icono: typeof Search };

function normalizar(valor: string): string {
  return valor.toLocaleLowerCase("es-ES").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}

export function GlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const { estado } = useRitmo();
  const { abrir, editarComidaEn } = useQuickLog();
  const [consulta, setConsulta] = React.useState("");
  const [activo, setActivo] = React.useState(0);

  const indice = React.useMemo<Resultado[]>(() => {
    const resultados: Resultado[] = [
      { id: "accion:comida", tipo: "accion", accion: "comida", titulo: "Registrar una comida", detalle: "Añadirla a hoy · atajo R", icono: UtensilsCrossed },
      { id: "accion:peso", tipo: "accion", accion: "peso", titulo: "Registrar peso", detalle: "Recalibrar el modelo · atajo P", icono: Scale },
      { id: "accion:habitos", tipo: "accion", accion: "habitos", titulo: "Revisar hábitos de hoy", detalle: "Completar el día · atajo H", icono: Flame },
      ...NAV_ITEMS.map((item) => ({ id: `ruta:${item.href}`, tipo: "ruta" as const, titulo: item.label, detalle: "Ir a sección", href: item.href, icono: item.icon })),
    ];
    for (const dia of Object.values(estado.dias)) {
      for (const comida of dia.comidas ?? []) {
        resultados.push({ id: `comida:${dia.fecha}:${comida.id}`, tipo: "comida", titulo: comida.texto, detalle: `${fmtFechaCorta(dia.fecha)} · ${comida.kcal} kcal`, fecha: dia.fecha, comida, icono: UtensilsCrossed });
      }
      if (dia.peso != null) resultados.push({ id: `peso:${dia.fecha}`, tipo: "peso", titulo: `${dia.peso.toLocaleString("es-ES")} kg`, detalle: `Pesaje · ${fmtFechaCorta(dia.fecha)}`, fecha: dia.fecha, icono: Scale });
      if (dia.notas?.trim() || Object.values(dia.habitos || {}).some(Boolean)) resultados.push({ id: `dia:${dia.fecha}`, tipo: "dia", titulo: capitalizar(fmtFechaLarga(dia.fecha)), detalle: dia.notas?.trim() ? `Nota · ${dia.notas.trim()}` : "Abrir día en el calendario", fecha: dia.fecha, icono: CalendarDays });
    }
    return resultados;
  }, [estado]);

  const resultados = React.useMemo(() => {
    const q = normalizar(consulta);
    if (!q) return indice.filter((item) => item.tipo === "accion" || item.tipo === "ruta");
    return indice.filter((item) => normalizar(`${item.titulo} ${item.detalle}`).includes(q)).slice(0, 24);
  }, [consulta, indice]);

  function elegir(resultado: Resultado) {
    setConsulta("");
    setActivo(0);
    onOpenChange(false);
    if (resultado.tipo === "accion") abrir(resultado.accion);
    else if (resultado.tipo === "ruta") router.push(resultado.href);
    else if (resultado.tipo === "comida") editarComidaEn(resultado.fecha, resultado.comida);
    else if (resultado.tipo === "peso") abrir("peso", resultado.fecha);
    else router.push(`/calendario?fecha=${resultado.fecha}`);
  }

  return (
    <Dialog open={open} onOpenChange={(siguiente) => { if (!siguiente) { setConsulta(""); setActivo(0); } onOpenChange(siguiente); }}>
      <DialogContent className="top-[max(1rem,env(safe-area-inset-top))] flex max-h-[min(82dvh,42rem)] max-w-2xl translate-y-0 flex-col gap-0 overflow-hidden p-0 sm:top-1/2 sm:-translate-y-1/2 sm:max-w-2xl">
        <DialogHeader className="sr-only"><DialogTitle>Buscar en RITMO</DialogTitle><DialogDescription>Busca secciones, comidas, pesajes y notas.</DialogDescription></DialogHeader>
        <div className="flex items-center gap-3 border-b border-border px-4 py-3 sm:px-5">
          <Search className="size-5 shrink-0 text-muted-foreground" />
          <Input
            autoFocus
            value={consulta}
            onChange={(event) => { setConsulta(event.target.value); setActivo(0); }}
            onKeyDown={(event) => {
              if (!resultados.length) return;
              if (event.key === "ArrowDown") { event.preventDefault(); setActivo((valor) => (valor + 1) % resultados.length); }
              else if (event.key === "ArrowUp") { event.preventDefault(); setActivo((valor) => (valor - 1 + resultados.length) % resultados.length); }
              else if (event.key === "Enter") { event.preventDefault(); elegir(resultados[Math.min(activo, resultados.length - 1)]); }
            }}
            placeholder="Buscar o ejecutar una acción…"
            aria-label="Buscar o ejecutar una acción"
            className="h-11 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
          />
          <kbd className="hidden rounded-md border border-border bg-secondary px-1.5 py-1 text-[0.62rem] text-muted-foreground sm:block">ESC</kbd>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2 sm:p-3" role="listbox" aria-label="Resultados">
          {!consulta && resultados.length > 0 && <p className="px-3 pb-1 pt-2 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">Acciones y destinos</p>}
          {resultados.length > 0 ? resultados.map((resultado, indiceResultado) => (
            <button key={resultado.id} type="button" role="option" aria-selected={indiceResultado === activo} onMouseMove={() => setActivo(indiceResultado)} onClick={() => elegir(resultado)} className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none ${indiceResultado === activo ? "bg-secondary" : ""}`}>
              <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${resultado.tipo === "accion" ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}><resultado.icono className="size-4" /></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{resultado.titulo}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{resultado.detalle}</span></span>
            </button>
          )) : <div className="px-4 py-10 text-center"><p className="text-sm font-semibold">Sin resultados</p><p className="mt-1 text-xs text-muted-foreground">Prueba con otro alimento, fecha o sección.</p></div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
