"use client";

import * as React from "react";
import { Activity, Check, Dumbbell, Footprints, HeartPulse, MoonStar, Scale, ShieldCheck, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { fmtFechaCorta } from "@/lib/format";
import {
  combinarImportacionesSalud,
  interpretarAppleHealthArchivo,
  interpretarTextoSalud,
  prepararImportacionSalud,
  totalesImportacionSalud,
  type FuenteSalud,
  type ImportacionSalud,
  type MetricaSalud,
  type SeleccionSalud,
} from "@/lib/health-import";
import type { Estado } from "@/lib/model/types";
import type { ProgresoImportacion, StoreData } from "@/lib/store/types";
import { cn } from "@/lib/utils";

const LIMITE_ARCHIVO = 250 * 1024 * 1024;
const LIMITE_DESCOMPRIMIDO = 450 * 1024 * 1024;
const CLAVE_ULTIMA = "ritmo:health-import";

type UltimaImportacion = { fecha: string; fuente: FuenteSalud; dias: number };

const FUENTES = {
  "apple-health": {
    nombre: "Apple Health",
    detalle: "Exportación .zip o archivo export.xml",
    ayuda: "En Salud: tu perfil → Exportar todos los datos de salud.",
    icono: HeartPulse,
  },
  "health-connect": {
    nombre: "Health Connect",
    detalle: "Archivos .json, .csv o .zip compatibles",
    ayuda: "Usa una exportación legible de tu app de salud compatible.",
    icono: Activity,
  },
} as const;

const METRICAS: Array<{ id: MetricaSalud; nombre: string; icono: typeof Scale }> = [
  { id: "peso", nombre: "Peso", icono: Scale },
  { id: "pasos", nombre: "Pasos", icono: Footprints },
  { id: "sueno", nombre: "Sueño", icono: MoonStar },
  { id: "entrenamiento", nombre: "Entrenamientos", icono: Dumbbell },
];

function claveUltima(userId: string | null) {
  return `${CLAVE_ULTIMA}:${userId ?? "local"}`;
}

function leerUltima(userId: string | null): UltimaImportacion | null {
  try {
    const raw = localStorage.getItem(claveUltima(userId));
    if (!raw) return null;
    const valor = JSON.parse(raw) as UltimaImportacion;
    return valor && typeof valor.fecha === "string" && typeof valor.dias === "number" ? valor : null;
  } catch { return null; }
}

async function descomprimir(file: File): Promise<Array<{ nombre: string; texto: string }>> {
  if (file.size > LIMITE_ARCHIVO) throw new Error("El archivo supera 250 MB. Extrae export.xml y selecciónalo directamente.");
  if (!file.name.toLowerCase().endsWith(".zip")) return [{ nombre: file.name, texto: await file.text() }];
  const { unzip, strFromU8 } = await import("fflate");
  const bytes = new Uint8Array(await file.arrayBuffer());
  let tamanoPrevisto = 0;
  const archivos = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
    unzip(bytes, {
      filter: entrada => {
        const compatible = /(?:^|\/)(?:export\.xml|[^/]+\.(?:json|csv))$/i.test(entrada.name);
        if (!compatible || entrada.originalSize > LIMITE_DESCOMPRIMIDO || tamanoPrevisto + entrada.originalSize > LIMITE_DESCOMPRIMIDO) return false;
        tamanoPrevisto += entrada.originalSize;
        return true;
      },
    }, (error, data) => error ? reject(error) : resolve(data));
  });
  const entradas = Object.entries(archivos);
  const exportXml = entradas.find(([nombre]) => /(?:^|\/)export\.xml$/i.test(nombre));
  const elegidas = exportXml ? [exportXml] : entradas;
  const total = elegidas.reduce((suma, [, data]) => suma + data.byteLength, 0);
  if (!elegidas.length) throw new Error("El ZIP no contiene export.xml ni archivos JSON o CSV legibles.");
  if (total > LIMITE_DESCOMPRIMIDO) throw new Error("El contenido descomprimido supera 450 MB. Importa un periodo más corto.");
  return elegidas.map(([nombre, data]) => ({ nombre, texto: strFromU8(data) }));
}

async function leerArchivo(file: File, fuenteEsperada: FuenteSalud): Promise<ImportacionSalud> {
  if (file.size > LIMITE_ARCHIVO) throw new Error(file.name.toLowerCase().endsWith(".zip")
    ? "El ZIP supera 250 MB. Extrae export.xml y selecciónalo directamente."
    : "El archivo supera 250 MB. Exporta un periodo más corto para importarlo.");
  const resultado = file.name.toLowerCase().endsWith(".xml")
    ? await interpretarAppleHealthArchivo(file)
    : combinarImportacionesSalud((await descomprimir(file)).map(({ nombre, texto }) => interpretarTextoSalud(texto, nombre)));
  const dias = Object.keys(resultado.dias).length;
  if (!dias) {
    if (fuenteEsperada === "health-connect") throw new Error("No encontré peso, pasos, sueño ni entrenamientos en un formato legible. La copia cifrada de Android debe convertirse primero a JSON o CSV.");
    throw new Error("No encontré métricas compatibles en la exportación de Apple Health.");
  }
  return { ...resultado, fuente: fuenteEsperada };
}

export function HealthImport({
  estado,
  userId,
  importar,
  disabled = false,
}: {
  estado: Estado;
  userId: string | null;
  importar: (datos: Partial<StoreData>, progreso?: (estado: ProgresoImportacion) => void) => Promise<void>;
  disabled?: boolean;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const operacionRef = React.useRef(0);
  const [fuenteEsperada, setFuenteEsperada] = React.useState<FuenteSalud>("apple-health");
  const [analizando, setAnalizando] = React.useState(false);
  const [guardando, setGuardando] = React.useState(false);
  const [progreso, setProgreso] = React.useState<ProgresoImportacion | null>(null);
  const [preview, setPreview] = React.useState<ImportacionSalud | null>(null);
  const [seleccion, setSeleccion] = React.useState<SeleccionSalud>({ peso: true, pasos: true, sueno: true, entrenamiento: true });
  const [conservarExistentes, setConservarExistentes] = React.useState(true);
  const [ultima, setUltima] = React.useState<UltimaImportacion | null>(null);

  React.useEffect(() => {
    operacionRef.current += 1;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreview(null); setAnalizando(false); setGuardando(false); setProgreso(null); setUltima(leerUltima(userId));
  }, [userId]);

  const totales = React.useMemo(() => preview ? totalesImportacionSalud(preview) : null, [preview]);
  const aplicacion = React.useMemo(
    () => preview ? prepararImportacionSalud(preview, estado, seleccion, conservarExistentes) : null,
    [preview, estado, seleccion, conservarExistentes],
  );

  function elegirFuente(fuente: FuenteSalud, boton: HTMLButtonElement) {
    setFuenteEsperada(fuente);
    triggerRef.current = boton;
    inputRef.current?.click();
  }

  async function archivoSeleccionado(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file || analizando || guardando) return;
    const operacion = ++operacionRef.current;
    setAnalizando(true);
    try {
      const resultado = await leerArchivo(file, fuenteEsperada);
      if (operacionRef.current !== operacion) return;
      const disponibles = totalesImportacionSalud(resultado);
      setSeleccion({
        peso: disponibles.peso > 0,
        pasos: disponibles.pasos > 0,
        sueno: disponibles.sueno > 0,
        entrenamiento: disponibles.entrenamiento > 0,
      });
      setConservarExistentes(true);
      setPreview(resultado);
    } catch (error) {
      if (operacionRef.current === operacion) toast.error(error instanceof Error ? error.message : "No se pudo leer la exportación de salud.");
    } finally {
      if (operacionRef.current === operacion) setAnalizando(false);
      input.value = "";
    }
  }

  async function confirmar() {
    if (!preview || !aplicacion || aplicacion.resumen.dias === 0 || guardando || disabled) return;
    const operacion = ++operacionRef.current;
    setGuardando(true);
    setProgreso({ porcentaje: 5, etapa: "preparando" });
    try {
      await importar(aplicacion.datos, setProgreso);
      if (operacionRef.current !== operacion) return;
      const siguiente: UltimaImportacion = { fecha: new Date().toISOString(), fuente: preview.fuente, dias: aplicacion.resumen.dias };
      try { localStorage.setItem(claveUltima(userId), JSON.stringify(siguiente)); } catch { /* El historial remoto ya está guardado. */ }
      setUltima(siguiente);
      setPreview(null);
    } catch {
      // El proveedor muestra el motivo y restaura el estado anterior de forma atómica.
    } finally {
      if (operacionRef.current === operacion) { setGuardando(false); setProgreso(null); }
    }
  }

  return (
    <>
      <Card className="overflow-hidden rounded-2xl border-border/80 p-0 shadow-sm">
        <div className="border-b border-border/70 p-4 sm:p-5 lg:p-6">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-weight-wash text-weight ring-1 ring-weight/15"><HeartPulse className="size-5" /></span>
            <div className="min-w-0"><h3 className="text-sm font-semibold">Importa tu actividad y descanso</h3><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Añade peso, pasos, sueño y entrenamientos sin registrarlos a mano. El archivo se analiza en este dispositivo.</p></div>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 sm:divide-x sm:divide-border/70">
          {(Object.entries(FUENTES) as Array<[FuenteSalud, (typeof FUENTES)[FuenteSalud]]>).map(([id, fuente]) => {
            const Icono = fuente.icono;
            return (
              <div key={id} className="flex min-w-0 flex-col gap-3 border-b border-border/70 p-4 last:border-b-0 sm:border-b-0 sm:p-5">
                <div className="flex items-center gap-2.5"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-foreground ring-1 ring-border/70"><Icono className="size-[1.05rem]" /></span><div className="min-w-0"><p className="text-sm font-semibold">{fuente.nombre}</p><p className="truncate text-[0.68rem] text-muted-foreground">{fuente.detalle}</p></div></div>
                <p className="min-h-8 text-xs leading-relaxed text-muted-foreground">{fuente.ayuda}</p>
                <Button type="button" variant="secondary" disabled={disabled || analizando || guardando} onClick={event => elegirFuente(id, event.currentTarget)} className="mt-auto min-h-10 w-full rounded-xl gap-2">
                  <Upload className="size-4" /> {analizando && fuenteEsperada === id ? "Analizando…" : "Seleccionar archivo"}
                </Button>
              </div>
            );
          })}
        </div>
        <div className="flex flex-col gap-2 border-t border-border/70 bg-secondary/30 px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <span className="flex items-center gap-2"><ShieldCheck className="size-4 shrink-0 text-primary" /> Solo se guardan las métricas que confirmes.</span>
          {ultima && <span className="tabular">Última: {fmtFechaCorta(ultima.fecha.slice(0, 10))} · {ultima.dias} días</span>}
        </div>
      </Card>
      <input ref={inputRef} hidden type="file" accept=".zip,.xml,.json,.csv,application/zip,text/xml,application/json,text/csv" onChange={archivoSeleccionado} />

      <Dialog open={!!preview} onOpenChange={open => { if (!open && !guardando) setPreview(null); }}>
        {preview && totales && aplicacion && (
          <DialogContent showCloseButton={false} className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl p-5 sm:max-w-md" onEscapeKeyDown={event => { if (guardando) event.preventDefault(); }} onInteractOutside={event => { if (guardando) event.preventDefault(); }} onCloseAutoFocus={event => { event.preventDefault(); triggerRef.current?.focus(); }} aria-busy={guardando}>
            <div>
              <DialogTitle className="font-display text-xl font-bold">Tu salud, lista para importar</DialogTitle>
              <DialogDescription className="mt-1.5 leading-relaxed">{FUENTES[preview.fuente].nombre} · {totales.dias} {totales.dias === 1 ? "día" : "días"}{preview.desde && preview.hasta ? ` · ${fmtFechaCorta(preview.desde)}${preview.desde === preview.hasta ? "" : `–${fmtFechaCorta(preview.hasta)}`}` : ""}</DialogDescription>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {METRICAS.map(({ id, nombre, icono: Icono }) => {
                const cantidad = totales[id];
                const activa = seleccion[id];
                return (
                  <button key={id} type="button" disabled={!cantidad || guardando} onClick={() => setSeleccion(actual => ({ ...actual, [id]: !actual[id] }))} aria-pressed={activa} className={cn("flex min-h-[4.5rem] items-center gap-2.5 rounded-xl border p-3 text-left transition-colors", activa && cantidad ? "border-primary/30 bg-primary/7" : "border-border bg-secondary/30 text-muted-foreground", !cantidad && "opacity-55")}>
                    <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", activa && cantidad ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground ring-1 ring-border")}><Icono className="size-4" /></span>
                    <span className="min-w-0"><span className="block text-xs font-semibold">{nombre}</span><span className="mt-0.5 block text-[0.68rem] tabular text-muted-foreground">{cantidad} {cantidad === 1 ? "día" : "días"}</span></span>
                    {activa && cantidad > 0 && <Check className="ml-auto size-4 shrink-0 text-primary" />}
                  </button>
                );
              })}
            </div>

            {preview.avisos.map(aviso => <p key={aviso} className="rounded-xl border border-warning-border bg-warning-wash px-3.5 py-3 text-xs leading-relaxed text-warning-ink">{aviso}</p>)}

            <div className="flex items-start justify-between gap-4 rounded-xl border border-border/80 px-3.5 py-3">
              <div><p className="text-sm font-semibold">Conservar mis datos actuales</p><p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">Si una fecha ya tiene esa métrica, RITMO mantiene tu registro.</p></div>
              <Switch checked={conservarExistentes} disabled={guardando} onCheckedChange={setConservarExistentes} aria-label="Conservar datos actuales" />
            </div>

            <div className="rounded-xl bg-secondary/45 px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">{aplicacion.resumen.dias} {aplicacion.resumen.dias === 1 ? "día preparado" : "días preparados"}.</span>{aplicacion.resumen.omitidos > 0 ? ` ${aplicacion.resumen.omitidos} ${aplicacion.resumen.omitidos === 1 ? "valor existente se conservará" : "valores existentes se conservarán"}.` : " No se detectan valores que deban omitirse."} Comidas, hábitos y notas no se modifican.
            </div>

            {guardando && progreso && <div className="space-y-2" role="status" aria-live="polite"><div className="flex justify-between text-xs"><span>Guardando métricas</span><span className="tabular text-muted-foreground">{progreso.porcentaje}%</span></div><Progress value={progreso.porcentaje} /></div>}

            <div className="flex gap-2">
              <Button type="button" variant="secondary" disabled={guardando} onClick={() => setPreview(null)} className="min-h-11 flex-1 rounded-xl">Cancelar</Button>
              <Button type="button" disabled={guardando || disabled || aplicacion.resumen.dias === 0} onClick={() => void confirmar()} className="min-h-11 flex-1 rounded-xl">{guardando ? "Guardando…" : aplicacion.resumen.dias ? `Guardar ${aplicacion.resumen.dias} ${aplicacion.resumen.dias === 1 ? "día" : "días"}` : "Nada nuevo"}</Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
