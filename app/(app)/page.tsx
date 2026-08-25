"use client";

import * as React from "react";
import Link from "next/link";
import { Award, Flame, Plus, Target, TrendingDown, TrendingUp, Utensils } from "lucide-react";
import { useRitmo } from "@/lib/store/provider";
import { useQuickLog } from "@/components/app/quick-log-provider";
import { resumen, adherenciaPorHabito, recordsPersonales, resumenPorMes } from "@/lib/model/analytics";
import { macrosObjetivo } from "@/lib/model/metrics";
import { HABITOS } from "@/lib/model/config";
import { hoy } from "@/lib/model/dates";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Ring, MacroBar, Metric, SectionLabel, Chip } from "@/components/app/primitives";
import { fmtPeso, fmtKcal, fmtSigno, fmtFechaCorta, relativo, capitalizar } from "@/lib/format";
import { cn } from "@/lib/utils";

function saludo(): string {
  const h = new Date().getHours();
  if (h < 6) return "Buenas noches";
  if (h < 13) return "Buenos días";
  if (h < 21) return "Buenas tardes";
  return "Buenas noches";
}

export default function HoyPage() {
  const { estado, cargando, dia, alternarHabito } = useRitmo();
  const { abrir } = useQuickLog();
  const hoyISO = hoy();

  const r = React.useMemo(() => resumen(estado), [estado]);
  const diaHoy = dia(hoyISO);

  if (cargando) return <CargandoHoy />;

  const nombre = estado.perfil.nombre?.split(" ")[0];
  const objetivoKcal = estado.perfil.kcalObjetivo ?? 2000;
  const consumidas = diaHoy.kcalConsumidas ?? 0;
  const restanteKcal = objetivoKcal - consumidas;

  const comidas = diaHoy.comidas ?? [];
  const macros = comidas.reduce(
    (a, c) => ({
      p: a.p + (c.proteinas || 0),
      c: a.c + (c.carbohidratos || 0),
      g: a.g + (c.grasas || 0),
    }),
    { p: 0, c: 0, g: 0 },
  );
  const objMacros = macrosObjetivo({
    kcal: objetivoKcal,
    pesoKg: r.peso.estimadoHoy,
    objetivo: estado.perfil.objetivo,
    proteinaGkg: estado.perfil.proteinaObjetivo,
  });

  const habitosHechos = HABITOS.filter((h) => diaHoy.habitos?.[h.clave]).length;
  const tendKg = r.prediccion.modelo?.kgSemana ?? r.tendencia?.kgSemana ?? null;

  return (
    <div className="flex flex-col gap-6">
      {/* Saludo */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{capitalizar(new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" }).format(new Date()))}</p>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {saludo()}{nombre ? `, ${nombre}` : ""}.
          </h1>
        </div>
        {r.habitos.rachaActual.longitud > 0 && (
          <div className="flex items-center gap-1.5 rounded-full bg-streak/12 px-3 py-1.5">
            <Flame className="size-4 text-streak" />
            <span className="font-display font-bold tabular text-streak">{r.habitos.rachaActual.longitud}</span>
            <span className="text-xs font-medium text-streak/90">días</span>
          </div>
        )}
      </header>

      {/* Energía de hoy */}
      <section>
        <SectionLabel action={<Link href="/nutricion" className="text-xs font-medium text-primary hover:underline">Ver nutrición</Link>}>
          Energía de hoy
        </SectionLabel>
        <Card className="p-5">
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-7">
            <Ring
              value={consumidas}
              max={objetivoKcal}
              colorVar="--energy"
              size={140}
              stroke={13}
              ariaLabel={`Energía de hoy: ${fmtKcal(consumidas)} de ${fmtKcal(objetivoKcal)} kcal`}
            >
              <div>
                <span className="block font-display text-3xl font-bold leading-none tabular">
                  {fmtKcal(Math.abs(restanteKcal))}
                </span>
                <span className="text-xs text-muted-foreground">
                  {restanteKcal >= 0 ? "kcal restantes" : "kcal de más"}
                </span>
              </div>
            </Ring>
            <div className="grid w-full flex-1 gap-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  <span className="font-semibold tabular text-foreground">{fmtKcal(consumidas)}</span> de {fmtKcal(objetivoKcal)} kcal
                </span>
              </div>
              <MacroBar label="Proteínas" value={macros.p} max={objMacros.proteinas} colorVar="--weight" />
              <MacroBar label="Carbohidratos" value={macros.c} max={objMacros.carbohidratos} colorVar="--habit" />
              <MacroBar label="Grasas" value={macros.g} max={objMacros.grasas} colorVar="--energy" />
            </div>
          </div>

          {/* Balance del día — basado en hábitos */}
          {(() => {
            const marcados = habitosHechos;
            const total = HABITOS.length;
            const pct = total > 0 ? marcados / total : 0;
            const tonos = pct >= 0.83
              ? { text: "text-primary", border: "border-primary/20", bg: "bg-primary/5", bar: "bg-primary" }
              : pct >= 0.5
                ? { text: "text-habit", border: "border-habit/20", bg: "bg-habit/5", bar: "bg-habit" }
                : pct > 0
                  ? { text: "text-warning", border: "border-warning/20", bg: "bg-warning/5", bar: "bg-warning" }
                  : { text: "text-energy", border: "border-energy/20", bg: "bg-energy/5", bar: "bg-energy" };
            const frase = pct >= 0.83
              ? "Día excelente, sigue así"
              : pct >= 0.5
                ? "Buen día, remata lo que falta"
                : pct > 0
                  ? "Día flojo, aún puedes mejorarlo"
                  : "Aún no has cumplido ningún hábito";
            const kcalWarning = restanteKcal < 0 && habitosHechos >= 4;
            return (
              <div className={cn("mt-4 flex flex-col gap-2 rounded-xl border px-4 py-3", tonos.border, tonos.bg)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Target className={cn("size-5", tonos.text)} />
                    <div>
                      <p className={cn("text-sm font-bold", tonos.text)}>Balance del día</p>
                      <p className="text-xs text-muted-foreground">{frase}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={cn("font-display text-2xl font-bold tabular", tonos.text)}>
                      {marcados}/{total}
                    </span>
                    <p className="text-[0.6rem] text-muted-foreground">hábitos</p>
                  </div>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div className={cn("h-full rounded-full transition-all", tonos.bar)} style={{ width: `${pct * 100}%` }} />
                </div>
                {kcalWarning && (
                  <p className="flex items-center gap-1.5 text-[0.7rem] text-warning">
                    <Flame className="size-3" />
                    Has marcado hábitos como cumplidos pero superas tu objetivo calórico — revisa porciones.
                  </p>
                )}
              </div>
            );
          })()}
        </Card>
      </section>

      {/* Último pesaje */}
      <section>
        <SectionLabel action={<Link href="/progreso" className="text-xs font-medium text-primary hover:underline">Ver progreso</Link>}>
          Peso
        </SectionLabel>
        <Card className="p-5">
          {r.peso.actual != null ? (
            <div className="flex items-center justify-between gap-4">
              <div>
                <Metric label="Último peso real" value={fmtPeso(r.peso.actual)} unit="kg" tone="weight" />
                {r.peso.fecha && (
                  <p className="mt-1 text-xs text-muted-foreground">báscula · {relativo(r.peso.fecha, hoyISO)}</p>
                )}
              </div>
              <div className="text-right">
                {tendKg != null && (
                  <div className={cn("inline-flex items-center gap-1 font-semibold tabular", tendKg <= 0 ? "text-weight" : "text-energy")}>
                    {tendKg <= 0 ? <TrendingDown className="size-4" /> : <TrendingUp className="size-4" />}
                    {fmtSigno(tendKg, 2)} kg/sem
                  </div>
                )}
                {r.peso.restante != null && estado.perfil.pesoObjetivo != null && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {Math.abs(r.peso.restante) < 0.1
                      ? "¡En tu objetivo!"
                      : `${fmtPeso(Math.abs(r.peso.restante))} kg hasta ${fmtPeso(estado.perfil.pesoObjetivo)}`}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <p className="text-sm text-muted-foreground">Aún no hay pesajes. Registra tu peso para activar la predicción.</p>
              <Button onClick={() => abrir("peso")} variant="secondary" className="gap-2">
                <Plus className="size-4" /> Registrar peso
              </Button>
            </div>
          )}
        </Card>
      </section>

      {/* Hábitos de hoy */}
      <section>
        <SectionLabel action={<Link href="/habitos" className="text-xs font-medium text-primary hover:underline">Ver hábitos</Link>}>
          Hábitos de hoy · {habitosHechos}/{HABITOS.length}
        </SectionLabel>
        <Card className="p-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {HABITOS.map((h) => {
              const hecho = diaHoy.habitos?.[h.clave] === true;
              return (
                <button
                  key={h.clave}
                  onClick={() => alternarHabito(hoyISO, h.clave)}
                  aria-pressed={hecho}
                  className={cn(
                    "h-11 flex items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors",
                    hecho ? "border-primary/40 bg-primary/8 text-foreground" : "border-border text-muted-foreground hover:bg-secondary",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded-full border-2",
                      hecho ? "border-primary bg-primary text-primary-foreground animate-check-ring" : "border-border",
                    )}
                  >
                    {hecho && <span className="text-[0.6rem] animate-check-pop">✓</span>}
                  </span>
                  <span className="truncate">{h.etiqueta}</span>
                </button>
              );
            })}
          </div>
        </Card>
      </section>

      {/* Comidas de hoy */}
      <section>
        <SectionLabel action={<button onClick={() => abrir("comida")} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground"><Plus className="size-3.5" /> Añadir</button>}>
          Comidas de hoy
        </SectionLabel>
        <Card className="overflow-hidden p-0">
          {comidas.length === 0 ? (
            <button onClick={() => abrir("comida")} className="flex w-full items-center gap-4 px-5 py-6 text-left transition-colors hover:bg-energy-wash/35">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-energy-wash text-energy"><Utensils className="size-5" /></span>
              <span><span className="block text-sm font-semibold">Aún no hay comidas registradas</span><span className="mt-0.5 block text-xs text-muted-foreground">Añade la primera y RITMO calcula sus macros.</span></span>
              <Plus className="ml-auto size-5 text-energy" />
            </button>
          ) : (
            <div className="divide-y divide-border">
              {comidas.map((c) => (
                <button key={c.id} onClick={() => abrir("comida")} className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-secondary/45">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-energy-wash text-[0.65rem] font-bold uppercase text-energy">{c.tipo.slice(0, 1)}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{c.texto}</span><span className="mt-1 flex flex-wrap gap-x-2 text-[0.68rem] tabular text-muted-foreground">P {c.proteinas}g · C {c.carbohidratos}g · G {c.grasas}g</span></span>
                  <span className="shrink-0 text-right font-display text-lg font-bold tabular text-energy">{fmtKcal(c.kcal)}<span className="ml-0.5 text-[0.65rem] font-normal text-muted-foreground">kcal</span></span>
                </button>
              ))}
              <button onClick={() => abrir("comida")} className="flex w-full items-center justify-center gap-2 py-3 text-xs font-semibold text-primary hover:bg-primary/5"><Plus className="size-3.5" /> Añadir otra comida</button>
            </div>
          )}
        </Card>
      </section>

      {/* Insights semanales */}
      <WeeklyInsights r={r} estado={estado} />
    </div>
  );
}

/** Veredicto de la semana: de enhorabuena a toque de atención. */
type Veredicto = "excelente" | "bien" | "flojea" | "mal";

const VEREDICTO: Record<Veredicto, { titulo: string; clase: string; punto: string }> = {
  excelente: { titulo: "Semana excelente", clase: "text-primary", punto: "bg-primary" },
  bien: { titulo: "Buena semana", clase: "text-habit", punto: "bg-habit" },
  flojea: { titulo: "Semana irregular", clase: "text-warning", punto: "bg-warning" },
  mal: { titulo: "Semana floja", clase: "text-energy", punto: "bg-energy" },
};

function WeeklyInsights({ r, estado }: { r: ReturnType<typeof resumen>; estado: typeof r extends never ? never : Parameters<typeof resumen>[0] }) {
  const porHabito = React.useMemo(
    () => [...adherenciaPorHabito(estado, HABITOS, 7)].sort((a, b) => b.pct - a.pct),
    [estado],
  );
  const rec = React.useMemo(() => recordsPersonales(estado), [estado]);
  const meses = React.useMemo(() => resumenPorMes(estado), [estado]);

  const adh = r.habitos.adherencia7;
  const racha = r.habitos.rachaActual.longitud;
  const mejorRacha = r.habitos.mejorRacha.longitud;
  const tendKg = r.prediccion.modelo?.kgSemana ?? null;
  const quiere = estado.perfil.objetivo ?? "perder";

  let veredicto: Veredicto = adh >= 85 ? "excelente" : adh >= 70 ? "bien" : adh >= 50 ? "flojea" : "mal";
  const enContra =
    tendKg != null && ((quiere === "perder" && tendKg > 0.15) || (quiere === "ganar" && tendKg < -0.15));
  if (enContra && veredicto !== "mal") {
    veredicto = veredicto === "excelente" ? "bien" : veredicto === "bien" ? "flojea" : "mal";
  }
  const v = VEREDICTO[veredicto];

  const cabecera =
    veredicto === "excelente"
      ? `${adh}% de constancia. Enhorabuena, así se construye.`
      : veredicto === "bien"
        ? `${adh}% de constancia. Vas bien; afina un detalle y es redonda.`
        : veredicto === "flojea"
          ? `${adh}% de constancia. Ni mal ni bien: te falta rematar los días.`
          : `${adh}% de constancia. Esta semana se te ha escapado. Recupérala hoy.`;

  const lineas: { icon: React.ReactNode; text: string }[] = [];

  const peor = porHabito[porHabito.length - 1];
  if (peor && peor.pct < 100) {
    lineas.push({
      icon: <Target className="size-4 shrink-0 text-warning" />,
      text: `Incide en ${peor.etiqueta.toLowerCase()}: ${peor.hechos} de ${peor.total} días. Es lo que más te suma ahora.`,
    });
  }

  const mejor = porHabito[0];
  if (mejor && mejor.pct >= 70 && mejor.clave !== peor?.clave) {
    lineas.push({
      icon: <TrendingUp className="size-4 shrink-0 text-habit" />,
      text: `${mejor.etiqueta} lo tienes dominado (${mejor.pct}%). Esa base no la sueltes.`,
    });
  }

  if (racha >= 3) {
    lineas.push({
      icon: <Award className="size-4 shrink-0 text-streak" />,
      text: `${racha} días seguidos con los 6 hábitos. No rompas la cadena.`,
    });
  } else if (racha === 0 && mejorRacha >= 3) {
    lineas.push({
      icon: <Award className="size-4 shrink-0 text-muted-foreground" />,
      text: `Sin racha viva. Tu récord son ${mejorRacha} días: hoy puede ser el 1.`,
    });
  }

  if (tendKg != null && Math.abs(tendKg) >= 0.1) {
    const baja = tendKg < 0;
    lineas.push({
      icon: baja
        ? <TrendingDown className="size-4 shrink-0 text-weight" />
        : <TrendingUp className="size-4 shrink-0 text-energy" />,
      text: enContra
        ? `El peso sube ~${Math.abs(tendKg).toFixed(1)} kg/semana y tu objetivo es ${quiere}. Ahí está el desajuste.`
        : `${baja ? "Pierdes" : "Ganas"} ~${Math.abs(tendKg).toFixed(1)} kg/semana, en línea con tu objetivo.`,
    });
  }

  if ((r.prediccion.diasSinPesaje ?? 0) >= 14) {
    lineas.push({
      icon: <Target className="size-4 shrink-0 text-muted-foreground" />,
      text: `Llevas ${r.prediccion.diasSinPesaje} días sin pesarte: la estimación se va abriendo. Una báscula la reajusta.`,
    });
  }

  const hayRecords = rec.mejorMesAdherencia || rec.mayorPerdidaMes || rec.totalDiasRegistrados > 0;

  return (
    <section>
      <SectionLabel>Resumen y records</SectionLabel>
      <Card className="flex flex-col gap-0 p-0 overflow-hidden">
        {/* Veredicto semanal */}
        <div className="flex flex-col gap-3 p-5">
          <div className="flex items-start gap-2.5">
            <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", v.punto)} />
            <div>
              <p className={cn("font-display text-sm font-bold", v.clase)}>{v.titulo}</p>
              <p className="text-sm text-muted-foreground">{cabecera}</p>
            </div>
          </div>
          {lineas.length > 0 && (
            <div className="flex flex-col gap-2.5 border-t border-border pt-3">
              {lineas.map((l, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  {l.icon}
                  <span className="text-muted-foreground">{l.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Records personales */}
        {hayRecords && (
          <div className="border-t border-border bg-secondary/30 p-5">
            <p className="mb-3 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Tus records</p>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <RecordBadge icon={<Award className="size-3.5 text-streak" />} label="Mejor racha" value={`${mejorRacha}`} unit="días" />
              {rec.mejorMesAdherencia && (
                <RecordBadge icon={<Flame className="size-3.5 text-habit" />} label="Mejor mes" value={`${rec.mejorMesAdherencia.adherenciaMedia}%`} sub={rec.mejorMesAdherencia.etiqueta} />
              )}
              {rec.mayorPerdidaMes && (
                <RecordBadge icon={<TrendingDown className="size-3.5 text-weight" />} label="Mayor pérdida" value={fmtSigno(rec.mayorPerdidaMes.cambioPeso as number, 1)} unit="kg" sub={rec.mayorPerdidaMes.etiqueta} />
              )}
              <RecordBadge icon={<Utensils className="size-3.5 text-energy" />} label="Comidas" value={`${rec.totalComidas}`} sub={`${rec.totalDiasRegistrados} días`} />
            </div>
          </div>
        )}

        {/* Comparativa mensual */}
        {(() => {
          const esteMes = meses[0] ?? null;
          const mesPrevio = meses[1] ?? null;
          if (!esteMes || !mesPrevio) return null;
          const deltaAdh = esteMes.adherenciaMedia - mesPrevio.adherenciaMedia;
          return (
            <div className="border-t border-border p-5">
              <div className="flex items-start gap-3 text-sm">
                {deltaAdh >= 0
                  ? <TrendingUp className="size-4 shrink-0 text-weight" />
                  : <TrendingDown className="size-4 shrink-0 text-energy" />}
                <span className="text-muted-foreground">
                  Este mes ({esteMes.etiqueta}): <span className="tabular font-medium text-foreground">{esteMes.adherenciaMedia}%</span> de constancia,{" "}
                  {deltaAdh === 0
                    ? "igual que"
                    : <><span className="tabular font-medium text-foreground">{Math.abs(deltaAdh)} pts</span> {deltaAdh > 0 ? "por encima" : "por debajo"} de</>}{" "}
                  {mesPrevio.etiqueta}{mesPrevio.cambioPeso != null ? <> · {mesPrevio.cambioPeso <= 0 ? "perdiste" : "ganaste"} <span className="tabular font-medium text-foreground">{fmtPeso(Math.abs(mesPrevio.cambioPeso))}</span> kg</> : null}.
                </span>
              </div>
            </div>
          );
        })()}
      </Card>
    </section>
  );
}

function RecordBadge({ icon, label, value, unit, sub }: { icon: React.ReactNode; label: string; value: string; unit?: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg bg-background px-3 py-2.5 shadow-sm">
      <div className="grid size-7 shrink-0 place-items-center rounded-md bg-secondary">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[0.6rem] text-muted-foreground truncate">{label}</p>
        <p className="font-display text-sm font-bold tabular leading-none">
          {value}{unit && <span className="ml-0.5 text-[0.6rem] font-medium text-muted-foreground">{unit}</span>}
        </p>
        {sub && <p className="text-[0.55rem] text-muted-foreground truncate">{sub}</p>}
      </div>
    </div>
  );
}

function RevItem({ etiqueta, valor, sub, destacado }: { etiqueta: string; valor: string; sub: string; destacado?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">{etiqueta}</span>
      <span className={cn("font-display font-bold tabular", destacado ? "text-lg text-weight" : "text-base")}>{valor}</span>
      <span className="text-[0.65rem] text-muted-foreground">{sub}</span>
    </div>
  );
}

function CargandoHoy() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-12 w-2/3" />
      <Skeleton className="h-56 w-full rounded-xl" />
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  );
}
