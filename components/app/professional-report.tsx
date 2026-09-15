"use client";

import * as React from "react";
import { Download, FileHeart, Printer, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Estado } from "@/lib/model/types";
import { generarInformeProfesional, type ProfessionalReportOptions, type ReportPeriod } from "@/lib/professional-report";

const INICIAL: ProfessionalReportOptions = { period: "6m", identity: true, weight: true, body: true, habits: true, health: true, nutrition: true, notes: false, meals: false };
const CAMPOS = [
  ["weight", "Evolución de peso", "Pesajes reales y cambio del periodo"],
  ["body", "Composición corporal", "Última grasa, músculo y cintura disponibles"],
  ["habits", "Hábitos", "Cumplimiento por cada hábito activo"],
  ["health", "Actividad y descanso", "Pasos, sueño y entrenamiento importados"],
  ["nutrition", "Resumen nutricional", "Totales de kcal y macros registrados"],
  ["notes", "Notas contextuales", "Puede contener información personal"],
  ["meals", "Texto de las comidas", "El detalle más sensible del informe"],
] as const;

export function ProfessionalReport({ estado }: { estado: Estado }) {
  const [open, setOpen] = React.useState(false);
  const [options, setOptions] = React.useState(INICIAL);
  const html = React.useMemo(() => generarInformeProfesional(estado, options), [estado, options]);
  const selected = CAMPOS.filter(([key]) => options[key]).length;

  function descargar() {
    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    const enlace = document.createElement("a");
    enlace.href = url; enlace.download = `ritmo-informe-${new Date().toISOString().slice(0, 10)}.html`; enlace.click();
    URL.revokeObjectURL(url);
  }

  function imprimir() {
    const ventana = window.open("", "_blank");
    if (!ventana) return;
    ventana.document.open(); ventana.document.write(html); ventana.document.close();
    ventana.addEventListener("load", () => ventana.print(), { once: true });
  }

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button variant="secondary" className="h-auto min-h-10 w-full rounded-lg gap-2 py-2 whitespace-normal sm:w-auto"><FileHeart className="size-4" /> Informe profesional</Button></DialogTrigger>
    <DialogContent className="grid h-[calc(100dvh-1rem)] min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-xl p-0 sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:max-w-2xl">
      <DialogHeader className="border-b border-border px-5 py-5 text-left sm:px-6">
        <DialogTitle className="font-display text-xl">Informe para nutricionista</DialogTitle>
        <DialogDescription>Elige exactamente qué compartir. Se genera en este dispositivo y nunca incluye tu correo.</DialogDescription>
      </DialogHeader>
      <div className="overflow-y-auto py-5">
      <div className="grid gap-5 px-5 sm:grid-cols-[12rem_minmax(0,1fr)] sm:px-6">
        <div>
          <label htmlFor="report-period" className="text-sm font-semibold">Periodo</label>
          <Select value={options.period} onValueChange={(period: ReportPeriod) => setOptions((prev) => ({ ...prev, period }))}>
            <SelectTrigger id="report-period" className="mt-2 h-11 w-full rounded-lg"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="3m">Últimos 3 meses</SelectItem><SelectItem value="6m">Últimos 6 meses</SelectItem><SelectItem value="12m">Últimos 12 meses</SelectItem><SelectItem value="all">Todo el historial</SelectItem></SelectContent>
          </Select>
          <label className="mt-4 flex min-h-11 items-center gap-3 rounded-lg border border-border px-3 text-sm font-medium"><Checkbox checked={options.identity} onCheckedChange={(checked) => setOptions((prev) => ({ ...prev, identity: checked === true }))} /> Mostrar mi nombre</label>
        </div>
        <div className="divide-y divide-border rounded-xl border border-border">
          {CAMPOS.map(([key, title, detail]) => <label key={key} className="flex min-h-14 cursor-pointer items-center gap-3 px-3 py-2.5">
            <Checkbox checked={options[key]} onCheckedChange={(checked) => setOptions((prev) => ({ ...prev, [key]: checked === true }))} aria-label={title} />
            <span className="min-w-0"><span className="block text-sm font-semibold">{title}</span><span className="block text-xs leading-relaxed text-muted-foreground">{detail}</span></span>
          </label>)}
        </div>
      </div>
      <div className="mx-5 mt-5 flex items-start gap-2.5 rounded-xl bg-weight-wash px-3 py-2.5 text-xs leading-relaxed text-weight-ink sm:mx-6"><ShieldCheck className="mt-0.5 size-4 shrink-0" /><span>{selected} apartados seleccionados. Notas y textos de comidas empiezan desactivados para proteger tu privacidad.</span></div>
      </div>
      <DialogFooter className="border-t border-border bg-background px-5 py-4 sm:px-6">
        <Button variant="secondary" disabled={!selected} onClick={descargar}><Download className="size-4" /> Descargar HTML</Button>
        <Button disabled={!selected} onClick={imprimir}><Printer className="size-4" /> Imprimir / guardar PDF</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
