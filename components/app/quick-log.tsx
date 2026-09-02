"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  Check,
  CircleHelp,
  ListChecks,
  Loader2,
  Pencil,
  Plus,
  Scale,
  Sparkles,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { cn, uid } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { descripcionNecesitaAnalisis, normalizarDescripcionComida } from "@/lib/nutrition/prompt-state";
import type { AnalisisNutricional, ItemNutricional } from "@/lib/nutrition/types";
import { recalcularAnalisis } from "@/lib/nutrition/corrections";
import { guardarCorreccionesNutricion, useMealPrefs } from "@/lib/meal-prefs";
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
  const [viewportMovil, setViewportMovil] = React.useState<{ alto: number; insetInferior: number } | null>(null);
  const alturaBase = React.useRef(0);
  const pestanasCompactas = !isDesktop && tecladoAbierto;

  React.useEffect(() => {
    if (!abierto || isDesktop || !window.visualViewport) return;
    const viewport = window.visualViewport;
    alturaBase.current = Math.max(window.innerHeight, viewport.height);
    const actualizar = () => {
      const reduccion = Math.max(0, alturaBase.current - viewport.height);
      const insetInferior = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      const abiertoAhora = Math.max(reduccion, insetInferior) > 140;
      setTecladoAbierto(abiertoAhora);
      setViewportMovil({ alto: Math.round(viewport.height), insetInferior: Math.round(insetInferior) });
      if (!abiertoAhora) alturaBase.current = Math.max(alturaBase.current, window.innerHeight, viewport.height);
    };
    const frame = window.requestAnimationFrame(actualizar);
    viewport.addEventListener("resize", actualizar);
    viewport.addEventListener("scroll", actualizar);
    return () => {
      viewport.removeEventListener("resize", actualizar);
      viewport.removeEventListener("scroll", actualizar);
      window.cancelAnimationFrame(frame);
    };
  }, [abierto, isDesktop]);

  const pestanas = (
    <div className={cn("flex", pestanasCompactas ? "gap-1" : "gap-1.5")} role="tablist" aria-label="Tipo de registro">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => setTab(t.id)}
          role="tab"
          aria-selected={tab === t.id}
          className={cn(
            "flex flex-1 items-center justify-center rounded-xl font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            pestanasCompactas ? "h-9 gap-1 px-2 text-xs" : "h-11 gap-1.5 px-3 text-sm",
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
      {tab === "comida" && <PanelComida fecha={fecha} onDone={cerrar} comidaEdit={comidaEdit} movil={!isDesktop} />}
      {tab === "peso" && <PanelPeso fecha={fecha} onDone={cerrar} movil={!isDesktop} />}
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
    <Drawer
      open={abierto}
      onOpenChange={(o) => {
        if (!o) {
          setTecladoAbierto(false);
          setViewportMovil(null);
          cerrar();
        }
      }}
      repositionInputs={false}
    >
      <DrawerContent
        className={cn(
          "max-h-[92dvh] rounded-t-2xl",
          tecladoAbierto && "max-h-none rounded-none [&>div:first-child]:hidden",
        )}
        style={tecladoAbierto && viewportMovil ? {
          height: `${viewportMovil.alto}px`,
          maxHeight: `${viewportMovil.alto}px`,
          bottom: `${viewportMovil.insetInferior}px`,
        } : undefined}
      >
        <DrawerHeader className={cn("shrink-0 border-b border-border text-left", tecladoAbierto ? "px-4 py-2" : "px-4 pt-3 pb-4")}>
          <div className="flex items-baseline justify-between gap-3">
            <DrawerTitle className={cn("font-display", tecladoAbierto ? "text-base" : "text-xl")}>{titulo}</DrawerTitle>
            <DrawerDescription className={cn("shrink-0 text-xs", !tecladoAbierto && "hidden")}>{sub}</DrawerDescription>
          </div>
          {!tecladoAbierto && <DrawerDescription>{sub}</DrawerDescription>}
          <div className={tecladoAbierto ? "pt-2" : "pt-3"}>{pestanas}</div>
        </DrawerHeader>
        <div
          className={cn(
            "min-h-0 flex-1 overscroll-contain overflow-y-auto overflow-x-hidden px-4 pt-4",
            tab === "habitos"
              ? "pb-[calc(2rem+env(safe-area-inset-bottom))]"
              : "pb-[calc(6.5rem+env(safe-area-inset-bottom))]",
          )}
        >
          {panel}
        </div>
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

function PanelComida({
  fecha,
  onDone,
  comidaEdit,
  movil = false,
}: {
  fecha: string;
  onDone: () => void;
  comidaEdit?: Comida | null;
  movil?: boolean;
}) {
  const { registrarComida, editarComida, estado } = useRitmo();
  const preferencias = useMealPrefs();
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
  const [itemsCorregidos, setItemsCorregidos] = React.useState<Set<number>>(() => new Set());
  const [textoAnalizado, setTextoAnalizado] = React.useState(comidaEdit?.texto.trim() ?? "");
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
      const res = await analizarComida(texto, Object.values(preferencias.nutritionCorrections));
      setAnalisis(res);
      setItemsCorregidos(new Set());
      setTextoAnalizado(texto.trim());
      setManual({ kcal: String(res.kcal), p: String(res.proteinas), c: String(res.carbohidratos), g: String(res.grasas) });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo analizar la comida.");
    } finally {
      setAnalizando(false);
    }
  }

  async function guardar() {
    if (!manual) return;
    if (normalizarDescripcionComida(texto) !== normalizarDescripcionComida(textoAnalizado)) {
      toast.error("Vuelve a analizar la descripción antes de guardar los cambios.");
      return;
    }
    const analisisVigente = analisis;
    const n = (s: string) => Math.max(0, Math.round(Number(s.replace(",", ".")) || 0));
    const editadoManual = analisisVigente != null && (
      itemsCorregidos.size > 0 ||
      n(manual.kcal) !== analisisVigente.kcal ||
      n(manual.p) !== analisisVigente.proteinas ||
      n(manual.c) !== analisisVigente.carbohidratos ||
      n(manual.g) !== analisisVigente.grasas
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
      texto: (analisisVigente?.resumen || texto).trim() || comidaEdit?.texto || "Comida",
      kcal: n(manual.kcal),
      proteinas: n(manual.p),
      carbohidratos: n(manual.c),
      grasas: n(manual.g),
      fuente: analisisVigente ? (editadoManual ? "manual" : analisisVigente.fuente) : editadoExistente ? "manual" : comidaEdit?.fuente,
      // Una IA, una base nutricional y el estimador local parten de cantidades
      // interpretadas. Si el usuario cambia los valores, su ajuste prevalece.
      estimado: analisisVigente ? !editadoManual : editadoExistente ? false : comidaEdit?.estimado,
      creado: comidaEdit?.creado ?? new Date().toISOString(),
    };
    if (editando) {
      await editarComida(fecha, comida);
      toast.success("Comida actualizada");
    } else {
      await registrarComida(fecha, comida);
      toast.success(`Comida añadida (${comida.kcal} kcal)`);
    }
    if (analisisVigente && itemsCorregidos.size > 0) {
      guardarCorreccionesNutricion(analisisVigente.items.filter((_, index) => itemsCorregidos.has(index)));
    }
    onDone();
  }

  function actualizarIngrediente(index: number, item: ItemNutricional) {
    if (!analisis) return;
    const items = analisis.items.map((actual, posicion) => posicion === index ? item : actual);
    const siguiente = recalcularAnalisis(analisis, items);
    setAnalisis(siguiente);
    setManual({ kcal: String(siguiente.kcal), p: String(siguiente.proteinas), c: String(siguiente.carbohidratos), g: String(siguiente.grasas) });
    setItemsCorregidos((actuales) => new Set(actuales).add(index));
  }

  const setM = (k: "kcal" | "p" | "c" | "g", v: string) => setManual((m) => ({ ...(m ?? { kcal: "0", p: "0", c: "0", g: "0" }), [k]: v }));
  const etiquetaTipo = TIPOS.find((t) => t.id === tipo)?.label.toLowerCase() ?? "comida";
  const descripcionCambio = normalizarDescripcionComida(texto) !== normalizarDescripcionComida(textoAnalizado);
  const analisisVisible = analisis != null && !descripcionCambio;
  const requiereReanalisis = descripcionNecesitaAnalisis(texto, textoAnalizado, editando);
  const listoParaGuardar = !descripcionCambio && (analisis != null || editando) && manual != null;
  const ejecutarPrincipal = listoParaGuardar ? guardar : analizar;

  return (
    <div className="flex min-h-full flex-col gap-3">
      <div className="grid grid-cols-4 gap-1.5">
        {TIPOS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTipo(t.id)}
            className={cn(
              "h-11 rounded-xl border px-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
        rows={4}
        maxLength={2_500}
        className="min-h-28 resize-none rounded-xl bg-card text-base leading-relaxed"
      />
      <div className="flex items-start justify-between gap-3 text-xs text-muted-foreground">
        <p className="max-w-[52ch]">Describe el plato completo. RITMO separa ingredientes, cantidades y aliños.</p>
        <span className="shrink-0 tabular">{texto.length}/2.500</span>
      </div>
      {requiereReanalisis && (
        <div className="flex items-start gap-2.5 rounded-xl border border-warning-border bg-warning-wash px-3 py-2.5 text-xs leading-relaxed text-warning-ink">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <p>La descripción ha cambiado. Vuelve a analizarla para actualizar ingredientes, kcal y macros antes de guardar.</p>
        </div>
      )}

      {/* Recientes: registro de un toque, sin volver a analizar */}
      {!editando && !analisisVisible && frecuentes.length > 0 && (
        <div>
          <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Recientes · un toque para añadir
          </p>
          <div className="flex flex-col gap-1.5">
            {frecuentes.map(({ comida, veces }) => (
              <button
                key={comida.id}
                type="button"
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
      {editando && !analisis && !descripcionCambio && manual && (
        <div className="rounded-xl border border-border bg-secondary/40 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Valores</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Calorías (kcal)" value={manual.kcal} onChange={(v) => setM("kcal", v)} placeholder="450" />
            <Field label="Proteínas (g)" value={manual.p} onChange={(v) => setM("p", v)} placeholder="30" />
            <Field label="Carbohidratos (g)" value={manual.c} onChange={(v) => setM("c", v)} placeholder="40" />
            <Field label="Grasas (g)" value={manual.g} onChange={(v) => setM("g", v)} placeholder="15" />
          </div>
        </div>
      )}

      {analisis && !descripcionCambio && (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-display text-2xl font-bold tabular text-energy">
              {analisis.kcal}
              <span className="ml-1 text-sm font-medium text-muted-foreground">kcal</span>
            </span>
            <Chip tone={analisis.fuente === "offline" || analisis.confianza === "baja" ? "warning" : "weight"}>
              {analisis.fuente === "gemini"
                ? `Gemini · ${analisis.confianza ?? "media"}`
                : analisis.fuente === "edamam" ? "Edamam" : analisis.fuente === "claude" ? "IA" : "local"}
            </Chip>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <MacroBar label="Proteínas" value={analisis.proteinas} colorVar="--weight" />
            <MacroBar label="Carbos" value={analisis.carbohidratos} colorVar="--habit" />
            <MacroBar label="Grasas" value={analisis.grasas} colorVar="--energy" />
          </div>
          {analisis.items.length > 0 && <IngredientTable items={analisis.items} onChange={actualizarIngrediente} />}
          {analisis.observaciones && analisis.observaciones.length > 0 && (
            <div className="mt-3 space-y-1 text-xs leading-relaxed text-muted-foreground">
              {analisis.observaciones.map((observacion, i) => <p key={i}>{observacion}</p>)}
            </div>
          )}
          {analisis.aviso && <p className="mt-3 text-xs font-medium text-warning-ink">{analisis.aviso}</p>}
        </div>
      )}

      <div
        className={cn(
          "mt-auto",
          movil && "absolute inset-x-0 bottom-0 z-20 border-t border-border bg-background/96 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-10px_30px_-22px_hsl(var(--foreground)/0.45)] backdrop-blur-md",
        )}
      >
        <Button
          onClick={() => void ejecutarPrincipal()}
          disabled={analizando || (listoParaGuardar ? !manual : !texto.trim())}
          className="h-12 w-full gap-2 rounded-xl"
        >
          {analizando ? <Loader2 className="size-4 animate-spin" /> : listoParaGuardar ? <Check className="size-4" /> : <Sparkles className="size-4" />}
          {analizando
            ? "Analizando plato completo…"
            : listoParaGuardar
              ? editando ? "Guardar cambios" : `Añadir a ${etiquetaTipo}`
              : requiereReanalisis ? "Volver a analizar" : "Analizar ingredientes"}
        </Button>
      </div>
    </div>
  );
}

function IngredientTable({ items, onChange }: { items: AnalisisNutricional["items"]; onChange: (index: number, item: ItemNutricional) => void }) {
  const [editando, setEditando] = React.useState<number | null>(null);
  const [borrador, setBorrador] = React.useState<{ nombre: string; cantidad: string; kcal: string; p: string; c: string; g: string } | null>(null);

  function abrirEdicion(index: number) {
    const item = items[index];
    setEditando(index);
    setBorrador({ nombre: item.nombre, cantidad: item.cantidad ?? "", kcal: String(item.kcal), p: String(item.proteinas), c: String(item.carbohidratos), g: String(item.grasas) });
  }

  function aplicar() {
    if (editando == null || !borrador?.nombre.trim()) return;
    const numero = (valor: string) => Math.max(0, Math.round((Number(valor.replace(",", ".")) || 0) * 10) / 10);
    onChange(editando, {
      nombre: borrador.nombre.trim(),
      cantidad: borrador.cantidad.trim() || undefined,
      cantidadEstimada: false,
      kcal: numero(borrador.kcal),
      proteinas: numero(borrador.p),
      carbohidratos: numero(borrador.c),
      grasas: numero(borrador.g),
    });
    setEditando(null);
    setBorrador(null);
  }

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-border" aria-label="Desglose nutricional por ingrediente">
      <div className="hidden grid-cols-[minmax(0,1.5fr)_minmax(8rem,.8fr)_repeat(4,minmax(3rem,.42fr))_2rem] gap-3 bg-secondary/55 px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.07em] text-muted-foreground sm:grid">
        <span>Ingrediente</span><span>Cantidad</span><span className="text-right">P</span><span className="text-right">C</span><span className="text-right">G</span><span className="text-right">kcal</span><span className="sr-only">Editar</span>
      </div>
      <div className="divide-y divide-border">
        {items.map((item, index) => (
          <div key={`${item.nombre}-${index}`}>
            <div className="relative grid gap-2 px-3 py-3 pr-12 sm:grid-cols-[minmax(0,1.5fr)_minmax(8rem,.8fr)_repeat(4,minmax(3rem,.42fr))_2rem] sm:items-center sm:gap-3 sm:py-2.5 sm:pr-3">
              <p className="min-w-0 truncate text-sm font-semibold text-foreground">{item.nombre}</p>
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <span className="truncate text-xs tabular text-muted-foreground">{item.cantidad || "Sin cantidad"}</span>
                <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[0.62rem] font-semibold", item.cantidadEstimada ? "bg-warning-wash text-warning-ink" : "bg-weight-wash text-weight-ink")}>
                  {item.cantidadEstimada ? <CircleHelp className="size-3" /> : <Scale className="size-3" />}
                  {item.cantidadEstimada ? "Estimada" : "Indicada"}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 sm:contents">
                <IngredientMetric label="P" value={item.proteinas} tone="text-weight" />
                <IngredientMetric label="C" value={item.carbohidratos} tone="text-habit" />
                <IngredientMetric label="G" value={item.grasas} tone="text-energy" />
                <IngredientMetric label="kcal" value={item.kcal} tone="text-foreground" kcal />
              </div>
              <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-2 size-9 rounded-lg sm:static sm:size-8" onClick={() => abrirEdicion(index)} aria-label={`Corregir ${item.nombre}`}><Pencil className="size-3.5" /></Button>
            </div>
            {editando === index && borrador && (
              <div className="border-t border-border bg-secondary/30 px-3 py-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="Ingrediente" value={borrador.nombre} onChange={(nombre) => setBorrador((actual) => actual ? { ...actual, nombre } : actual)} text />
                  <Field label="Cantidad" value={borrador.cantidad} onChange={(cantidad) => setBorrador((actual) => actual ? { ...actual, cantidad } : actual)} placeholder="Ej. 150 g" text />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Field label="kcal" value={borrador.kcal} onChange={(kcal) => setBorrador((actual) => actual ? { ...actual, kcal } : actual)} />
                  <Field label="Proteína" value={borrador.p} onChange={(p) => setBorrador((actual) => actual ? { ...actual, p } : actual)} />
                  <Field label="Carbos" value={borrador.c} onChange={(c) => setBorrador((actual) => actual ? { ...actual, c } : actual)} />
                  <Field label="Grasas" value={borrador.g} onChange={(g) => setBorrador((actual) => actual ? { ...actual, g } : actual)} />
                </div>
                <div className="mt-3 flex justify-end gap-2"><Button type="button" variant="ghost" size="sm" onClick={() => { setEditando(null); setBorrador(null); }}><X className="size-3.5" /> Cancelar</Button><Button type="button" size="sm" onClick={aplicar}><Check className="size-3.5" /> Aplicar corrección</Button></div>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border bg-secondary/25 px-3 py-2 text-[0.65rem] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Scale className="size-3 text-weight" /> Cantidad indicada por ti</span>
        <span className="inline-flex items-center gap-1"><CircleHelp className="size-3 text-warning" /> Cantidad inferida por RITMO</span>
      </div>
    </div>
  );
}

function IngredientMetric({ label, value, tone, kcal = false }: { label: string; value: number; tone: string; kcal?: boolean }) {
  return (
    <div className="rounded-lg bg-secondary/45 px-1.5 py-1.5 text-center sm:bg-transparent sm:px-0 sm:py-0 sm:text-right">
      <span className="block text-[0.58rem] font-semibold uppercase text-muted-foreground sm:hidden">{label}</span>
      <span className={cn("text-xs font-semibold tabular", tone)}>{value}{kcal ? "" : "g"}</span>
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
            type="button"
            onClick={() => alternarHabito(fecha, h.clave)}
            aria-pressed={hecho}
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

function PanelPeso({ fecha, onDone, movil = false }: { fecha: string; onDone: () => void; movil?: boolean }) {
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

      <div className={cn("mt-1", movil && "absolute inset-x-0 bottom-0 z-20 border-t border-border bg-background/96 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md")}>
        <Button onClick={guardar} className="h-12 w-full gap-2 rounded-xl">
          <Check className="size-4" /> Guardar medición
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  text = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  text?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground/80">{label}</span>
      <Input inputMode={text ? "text" : "decimal"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cn("h-11 rounded-xl text-base", !text && "tabular")} />
    </label>
  );
}
