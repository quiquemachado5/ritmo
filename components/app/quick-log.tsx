"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Check,
  ListChecks,
  Loader2,
  Plus,
  Scale,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";
import { cn, uid } from "@/lib/utils";
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
import { habitosModelo } from "@/lib/model/config";
import { comidasFrecuentes } from "@/lib/model/analytics";
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
  const { abierto, cerrar, tab, setTab, fecha, comidaEdit } = useQuickLog();
  const isDesktop = useIsDesktop();
  const [tecladoAbierto, setTecladoAbierto] = React.useState(false);

  React.useEffect(() => {
    if (!abierto || isDesktop || !window.visualViewport) { setTecladoAbierto(false); return; }
    const viewport = window.visualViewport;
    const actualizar = () => setTecladoAbierto(window.innerHeight - viewport.height > 140);
    actualizar(); viewport.addEventListener("resize", actualizar); viewport.addEventListener("scroll", actualizar);
    return () => { viewport.removeEventListener("resize", actualizar); viewport.removeEventListener("scroll", actualizar); };
  }, [abierto, isDesktop]);

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
      {tab === "comida" && <PanelComida fecha={fecha} onDone={cerrar} comidaEdit={comidaEdit} />}
      {tab === "peso" && <PanelPeso fecha={fecha} onDone={cerrar} />}
      {tab === "habitos" && <PanelHabitos fecha={fecha} />}
    </>
  );

  const titulo = comidaEdit ? "Editar comida" : "Registrar";
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
      <DrawerContent className={cn("max-h-[92dvh]", tecladoAbierto && "max-h-[100dvh] rounded-none")}>
        <DrawerHeader className="shrink-0 text-left">
          <DrawerTitle className="font-display text-xl">{titulo}</DrawerTitle>
          <DrawerDescription>{sub}</DrawerDescription>
          <div className="pt-3">{pestanas}</div>
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-[calc(2rem+env(safe-area-inset-bottom))]">{panel}</div>
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

function PanelComida({ fecha, onDone, comidaEdit }: { fecha: string; onDone: () => void; comidaEdit?: Comida | null }) {
  const { registrarComida, editarComida, estado } = useRitmo();
  const editando = comidaEdit != null;
  const frecuentes = React.useMemo(() => (editando ? [] : comidasFrecuentes(estado, 6)), [estado, editando]);

  async function anadirRapido(base: Comida) {
    await registrarComida(fecha, { ...base, id: uid(), tipo, creado: new Date().toISOString() });
    toast.success(`Añadida: ${base.texto} (${base.kcal} kcal)`);
    onDone();
  }
  const [texto, setTexto] = React.useState(comidaEdit?.texto ?? "");
  const [tipo, setTipo] = React.useState<TipoComida>(comidaEdit?.tipo ?? "comida");
  const [analizando, setAnalizando] = React.useState(false);
  const [analisis, setAnalisis] = React.useState<AnalisisNutricional | null>(null);
  // Valores editables a mano (fuente de verdad al guardar). Se rellenan al
  // analizar o al abrir en modo edición.
  const [manual, setManual] = React.useState<{ kcal: string; p: string; c: string; g: string } | null>(
    comidaEdit
      ? { kcal: String(comidaEdit.kcal), p: String(comidaEdit.proteinas), c: String(comidaEdit.carbohidratos), g: String(comidaEdit.grasas) }
      : null,
  );

  async function analizar() {
    if (!texto.trim()) return;
    setAnalizando(true);
    setAnalisis(null);
    try {
      const res = await analizarComida(texto);
      setAnalisis(res);
      setManual({ kcal: String(res.kcal), p: String(res.proteinas), c: String(res.carbohidratos), g: String(res.grasas) });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo analizar la comida.");
    } finally {
      setAnalizando(false);
    }
  }

  async function guardar() {
    if (!manual) return;
    const n = (s: string) => Math.max(0, Math.round(Number(s.replace(",", ".")) || 0));
    const editadoManual = analisis != null && (
      n(manual.kcal) !== analisis.kcal ||
      n(manual.p) !== analisis.proteinas ||
      n(manual.c) !== analisis.carbohidratos ||
      n(manual.g) !== analisis.grasas
    );
    const editadoExistente = analisis == null && comidaEdit != null && (
      n(manual.kcal) !== comidaEdit.kcal ||
      n(manual.p) !== comidaEdit.proteinas ||
      n(manual.c) !== comidaEdit.carbohidratos ||
      n(manual.g) !== comidaEdit.grasas
    );
    const comida: Comida = {
      id: comidaEdit?.id ?? uid(),
      tipo,
      texto: (analisis?.resumen || texto).trim() || comidaEdit?.texto || "Comida",
      kcal: n(manual.kcal),
      proteinas: n(manual.p),
      carbohidratos: n(manual.c),
      grasas: n(manual.g),
      fuente: analisis ? (editadoManual ? "manual" : analisis.fuente) : editadoExistente ? "manual" : comidaEdit?.fuente,
      // Una IA, una base nutricional y el estimador local parten de cantidades
      // interpretadas. Si el usuario cambia los valores, su ajuste prevalece.
      estimado: analisis ? !editadoManual : editadoExistente ? false : comidaEdit?.estimado,
      creado: comidaEdit?.creado ?? new Date().toISOString(),
    };
    if (editando) {
      await editarComida(fecha, comida);
      toast.success("Comida actualizada");
    } else {
      await registrarComida(fecha, comida);
      toast.success(`Comida añadida (${comida.kcal} kcal)`);
    }
    onDone();
  }

  const setM = (k: "kcal" | "p" | "c" | "g", v: string) => setManual((m) => ({ ...(m ?? { kcal: "0", p: "0", c: "0", g: "0" }), [k]: v }));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {TIPOS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTipo(t.id)}
            className={cn(
              "h-9 rounded-full border px-3 text-sm font-medium transition-colors",
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
        {analizando ? "Analizando…" : editando ? "Recalcular con IA" : "Calcular calorías y macros"}
      </Button>

      {/* Recientes: registro de un toque, sin volver a analizar */}
      {!editando && !analisis && frecuentes.length > 0 && (
        <div>
          <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Recientes · un toque para añadir
          </p>
          <div className="flex flex-col gap-1.5">
            {frecuentes.map(({ comida, veces }) => (
              <button
                key={comida.id}
                onClick={() => anadirRapido(comida)}
                className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5 text-left transition-colors hover:bg-secondary"
              >
                <span className="min-w-0 flex items-center gap-2">
                  <Plus className="size-4 shrink-0 text-primary" />
                  <span className="truncate text-sm font-medium">{comida.texto}</span>
                  {veces > 1 && <span className="shrink-0 text-[0.7rem] text-muted-foreground">×{veces}</span>}
                </span>
                <span className="shrink-0 font-display text-sm font-bold tabular text-energy">
                  {comida.kcal}<span className="ml-0.5 text-[0.7rem] font-normal text-muted-foreground">kcal</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Modo edición sin análisis nuevo: campos numéricos directos */}
      {editando && !analisis && manual && (
        <div className="rounded-xl border border-border bg-secondary/40 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Valores</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Calorías (kcal)" value={manual.kcal} onChange={(v) => setM("kcal", v)} placeholder="450" />
            <Field label="Proteínas (g)" value={manual.p} onChange={(v) => setM("p", v)} placeholder="30" />
            <Field label="Carbohidratos (g)" value={manual.c} onChange={(v) => setM("c", v)} placeholder="40" />
            <Field label="Grasas (g)" value={manual.g} onChange={(v) => setM("g", v)} placeholder="15" />
          </div>
          <Button onClick={guardar} className="mt-4 w-full gap-2">
            <Check className="size-4" /> Guardar cambios
          </Button>
        </div>
      )}

      {analisis && (
        <div className="rounded-xl border border-border bg-secondary/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-display text-2xl font-bold tabular text-energy">
              {analisis.kcal}
              <span className="ml-1 text-sm font-medium text-muted-foreground">kcal</span>
            </span>
            <Chip tone={analisis.fuente === "offline" ? "warning" : "weight"}>
              {analisis.fuente === "gemini" ? "Gemini" : analisis.fuente === "edamam" ? "Edamam" : analisis.fuente === "claude" ? "IA" : "local"}
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
          <Button onClick={guardar} className="mt-4 w-full gap-2">
            <Check className="size-4" /> {editando ? "Guardar cambios" : `Añadir a ${TIPOS.find((t) => t.id === tipo)?.label.toLowerCase()}`}
          </Button>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- HÁBITOS */

function PanelHabitos({ fecha }: { fecha: string }) {
  const { dia, alternarHabito, estado } = useRitmo();
  const habitos = dia(fecha).habitos || {};
  const lista = habitosModelo(estado.perfil);

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {lista.map((h) => {
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
                hecho ? "border-primary bg-primary text-primary-foreground animate-check-ring" : "border-border",
              )}
            >
              {hecho && <Check className="size-3.5 animate-check-pop" strokeWidth={3} />}
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
