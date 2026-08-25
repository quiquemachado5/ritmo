"use client";

import * as React from "react";
import { toast } from "sonner";
import { ArrowDownAZ, Flame, Plus, Search, Repeat2 } from "lucide-react";
import { cn, uid } from "@/lib/utils";
import { useRitmo } from "@/lib/store/provider";
import { bibliotecaComidas, type ComidaGuardada, type OrdenBiblioteca } from "@/lib/model/analytics";
import { fmtKcal, capitalizar, fmtFechaCorta } from "@/lib/format";
import { SectionLabel, EmptyState } from "./primitives";
import type { Comida, TipoComida } from "@/lib/model/types";

const CATS: { id: TipoComida; label: string; emoji: string }[] = [
  { id: "desayuno", label: "Desayuno", emoji: "🌅" },
  { id: "comida", label: "Comida", emoji: "🍽️" },
  { id: "cena", label: "Cena", emoji: "🌙" },
  { id: "snack", label: "Snacks", emoji: "🍎" },
];

const ORDENES: { id: OrdenBiblioteca; label: string; icon: typeof Flame }[] = [
  { id: "frecuencia", label: "Frecuentes", icon: Repeat2 },
  { id: "kcal", label: "Calorías", icon: Flame },
  { id: "alfabetico", label: "A–Z", icon: ArrowDownAZ },
];

/**
 * Biblioteca de comidas: tu "base de datos" personal, agrupada por tipo, que se
 * autoconstruye con lo que registras. Reutiliza cualquier plato en el día que
 * estés viendo con un toque.
 */
export function MealLibrary({ fecha }: { fecha: string }) {
  const { estado, registrarComida } = useRitmo();
  const [orden, setOrden] = React.useState<OrdenBiblioteca>("frecuencia");
  const [cat, setCat] = React.useState<TipoComida>("desayuno");
  const [q, setQ] = React.useState("");

  const biblioteca = React.useMemo(() => bibliotecaComidas(estado, orden), [estado, orden]);
  const total = React.useMemo(
    () => Object.values(biblioteca).reduce((a, arr) => a + arr.length, 0),
    [biblioteca],
  );

  const itemsCat = biblioteca[cat] ?? [];
  const filtradas = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? itemsCat.filter((c) => c.texto.toLowerCase().includes(needle)) : itemsCat;
  }, [itemsCat, q]);

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
    toast.success(`${item.texto} · ${fmtKcal(item.kcal)} kcal`, { description: "Añadida al día" });
  }

  if (total === 0) {
    return (
      <section>
        <SectionLabel>Mis comidas</SectionLabel>
        <EmptyState title="Tu biblioteca está vacía">
          Cada comida que registres se guardará aquí por categoría para reutilizarla
          cualquier día con un toque.
        </EmptyState>
      </section>
    );
  }

  return (
    <section>
      <SectionLabel action={<span className="text-xs text-muted-foreground tabular">{total} guardadas</span>}>
        Mis comidas
      </SectionLabel>

      <div className="flex flex-col gap-3 card-ritmo p-4">
        {/* Categorías */}
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
          {CATS.map((c) => {
            const n = (biblioteca[c.id] ?? []).length;
            const activa = cat === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setCat(c.id)}
                className={cn(
                  "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors",
                  activa
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-secondary",
                )}
              >
                <span aria-hidden>{c.emoji}</span>
                {c.label}
                <span className={cn("tabular text-xs", activa ? "text-primary/70" : "text-muted-foreground/70")}>
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

        {/* Lista de comidas de la categoría */}
        {filtradas.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {q ? "Nada coincide con tu búsqueda." : "Aún no hay comidas en esta categoría."}
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {filtradas.map((item) => (
              <li key={item.clave}>
                <button
                  onClick={() => usar(item)}
                  className="group flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-left transition-all hover:border-primary/40 hover:bg-primary/[0.04] active:scale-[0.99]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{capitalizar(item.texto)}</p>
                    <p className="mt-0.5 flex items-center gap-2 text-[0.7rem] text-muted-foreground tabular">
                      <span>P {item.proteinas}</span>
                      <span>C {item.carbohidratos}</span>
                      <span>G {item.grasas}</span>
                      {item.veces > 1 && <span className="text-primary/80">· ×{item.veces}</span>}
                    </p>
                  </div>
                  <span className="shrink-0 text-right">
                    <span className="block font-display text-base font-bold leading-none tabular text-energy">
                      {fmtKcal(item.kcal)}
                      <span className="ml-0.5 text-[0.65rem] font-normal text-muted-foreground">kcal</span>
                    </span>
                  </span>
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Plus className="size-4" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
