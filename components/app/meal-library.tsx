"use client";

import * as React from "react";
import { toast } from "sonner";
import { Apple, ArrowDownAZ, Check, EyeOff, Flame, Moon, Pencil, Plus, Repeat2, Search, Star, Sun, Trash2, Utensils, X } from "lucide-react";
import { cn, uid } from "@/lib/utils";
import { useRitmo } from "@/lib/store/provider";
import { bibliotecaComidas, type ComidaGuardada, type OrdenBiblioteca } from "@/lib/model/analytics";
import { fmtKcal, capitalizar } from "@/lib/format";
import { useMealPrefs, toggleFavorito, toggleOculta, setOverride, agregarCatalogo, quitarCatalogo } from "@/lib/meal-prefs";
import { SectionLabel } from "./primitives";
import type { Comida, TipoComida } from "@/lib/model/types";

type ItemBiblioteca = ComidaGuardada & { esCatalogo?: boolean };
type VistaBiblioteca = "todas" | "favoritas" | "frecuentes";

const CATS: { id: TipoComida; label: string; icon: typeof Sun }[] = [
  { id: "desayuno", label: "Desayuno", icon: Sun },
  { id: "comida", label: "Comida", icon: Utensils },
  { id: "cena", label: "Cena", icon: Moon },
  { id: "snack", label: "Snacks", icon: Apple },
];

const ORDENES: { id: OrdenBiblioteca; label: string; icon: typeof Flame }[] = [
  { id: "frecuencia", label: "Frecuentes", icon: Repeat2 },
  { id: "kcal", label: "Calorías", icon: Flame },
  { id: "alfabetico", label: "A–Z", icon: ArrowDownAZ },
];

/**
 * Biblioteca de comidas: tu "base de datos" personal, agrupada por tipo, que se
 * autoconstruye con lo que registras. Reutiliza cualquier plato con un toque,
 * márcalo como favorito, edítalo u ocúltalo (preferencias locales sobre la
 * agregación derivada del histórico).
 */
export function MealLibrary({ fecha }: { fecha: string }) {
  const { estado, registrarComida } = useRitmo();
  const prefs = useMealPrefs();
  const [orden, setOrden] = React.useState<OrdenBiblioteca>("frecuencia");
  const [cat, setCat] = React.useState<TipoComida>("desayuno");
  const [vista, setVista] = React.useState<VistaBiblioteca>("todas");
  const [q, setQ] = React.useState("");
  const [editando, setEditando] = React.useState<string | null>(null);
  const [creando, setCreando] = React.useState(false);

  const biblioteca = React.useMemo(() => bibliotecaComidas(estado, orden), [estado, orden]);

  // Combina lo derivado del histórico con el catálogo (comidas creadas a mano),
  // aplica overrides de edición, quita las ocultas y fija las favoritas arriba.
  const porCat = React.useMemo(() => {
    const out = {} as Record<TipoComida, ItemBiblioteca[]>;
    for (const c of CATS) {
      const derivadas = biblioteca[c.id] ?? [];
      const clavesDer = new Set(derivadas.map((d) => d.clave));
      const soloCatalogo: ItemBiblioteca[] = prefs.catalog
        .filter((x) => x.tipo === c.id && !clavesDer.has(x.clave))
        .map((x) => ({ ...x, tipo: c.id, veces: 0, ultima: x.creado, esCatalogo: true }));

      const arr: ItemBiblioteca[] = [...derivadas, ...soloCatalogo]
        .filter((it) => !prefs.hidden.includes(it.clave))
        .map((it) => {
          const ov = prefs.overrides[it.clave];
          return ov ? { ...it, ...limpiarOverride(ov) } : it;
        });

      // Reordena según el criterio elegido (los catálogo tienen veces 0).
      arr.sort(ordenar(orden));
      const fav = arr.filter((it) => prefs.fav.includes(it.clave));
      const resto = arr.filter((it) => !prefs.fav.includes(it.clave));
      out[c.id] = [...fav, ...resto];
    }
    return out;
  }, [biblioteca, prefs, orden]);

  const total = React.useMemo(
    () => Object.values(porCat).reduce((a, arr) => a + arr.length, 0),
    [porCat],
  );

  const filtradas = React.useMemo(() => {
    const itemsCat = porCat[cat] ?? [];
    const needle = q.trim().toLowerCase();
    return itemsCat.filter((c) => {
      const coincideTexto = !needle || c.texto.toLowerCase().includes(needle);
      const coincideVista = vista === "todas" ? true : vista === "favoritas" ? prefs.fav.includes(c.clave) : c.veces > 1;
      return coincideTexto && coincideVista;
    });
  }, [porCat, cat, q, vista, prefs.fav]);

  async function usar(item: ComidaGuardada) {
    const comida: Comida = {
      id: uid(),
      tipo: item.tipo,
      texto: item.texto,
      kcal: item.kcal,
      proteinas: item.proteinas,
      carbohidratos: item.carbohidratos,
      grasas: item.grasas,
      estimado: item.estimado,
      creado: new Date().toISOString(),
    };
    await registrarComida(fecha, comida);
    toast.success(`${capitalizar(item.texto)} · ${fmtKcal(item.kcal)} kcal`, { description: "Añadida al día" });
  }

  return (
    <section>
      <SectionLabel action={<span className="text-xs text-muted-foreground tabular">{total} guardadas</span>}>
        Mis comidas
      </SectionLabel>

      <div className="flex flex-col gap-4 overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">Para añadir a <span className="font-semibold text-foreground">{CATS.find((c) => c.id === cat)?.label.toLowerCase()}</span> en un toque.</p>
          <div className="flex rounded-full bg-secondary p-0.5">
            {([['todas', 'Todas'], ['favoritas', 'Favoritas'], ['frecuentes', 'Frecuentes']] as const).map(([id, label]) => <button key={id} onClick={() => setVista(id)} className={cn("h-7 rounded-full px-2.5 text-xs font-medium transition-colors", vista === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>{label}</button>)}
          </div>
        </div>
        {/* Categorías */}
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {CATS.map((c) => {
            const n = (porCat[c.id] ?? []).length;
            const activa = cat === c.id;
            return (
              <button
                key={c.id}
                onClick={() => { setCat(c.id); setEditando(null); }}
                className={cn(
                  "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors",
                  activa
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border text-muted-foreground hover:bg-secondary",
                )}
              >
                <c.icon className="size-3.5" aria-hidden="true" />
                {c.label}
                <span className={cn("tabular text-xs", activa ? "text-primary-foreground/75" : "text-muted-foreground/70")}>
                  {n}
                </span>
              </button>
            );
          })}
        </div>

        {/* Buscador + orden */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Buscar en ${CATS.find((c) => c.id === cat)?.label.toLowerCase()}…`}
              className="h-10 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm outline-none transition-colors focus:border-ring"
            />
          </div>
          <div className="flex shrink-0 gap-1 rounded-full bg-secondary p-0.5">
            {ORDENES.map((o) => (
              <button
                key={o.id}
                onClick={() => setOrden(o.id)}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-colors",
                  orden === o.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
                )}
                aria-pressed={orden === o.id}
              >
                <o.icon className="size-3.5" />
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Crear comida sin registrarla en un día */}
        {creando ? (
          <NuevaComidaForm
            tipo={cat}
            onCancel={() => setCreando(false)}
            onSave={(c) => { agregarCatalogo(c); setCreando(false); toast.success("Comida guardada en la biblioteca"); }}
          />
        ) : (
          <button
            onClick={() => setCreando(true)}
            className="flex h-10 items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <Plus className="size-4" /> Nueva comida en {CATS.find((c) => c.id === cat)?.label.toLowerCase()}
          </button>
        )}

        {/* Lista de comidas de la categoría */}
        {filtradas.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {q ? "Nada coincide con tu búsqueda." : "Aún no hay comidas en esta categoría."}
          </p>
        ) : (
          <ul className="overflow-hidden rounded-xl border border-border bg-background divide-y divide-border">
            {filtradas.map((item) =>
              editando === item.clave ? (
                <li key={item.clave}>
                  <EditorEntrada
                    item={item}
                    onCancel={() => setEditando(null)}
                    onSave={(ov) => { setOverride(item.clave, ov); setEditando(null); toast.success("Comida actualizada en la biblioteca"); }}
                  />
                </li>
              ) : (
                <li key={item.clave}>
                  <TarjetaComida
                    item={item}
                    favorita={prefs.fav.includes(item.clave)}
                    onUsar={() => usar(item)}
                    onFav={() => toggleFavorito(item.clave)}
                    onEdit={() => setEditando(item.clave)}
                    onHide={() =>
                      item.esCatalogo
                        ? (quitarCatalogo(item.clave), toast("Comida quitada de la biblioteca"))
                        : (toggleOculta(item.clave), toast("Comida ocultada de la biblioteca"))
                    }
                    hideTitle={item.esCatalogo ? "Quitar de la biblioteca" : "Ocultar de la biblioteca"}
                  />
                </li>
              ),
            )}
          </ul>
        )}

        {prefs.hidden.length > 0 && (
          <button
            onClick={() => prefs.hidden.forEach((k) => toggleOculta(k))}
            className="self-start text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Mostrar {prefs.hidden.length} comida{prefs.hidden.length > 1 ? "s" : ""} oculta{prefs.hidden.length > 1 ? "s" : ""}
          </button>
        )}
      </div>
    </section>
  );
}

function TarjetaComida({
  item,
  favorita,
  onUsar,
  onFav,
  onEdit,
  onHide,
  hideTitle,
}: {
  item: ItemBiblioteca;
  favorita: boolean;
  onUsar: () => void;
  onFav: () => void;
  onEdit: () => void;
  onHide: () => void;
  hideTitle: string;
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-2 px-3 py-3 transition-colors sm:px-4",
        favorita ? "bg-habit/[0.06]" : "hover:bg-secondary/40",
      )}
    >
      {/* Región principal: añadir al día */}
      <button onClick={onUsar} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`Añadir ${item.texto}`}>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-sm font-medium">
            {favorita && <Star className="size-3.5 shrink-0 fill-habit text-habit" />}
            <span className="truncate">{capitalizar(item.texto)}</span>
          </p>
          <p className="mt-0.5 flex items-center gap-2 text-[0.7rem] text-muted-foreground tabular">
            <span>P {item.proteinas}</span>
            <span>C {item.carbohidratos}</span>
            <span>G {item.grasas}</span>
            {item.veces > 1 && <span className="text-primary/80">· ×{item.veces}</span>}
          </p>
        </div>
        <span className="shrink-0 font-display text-base font-bold leading-none tabular text-energy">
          {fmtKcal(item.kcal)}
          <span className="ml-0.5 text-[0.65rem] font-normal text-muted-foreground">kcal</span>
        </span>
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-muted-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
          <Plus className="size-4" />
        </span>
      </button>

      {/* Acciones */}
      <div className="flex shrink-0 items-center">
        <IconBtn label={favorita ? "Quitar de favoritas" : "Marcar favorita"} onClick={onFav} activo={favorita}>
          <Star className={cn("size-4", favorita && "fill-habit text-habit")} />
        </IconBtn>
        <IconBtn label="Editar comida" onClick={onEdit}>
          <Pencil className="size-4" />
        </IconBtn>
        <IconBtn label={hideTitle} onClick={onHide}>
          {item.esCatalogo ? <Trash2 className="size-4" /> : <EyeOff className="size-4" />}
        </IconBtn>
      </div>
    </div>
  );
}

function IconBtn({ children, label, onClick, activo }: { children: React.ReactNode; label: string; onClick: () => void; activo?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
        activo && "text-habit",
      )}
    >
      {children}
    </button>
  );
}

function EditorEntrada({
  item,
  onCancel,
  onSave,
}: {
  item: ComidaGuardada;
  onCancel: () => void;
  onSave: (ov: { texto: string; kcal: number; proteinas: number; carbohidratos: number; grasas: number }) => void;
}) {
  const [texto, setTexto] = React.useState(item.texto);
  const [kcal, setKcal] = React.useState(String(item.kcal));
  const [p, setP] = React.useState(String(item.proteinas));
  const [c, setC] = React.useState(String(item.carbohidratos));
  const [g, setG] = React.useState(String(item.grasas));
  const n = (s: string) => Math.max(0, Math.round(Number(s.replace(",", ".")) || 0));

  return (
    <div className="rounded-xl border border-primary/40 bg-primary/[0.03] p-3">
      <input
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Nombre de la comida"
        className="mb-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring"
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <CampoNum label="kcal" value={kcal} onChange={setKcal} />
        <CampoNum label="Proteínas" value={p} onChange={setP} />
        <CampoNum label="Carbos" value={c} onChange={setC} />
        <CampoNum label="Grasas" value={g} onChange={setG} />
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button onClick={onCancel} className="flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-muted-foreground hover:bg-secondary">
          <X className="size-4" /> Cancelar
        </button>
        <button
          onClick={() => onSave({ texto: texto.trim() || item.texto, kcal: n(kcal), proteinas: n(p), carbohidratos: n(c), grasas: n(g) })}
          className="flex h-9 items-center gap-1.5 rounded-full bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Check className="size-4" /> Guardar
        </button>
      </div>
    </div>
  );
}

function CampoNum({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <input
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm tabular outline-none focus:border-ring"
      />
    </label>
  );
}

/** Solo conserva los campos definidos del override (evita pisar con undefined). */
function limpiarOverride(ov: Partial<ComidaGuardada>): Partial<ComidaGuardada> {
  const out: Partial<ComidaGuardada> = {};
  for (const [k, v] of Object.entries(ov)) if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  return out;
}

/** Comparador según el criterio de orden elegido. */
function ordenar(orden: OrdenBiblioteca) {
  return (a: ItemBiblioteca, b: ItemBiblioteca) => {
    if (orden === "kcal") return b.kcal - a.kcal;
    if (orden === "alfabetico") return a.texto.localeCompare(b.texto, "es", { sensitivity: "base" });
    return (b.veces - a.veces) || (a.ultima < b.ultima ? 1 : -1);
  };
}

/** Formulario para crear una comida en la biblioteca sin registrarla en un día. */
function NuevaComidaForm({
  tipo,
  onCancel,
  onSave,
}: {
  tipo: TipoComida;
  onCancel: () => void;
  onSave: (c: { texto: string; tipo: TipoComida; kcal: number; proteinas: number; carbohidratos: number; grasas: number }) => void;
}) {
  const [texto, setTexto] = React.useState("");
  const [kcal, setKcal] = React.useState("");
  const [p, setP] = React.useState("");
  const [c, setC] = React.useState("");
  const [g, setG] = React.useState("");
  const n = (s: string) => Math.max(0, Math.round(Number(s.replace(",", ".")) || 0));
  const valido = texto.trim().length > 0 && n(kcal) > 0;

  return (
    <div className="rounded-xl border border-primary/40 bg-primary/[0.03] p-3">
      <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
        Nueva comida · {tipo}
      </p>
      <input
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Nombre de la comida"
        autoFocus
        className="mb-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring"
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <CampoNum label="kcal" value={kcal} onChange={setKcal} />
        <CampoNum label="Proteínas" value={p} onChange={setP} />
        <CampoNum label="Carbos" value={c} onChange={setC} />
        <CampoNum label="Grasas" value={g} onChange={setG} />
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button onClick={onCancel} className="flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-muted-foreground hover:bg-secondary">
          <X className="size-4" /> Cancelar
        </button>
        <button
          onClick={() => onSave({ texto: texto.trim(), tipo, kcal: n(kcal), proteinas: n(p), carbohidratos: n(c), grasas: n(g) })}
          disabled={!valido}
          className="flex h-9 items-center gap-1.5 rounded-full bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
        >
          <Check className="size-4" /> Guardar
        </button>
      </div>
    </div>
  );
}
