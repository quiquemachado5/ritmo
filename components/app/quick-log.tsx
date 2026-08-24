"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Check,
  ListChecks,
  Loader2,
  Scale,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useIsDesktop } from "@/hooks/use-media-query";
import { useRitmo } from "@/lib/store/provider";
import { HABITOS } from "@/lib/model/config";
import { analizarComida } from "@/lib/nutrition/client";
import type { AnalisisNutricional } from "@/lib/nutrition/types";
import type { Comida, TipoComida } from "@/lib/model/types";
import { fmtFechaLarga, capitalizar } from "@/lib/format";
import { Chip, MacroBar } from "./primitives";
import { useQuickLog, type QuickTab } from "./quick-log-provider";

const TABS: { id: QuickTab; label: string; icon: typeof Scale }[] = [
  { id: "comida", label: "Comida", icon: UtensilsCrossed },
  { id: "peso", label: "Peso", icon: Scale },
  { id: "habitos", label: "Hábitos", icon: ListChecks },
];

export function QuickLog() {
  const { abierto, cerrar, tab, setTab, fecha } = useQuickLog();
  const isDesktop = useIsDesktop();

  const pestanas = (
    <div className="flex gap-1.5">
      {TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => setTab(t.id)}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-colors",
            tab === t.id
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/70",
          )}
        >
          <t.icon className="size-4" />
          {t.label}
        </button>
      ))}
    </div>
  );

  const panel = (
    <>
      {tab === "comida" && <PanelComida fecha={fecha} onDone={cerrar} />}
      {tab === "peso" && <PanelPeso fecha={fecha} onDone={cerrar} />}
      {tab === "habitos" && <PanelHabitos fecha={fecha} />}
    </>
  );

  const titulo = "Registrar";
  const sub = capitalizar(fmtFechaLarga(fecha));

  if (isDesktop) {
    return (
      <Dialog open={abierto} onOpenChange={(o) => !o && cerrar()}>
        {/* `sm:max-w-*` debe fijarse aquí: el DialogContent base trae
            `sm:max-w-lg` y tailwind-merge no lo tumba con un `max-w-*` sin
            variante, así que en escritorio se quedaba clavado en 512 px. */}
        <DialogContent className="flex max-h-[88vh] w-[calc(100%-2rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="shrink-0 border-b border-border px-6 pt-5 pb-4">
            <DialogTitle className="font-display text-xl">{titulo}</DialogTitle>
            <DialogDescription>{sub}</DialogDescription>
            <div className="pt-3">{pestanas}</div>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-5">{panel}</div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={abierto} onOpenChange={(o) => !o && cerrar()}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader className="shrink-0 text-left">
          <DrawerTitle className="font-display text-xl">{titulo}</DrawerTitle>
          <DrawerDescription>{sub}</DrawerDescription>
          <div className="pt-3">{pestanas}</div>
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-8">{panel}</div>
      </DrawerContent>
    </Drawer>
  );
}

/* ---------------------------------------------------------------- COMIDA */

const TIPOS: { id: TipoComida; label: string }[] = [
  { id: "desayuno", label: "Desayuno" },
  { id: "comida", label: "Comida" },
  { id: "cena", label: "Cena" },
  { id: "snack", label: "Snack" },
];

function PanelComida({ fecha, onDone }: { fecha: string; onDone: () => void }) {
  const { registrarComida } = useRitmo();
  const [texto, setTexto] = React.useState("");
  const [tipo, setTipo] = React.useState<TipoComida>("comida");
  const [analizando, setAnalizando] = React.useState(false);
  const [analisis, setAnalisis] = React.useState<AnalisisNutricional | null>(null);

  async function analizar() {
    if (!texto.trim()) return;
    setAnalizando(true);
    setAnalisis(null);
    try {
      setAnalisis(await analizarComida(texto));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo analizar la comida.");
    } finally {
      setAnalizando(false);
    }
  }

  async function anadir() {
    if (!analisis) return;
    const comida: Comida = {
      id: crypto.randomUUID(),
      tipo,
      texto: analisis.resumen || texto,
      kcal: analisis.kcal,
      proteinas: analisis.proteinas,
      carbohidratos: analisis.carbohidratos,
      grasas: analisis.grasas,
      estimado: analisis.fuente === "offline",
      creado: new Date().toISOString(),
    };
    await registrarComida(fecha, comida);
    toast.success(`Comida añadida (${analisis.kcal} kcal)`);
    onDone();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {TIPOS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTipo(t.id)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors",
              tipo === t.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <Textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Escribe lo que has comido: 2 huevos revueltos, tostada integral y café con leche…"
        rows={3}
        className="resize-none text-base"
      />
      <Button onClick={analizar} disabled={analizando || !texto.trim()} variant="secondary" className="gap-2">
        {analizando ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4 text-primary" />}
        {analizando ? "Analizando…" : "Calcular calorías y macros"}
      </Button>

      {analisis && (
        <div className="rounded-xl border border-border bg-secondary/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-display text-2xl font-bold tabular text-energy">
              {analisis.kcal}
              <span className="ml-1 text-sm font-medium text-muted-foreground">kcal</span>
            </span>
            <Chip tone={analisis.fuente === "offline" ? "warning" : "weight"}>
              {analisis.fuente === "edamam" ? "Edamam" : analisis.fuente === "claude" ? "IA" : "aprox."}
            </Chip>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <MacroBar label="Proteínas" value={analisis.proteinas} colorVar="--weight" />
            <MacroBar label="Carbos" value={analisis.carbohidratos} colorVar="--habit" />
            <MacroBar label="Grasas" value={analisis.grasas} colorVar="--energy" />
          </div>
          {analisis.items.length > 0 && (
            <ul className="mt-3 space-y-1 border-t border-border pt-3 text-sm text-muted-foreground">
              {analisis.items.map((it, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="truncate">{it.nombre}</span>
                  <span className="tabular shrink-0">{it.kcal} kcal</span>
                </li>
              ))}
            </ul>
          )}
          {analisis.aviso && <p className="mt-3 text-xs text-warning-ink">{analisis.aviso}</p>}
          <Button onClick={anadir} className="mt-4 w-full gap-2">
            <Check className="size-4" /> Añadir a {TIPOS.find((t) => t.id === tipo)?.label.toLowerCase()}
          </Button>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- HÁBITOS */

function PanelHabitos({ fecha }: { fecha: string }) {
  const { dia, alternarHabito } = useRitmo();
  const habitos = dia(fecha).habitos || {};

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {HABITOS.map((h) => {
        const hecho = habitos[h.clave] === true;
        return (
          <button
            key={h.clave}
            onClick={() => alternarHabito(fecha, h.clave)}
            className={cn(
              "flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
              hecho ? "border-primary/40 bg-primary/8" : "border-border hover:bg-secondary",
            )}
          >
            <span className={cn("font-medium", hecho ? "text-foreground" : "text-muted-foreground")}>
              {h.etiqueta}
            </span>
            <span
              className={cn(
                "grid size-6 place-items-center rounded-full border-2 transition-colors",
                hecho ? "border-primary bg-primary text-primary-foreground" : "border-border",
              )}
            >
              {hecho && <Check className="size-3.5" strokeWidth={3} />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------------- PESO */

function PanelPeso({ fecha, onDone }: { fecha: string; onDone: () => void }) {
  const { medicion, guardarMedicion } = useRitmo();
  const m = medicion(fecha);
  const [campos, setCampos] = React.useState({
    peso: m?.peso != null ? String(m.peso) : "",
    grasaPct: m?.grasaPct != null ? String(m.grasaPct) : "",
    masaMuscularKg: m?.masaMuscularKg != null ? String(m.masaMuscularKg) : "",
    imc: m?.imc != null ? String(m.imc) : "",
    grasaVisceral: m?.grasaVisceral != null ? String(m.grasaVisceral) : "",
    metabBasalKcal: m?.metabBasalKcal != null ? String(m.metabBasalKcal) : "",
    gastoDiarioKcal: m?.gastoDiarioKcal != null ? String(m.gastoDiarioKcal) : "",
    masaOseaKg: m?.masaOseaKg != null ? String(m.masaOseaKg) : "",
    aguaPct: m?.aguaPct != null ? String(m.aguaPct) : "",
    cintura: m?.cintura != null ? String(m.cintura) : "",
    cadera: m?.cadera != null ? String(m.cadera) : "",
  });
  const set = (k: keyof typeof campos, v: string) => setCampos((c) => ({ ...c, [k]: v }));

  async function guardar() {
    const peso = parseFloat(campos.peso.replace(",", "."));
    if (!Number.isFinite(peso)) {
      toast.error("El peso es obligatorio para una medición.");
      return;
    }
    const num = (s: string) => {
      const n = parseFloat(s.replace(",", "."));
      return Number.isFinite(n) ? n : undefined;
    };
    await guardarMedicion({
      fecha,
      peso: Math.round(peso * 10) / 10,
      grasaPct: num(campos.grasaPct),
      masaMuscularKg: num(campos.masaMuscularKg),
      imc: num(campos.imc),
      grasaVisceral: num(campos.grasaVisceral),
      metabBasalKcal: num(campos.metabBasalKcal),
      gastoDiarioKcal: num(campos.gastoDiarioKcal),
      masaOseaKg: num(campos.masaOseaKg),
      aguaPct: num(campos.aguaPct),
      cintura: num(campos.cintura),
      cadera: num(campos.cadera),
    });
    toast.success("Medición guardada");
    onDone();
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Básico</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Peso (kg)" value={campos.peso} onChange={(v) => set("peso", v)} placeholder="88,5" />
          <Field label="IMC" value={campos.imc} onChange={(v) => set("imc", v)} placeholder="25,8" />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Composición corporal</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Grasa (%)" value={campos.grasaPct} onChange={(v) => set("grasaPct", v)} placeholder="16,7" />
          <Field label="Masa muscular (kg)" value={campos.masaMuscularKg} onChange={(v) => set("masaMuscularKg", v)} placeholder="70,1" />
          <Field label="Grasa visceral" value={campos.grasaVisceral} onChange={(v) => set("grasaVisceral", v)} placeholder="3" />
          <Field label="Masa ósea (kg)" value={campos.masaOseaKg} onChange={(v) => set("masaOseaKg", v)} placeholder="3,6" />
          <Field label="Agua (%)" value={campos.aguaPct} onChange={(v) => set("aguaPct", v)} placeholder="57" />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Metabolismo</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Metab. basal (kcal)" value={campos.metabBasalKcal} onChange={(v) => set("metabBasalKcal", v)} placeholder="1806" />
          <Field label="Gasto diario (kcal)" value={campos.gastoDiarioKcal} onChange={(v) => set("gastoDiarioKcal", v)} placeholder="3288" />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Medidas</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cintura (cm)" value={campos.cintura} onChange={(v) => set("cintura", v)} placeholder="86" />
          <Field label="Cadera (cm)" value={campos.cadera} onChange={(v) => set("cadera", v)} placeholder="98" />
        </div>
      </div>

      <Button onClick={guardar} className="mt-1 gap-2">
        <Check className="size-4" /> Guardar medición
      </Button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground/80">{label}</span>
      <Input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="tabular" />
    </label>
  );
}
