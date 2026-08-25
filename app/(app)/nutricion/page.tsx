"use client";

import * as React from "react";
import { AlertTriangle, Apple, Beef, ChevronLeft, ChevronRight, Coffee, Moon, Pencil, Plus, RotateCcw, Sparkles, Trash2, UtensilsCrossed } from "lucide-react";
import { useRitmo } from "@/lib/store/provider";
import { useQuickLog } from "@/components/app/quick-log-provider";
import { macrosObjetivo } from "@/lib/model/metrics";
import { resumen } from "@/lib/model/analytics";
import { hoy, sumarDias, diasEntre } from "@/lib/model/dates";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Ring, MacroBar, Chip, EmptyState } from "@/components/app/primitives";
import { MealLibrary } from "@/components/app/meal-library";
import { fmtKcal, fmtFechaLarga, capitalizar } from "@/lib/format";
import { uid } from "@/lib/utils";
import type { TipoComida } from "@/lib/model/types";

const ORDEN = [
  { id: "desayuno", label: "Desayuno", icon: Coffee, wash: "bg-habit-wash", ink: "text-habit" },
  { id: "comida", label: "Comida", icon: UtensilsCrossed, wash: "bg-energy-wash", ink: "text-energy" },
  { id: "cena", label: "Cena", icon: Moon, wash: "bg-weight-wash", ink: "text-weight" },
  { id: "snack", label: "Snacks", icon: Apple, wash: "bg-secondary", ink: "text-foreground" },
] as const satisfies readonly { id: TipoComida; label: string; icon: typeof Coffee; wash: string; ink: string }[];

export default function NutricionPage() {
  const { estado, cargando, dia, borrarComida, registrarComida } = useRitmo();
  const { abrir, editarComidaEn } = useQuickLog();
  const [fecha, setFecha] = React.useState(hoy());
  const [confirmBorrar, setConfirmBorrar] = React.useState<string | null>(null);

  async function repetirHoy(c: import("@/lib/model/types").Comida) {
    await registrarComida(hoy(), { ...c, id: uid(), creado: new Date().toISOString() });
    const { toast } = await import("sonner");
    toast.success(fecha === hoy() ? "Comida duplicada" : "Añadida a hoy");
  }
  const r = React.useMemo(() => resumen(estado), [estado]);

  if (cargando) return <div className="flex flex-col gap-6"><Skeleton className="h-8 w-40" /><Skeleton className="h-56 w-full rounded-xl" /></div>;

  const d = dia(fecha);
  const comidas = d.comidas ?? [];
  const objetivoKcal = estado.perfil.kcalObjetivo ?? 2000;
  const consumidas = comidas.reduce((a, c) => a + c.kcal, 0);
  const macros = comidas.reduce(
    (a, c) => ({ p: a.p + c.proteinas, c: a.c + c.carbohidratos, g: a.g + c.grasas }),
    { p: 0, c: 0, g: 0 },
  );
  const obj = macrosObjetivo({ kcal: objetivoKcal, pesoKg: r.peso.estimadoHoy, objetivo: estado.perfil.objetivo, proteinaGkg: estado.perfil.proteinaObjetivo });
  const esFuturo = diasEntre(fecha, hoy()) < 0;

  // Coach de proteína: la proteína protege la masa muscular en déficit. Avisa
  // cuando el día ya lleva calorías pero la proteína va por detrás de su ritmo,
  // o cuando el día está completo pero se ha quedado corta.
  const avisoProteina = (() => {
    if (obj.proteinas <= 0 || consumidas <= 0) return null;
    const faltan = Math.round(obj.proteinas - macros.p);
    if (faltan <= 0) return null;
    const ritmoKcal = consumidas / objetivoKcal;      // % del día ya comido
    const ritmoProt = macros.p / obj.proteinas;        // % de proteína cubierta
    if (ritmoKcal >= 0.9 && ritmoProt < 0.85)
      return `Día casi completo pero te faltan ${faltan} g de proteína. Añade una fuente proteica.`;
    if (ritmoKcal >= 0.5 && ritmoProt < ritmoKcal - 0.2)
      return `Vas justo de proteína: ${Math.round(macros.p)} de ${obj.proteinas} g. Prioriza proteína en lo que queda.`;
    return null;
  })();

  return (
    <div className="flex flex-col gap-6">
      {/* Cabecera con navegación de día */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Nutrición</h1>
          <p className="mt-1 text-sm text-muted-foreground">Registra, revisa y ajusta cada estimación.</p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setFecha((f) => sumarDias(f, -1))} aria-label="Día anterior">
            <ChevronLeft className="size-5" />
          </Button>
          <button onClick={() => setFecha(hoy())} className="min-w-28 text-center text-sm font-medium">
            {fecha === hoy() ? "Hoy" : capitalizar(fmtFechaLarga(fecha))}
          </button>
          <Button variant="ghost" size="icon" onClick={() => setFecha((f) => sumarDias(f, 1))} disabled={esFuturo} aria-label="Día siguiente">
            <ChevronRight className="size-5" />
          </Button>
        </div>
      </header>

      {/* Resumen del día */}
      <Card className="p-5">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-7">
          <Ring value={consumidas} max={objetivoKcal} colorVar="--energy" size={140} stroke={13}>
            <div>
              <span className="block font-display text-3xl font-bold leading-none tabular text-energy">{fmtKcal(consumidas)}</span>
              <span className="text-xs text-muted-foreground">de {fmtKcal(objetivoKcal)} kcal</span>
            </div>
          </Ring>
          <div className="grid w-full flex-1 gap-3">
            <MacroBar label="Proteínas" value={macros.p} max={obj.proteinas} colorVar="--weight" />
            <MacroBar label="Carbohidratos" value={macros.c} max={obj.carbohidratos} colorVar="--habit" />
            <MacroBar label="Grasas" value={macros.g} max={obj.grasas} colorVar="--energy" />
            {avisoProteina && (
              <div className="mt-1 flex items-start gap-2 rounded-lg bg-weight-wash px-3 py-2 text-xs text-weight-ink">
                <Beef className="size-4 shrink-0" />
                <span>{avisoProteina}</span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Comidas por tipo */}
      {comidas.length === 0 ? (
        <EmptyState title="Sin comidas registradas" action={<Button onClick={() => abrir("comida", fecha)} className="mt-1 gap-2"><Plus className="size-4" /> Añadir comida</Button>}>
          Escribe lo que comes en lenguaje natural y RITMO calcula kcal y macros por ti.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-4">
          {ORDEN.map((tipo) => {
            const items = comidas.filter((c) => c.tipo === tipo.id);
            if (items.length === 0) return null;
            const kcalTipo = items.reduce((a, c) => a + c.kcal, 0);
            const Icono = tipo.icon;
            return (
              <section key={tipo.id}>
                <Card className="overflow-hidden p-0">
                  <div className={`flex items-center justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5 ${tipo.wash}`}>
                    <div className="flex items-center gap-3"><span className={`grid size-9 place-items-center rounded-xl bg-card/80 shadow-sm ${tipo.ink}`}><Icono className="size-4" /></span><div><h2 className="font-display text-lg font-bold">{tipo.label}</h2><p className="text-xs text-muted-foreground">{items.length} {items.length === 1 ? "registro" : "registros"}</p></div></div>
                    <span className={`font-display text-lg font-bold tabular ${tipo.ink}`}>{fmtKcal(kcalTipo)}<span className="ml-0.5 text-xs font-normal text-muted-foreground">kcal</span></span>
                  </div>
                  <div className="divide-y divide-border">
                  {items.map((c) => (
                    <div key={c.id} className="group flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-secondary/35 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl ${tipo.wash} text-xs font-bold ${tipo.ink}`}>{tipo.label.slice(0, 1)}</span>
                        <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{c.texto}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground tabular">
                          <span>P {c.proteinas}g</span>
                          <span>C {c.carbohidratos}g</span>
                          <span>G {c.grasas}g</span>
                          {c.fuente === "manual" ? <Chip tone="weight">manual</Chip> : c.estimado && <Chip tone={c.fuente === "gemini" ? "weight" : "warning"}>{c.fuente === "gemini" ? "Gemini · estimado" : c.fuente === "edamam" ? "Edamam · estimado" : "aprox."}</Chip>}
                        </p>
                        </div>
                      </div>
                      <div className="flex w-full items-center justify-between gap-1 sm:w-auto">
                        <span className="mr-1 font-display font-bold tabular text-energy">{fmtKcal(c.kcal)}</span>
                        {confirmBorrar === c.id ? (
                          <div className="flex items-center gap-1">
                            <Button variant="destructive" size="sm" className="h-8 gap-1 px-2 text-xs" onClick={() => { borrarComida(fecha, c.id); setConfirmBorrar(null); }}>
                              <AlertTriangle className="size-3" /> Borrar
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => setConfirmBorrar(null)}>
                              No
                            </Button>
                          </div>
                        ) : (
                          <>
                            <Button variant="ghost" size="icon" className="size-9 text-muted-foreground hover:text-foreground" onClick={() => repetirHoy(c)} aria-label={fecha === hoy() ? "Duplicar comida" : "Repetir hoy"} title={fecha === hoy() ? "Duplicar" : "Repetir hoy"}>
                              <RotateCcw className="size-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="size-9 text-muted-foreground hover:text-foreground" onClick={() => editarComidaEn(fecha, c)} aria-label="Editar comida" title="Editar">
                              <Pencil className="size-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="size-9 text-muted-foreground hover:text-destructive" onClick={() => setConfirmBorrar(c.id)} aria-label="Eliminar">
                              <Trash2 className="size-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                  </div>
                </Card>
              </section>
            );
          })}
          <Button onClick={() => abrir("comida", fecha)} variant="secondary" className="min-h-11 gap-2">
            <Sparkles className="size-4" /> Analizar otra comida
          </Button>
        </div>
      )}

      {/* Biblioteca personal de comidas: reutiliza cualquier plato en este día */}
      <MealLibrary fecha={fecha} />
    </div>
  );
}
