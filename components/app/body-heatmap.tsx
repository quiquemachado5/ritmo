"use client";

import * as React from "react";
import { Droplets, MessageSquareText, Scale, UtensilsCrossed } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { aISO, diaSemanaLunes, DIAS_SEMANA, hoy, limitesMes, rango, sumarDias } from "@/lib/model/dates";
import { habitosModelo } from "@/lib/model/config";
import { perfilEnFecha } from "@/lib/model/profile-history";
import { estadoAlcoholDia } from "@/lib/model/fluid-retention";
import { eventosDeNota } from "@/lib/model/personal-patterns";
import type { Estado } from "@/lib/model/types";

type Vista = "semana" | "mes" | "ano";

function lecturaDia(estado: Estado, fecha: string) {
  const dia = estado.dias[fecha];
  const activos = habitosModelo(perfilEnFecha(estado, fecha));
  const hechos = activos.filter((habito) => dia?.habitos?.[habito.clave]).length;
  const observado = Boolean(dia && (hechos || dia.comidas?.length || dia.peso != null || dia.notas));
  return { fecha, dia, hechos, total: activos.length, observado, nivel: observado ? Math.round(hechos / Math.max(1, activos.length) * 6) : null };
}

export function BodyHeatmap({ estado }: { estado: Estado }) {
  const [vista, setVista] = React.useState<Vista>("mes");
  const hoyISO = hoy();
  const dias = React.useMemo(() => {
    if (vista === "semana") return rango(sumarDias(hoyISO, -6), hoyISO).map((fecha) => lecturaDia(estado, fecha));
    const { desde, hasta } = limitesMes(hoyISO.slice(0, 7));
    return rango(desde, hasta).map((fecha) => lecturaDia(estado, fecha));
  }, [estado, hoyISO, vista]);
  const meses = React.useMemo(() => Array.from({ length: 12 }, (_, indice) => {
    const clave = `${hoyISO.slice(0, 4)}-${String(indice + 1).padStart(2, "0")}`;
    const { desde, hasta } = limitesMes(clave);
    const lecturas = rango(desde, hasta).map((fecha) => lecturaDia(estado, fecha)).filter((dia) => dia.observado);
    const nivel = lecturas.length ? Math.round(lecturas.reduce((suma, dia) => suma + (dia.nivel ?? 0), 0) / lecturas.length) : null;
    return { clave, nivel, dias: lecturas.length, pesajes: lecturas.filter((dia) => dia.dia?.peso != null).length, contextos: lecturas.filter((dia) => dia.dia?.notas).length };
  }), [estado, hoyISO]);

  return <section aria-labelledby="mapa-corporal">
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3"><div><h2 id="mapa-corporal" className="font-display text-xl font-bold">Mapa corporal</h2><p className="mt-1 text-sm text-muted-foreground">Constancia, báscula, comidas, líquidos y contexto en una sola lectura.</p></div><div className="inline-flex rounded-xl bg-secondary p-1" role="tablist">{(["semana", "mes", "ano"] as const).map((opcion) => <button key={opcion} type="button" role="tab" aria-selected={vista === opcion} onClick={() => setVista(opcion)} className={cn("min-h-9 rounded-lg px-3 text-xs font-semibold transition-colors", vista === opcion ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>{opcion === "ano" ? "Año" : opcion[0].toUpperCase() + opcion.slice(1)}</button>)}</div></div>
    <Card className="p-4 sm:p-5">
      {vista === "ano" ? <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-12">{meses.map((mes) => <article key={mes.clave} className="rounded-xl border border-border p-2.5" style={mes.nivel == null ? undefined : { background: `color-mix(in srgb, var(--constancia-${mes.nivel}) 22%, var(--card))` }}><p className="text-xs font-bold capitalize">{new Intl.DateTimeFormat("es-ES", { month: "short" }).format(new Date(`${mes.clave}-01T00:00:00`))}</p><div className="mt-5 flex items-end justify-between"><span className="font-display text-lg font-bold tabular">{mes.nivel == null ? "—" : `${mes.nivel}/6`}</span><span className="text-[0.6rem] text-muted-foreground">{mes.dias}d</span></div><p className="mt-1 text-[0.58rem] text-muted-foreground">{mes.pesajes} pesos · {mes.contextos} notas</p></article>)}</div> : <div>
        {vista === "mes" && <div className="mb-2 grid grid-cols-7 gap-1">{DIAS_SEMANA.map((dia) => <span key={dia} className="text-center text-[0.62rem] font-semibold text-muted-foreground">{dia.slice(0, 1)}</span>)}</div>}
        <div className={cn("grid gap-1.5", vista === "semana" ? "grid-cols-7" : "grid-cols-7")}>
          {vista === "mes" && Array.from({ length: diaSemanaLunes(dias[0]?.fecha ?? hoyISO) }, (_, i) => <span key={`vacio-${i}`} />)}
          {dias.map(({ fecha, dia, hechos, total, observado, nivel }) => {
            const liquidos = estadoAlcoholDia(estado, sumarDias(fecha, -1)) === "alcohol";
            const contexto = eventosDeNota(dia?.notas).length > 0;
            return <article key={fecha} title={`${fecha}: ${observado ? `${hechos} de ${total} hábitos` : "sin registro"}`} className={cn("relative min-h-[4.5rem] rounded-xl border p-2 sm:min-h-24 sm:p-2.5", observado ? "border-transparent" : "border-dashed border-border bg-secondary/20")} style={nivel == null ? undefined : { background: `color-mix(in srgb, var(--constancia-${nivel}) 30%, var(--card))` }}><div className="flex items-start justify-between gap-1"><span className="text-xs font-bold tabular">{vista === "semana" ? DIAS_SEMANA[diaSemanaLunes(fecha)] : Number(fecha.slice(-2))}</span>{fecha === aISO() && <span className="size-1.5 rounded-full bg-foreground" />}</div>{observado && <><p className="mt-2 font-display text-base font-bold tabular sm:text-lg">{hechos}/{total}</p><div className="absolute inset-x-2 bottom-2 flex items-center gap-1.5 text-muted-foreground">{dia?.peso != null && <Scale className="size-3" aria-label="Pesaje" />}{Boolean(dia?.comidas?.length) && <span className="inline-flex items-center gap-0.5 text-[0.58rem]"><UtensilsCrossed className="size-3" />{dia?.comidas?.length}</span>}{liquidos && <Droplets className="size-3 text-water" aria-label="Posible retención" />}{contexto && <MessageSquareText className="size-3 text-body" aria-label="Contexto" />}</div></>}</article>;
          })}
        </div>
      </div>}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3 text-[0.65rem] text-muted-foreground"><span>0/6 <i className="mx-1 inline-block h-2 w-24 rounded-full" style={{ background: "linear-gradient(90deg,var(--constancia-0),var(--constancia-3),var(--constancia-6))" }} /> 6/6</span><span className="inline-flex items-center gap-1"><Scale className="size-3" /> pesaje</span><span className="inline-flex items-center gap-1"><Droplets className="size-3 text-water" /> líquidos</span><span className="inline-flex items-center gap-1"><MessageSquareText className="size-3 text-body" /> contexto</span></div>
    </Card>
  </section>;
}
