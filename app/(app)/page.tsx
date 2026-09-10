"use client";

import * as React from "react";
import Link from "next/link";
import { Award, CheckCircle2, Eye, EyeOff, Flame, Plus, Scale, Target, TrendingDown, TrendingUp, Utensils } from "lucide-react";
import { useRitmo } from "@/lib/store/provider";
import { useQuickLog } from "@/components/app/quick-log-provider";
import { resumen, adherenciaPorHabito, recordsPersonales, resumenPorMes } from "@/lib/model/analytics";
import { macrosObjetivo } from "@/lib/model/metrics";
import { habitosModelo } from "@/lib/model/config";
import { diasEntre, hoy, sumarDias } from "@/lib/model/dates";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Ring, MacroBar, Metric, SectionLabel } from "@/components/app/primitives";
import { fmtPeso, fmtKcal, fmtSigno, relativo, capitalizar } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MonthlyShare } from "@/components/app/monthly-share";
import { RitmoDisclosure } from "@/components/ui/ritmo-disclosure";
import { qualityForDay, RecordQuality } from "@/components/app/record-quality";
import { detectarSenales, diagnosticoRescate } from "@/lib/model/insights";
import { useReleasedExperiments, useWeightModelCycle } from "@/components/app/platform-provider";
import { RescueMode } from "@/components/app/rescue-mode";
import { SignalDetector } from "@/components/app/signal-detector";

function saludo(): string {
  const h = new Date().getHours();
  if (h < 6) return "Buenas noches";
  if (h < 13) return "Buenos días";
  if (h < 21) return "Buenas tardes";
  return "Buenas noches";
}

export default function HoyPage() {
  const { estado, userId, auditoriaModelo, cargando, dia, alternarHabito } = useRitmo();
  const { abrir } = useQuickLog();
  const hoyISO = hoy();
  const experimentos = useReleasedExperiments(userId);
  const [mostrarPanelCompleto, setMostrarPanelCompleto] = React.useState(false);
  const [mostrarLecturasSecundarias, setMostrarLecturasSecundarias] = React.useState(false);

  const cicloModelo = useWeightModelCycle(estado, auditoriaModelo.predicciones, hoyISO);
  const r = React.useMemo(() => resumen(estado, cicloModelo.estrategia), [estado, cicloModelo.estrategia]);
  const habitosActivos = React.useMemo(() => habitosModelo(estado.perfil), [estado.perfil]);
  const diaHoy = dia(hoyISO);
  const rescate = React.useMemo(() => diagnosticoRescate(estado, hoyISO), [estado, hoyISO]);

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

  const habitosHechos = habitosActivos.filter((h) => diaHoy.habitos?.[h.clave]).length;
  const tendKg = r.prediccion.modelo?.kgSemana ?? r.tendencia?.kgSemana ?? null;
  const diasDesdePeso = r.peso.fecha ? Math.max(0, diasEntre(r.peso.fecha, hoyISO)) : Infinity;
  const pesoRequiereAtencion = r.peso.actual == null || diasDesdePeso >= 7 || (tendKg != null && Math.abs(tendKg) >= 0.25);
  const pesoEnSegundoPlano = experimentos.modoInvisible && !pesoRequiereAtencion && !mostrarLecturasSecundarias;
  const calidadRegistro = qualityForDay(comidas, habitosHechos, habitosActivos.length);
  const lecturaPrincipal = comidas.length === 0 && habitosHechos === 0
    ? "Tu día empieza con un registro"
    : habitosHechos === habitosActivos.length
      ? "Hábitos completos; protege esta base"
      : comidas.length > 0 && habitosHechos === 0
        ? "La comida está; faltan tus hábitos"
        : comidas.length === 0
          ? "Tus hábitos ya orientan el día"
          : "Tu día está tomando forma";

  if (experimentos.rescateAutomatico && rescate.activo && !mostrarPanelCompleto && rescate.habitoClave) {
    return (
      <div className="flex min-h-[calc(100dvh-10rem)] flex-col gap-4">
        <header><p className="text-sm text-muted-foreground">{capitalizar(new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" }).format(new Date()))}</p><h1 className="font-display text-2xl font-bold tracking-tight">{saludo()}{nombre ? `, ${nombre}` : ""}.</h1></header>
        <RescueMode rescate={rescate} onCompletar={() => { void alternarHabito(hoyISO, rescate.habitoClave!).then((guardado) => { if (guardado) setMostrarPanelCompleto(true); }); }} onVerTodo={() => setMostrarPanelCompleto(true)} />
      </div>
    );
  }

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

      <div className="today-overview">
      {/* Energía de hoy */}
      <section className="today-overview-main">
        <SectionLabel action={<Link href="/nutricion" className="text-xs font-medium text-primary hover:underline">Ver nutrición</Link>}>
          Energía de hoy
        </SectionLabel>
        <Card className="h-full p-4 sm:p-5">
          <div className="mb-4 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="font-display text-xl font-bold">{lecturaPrincipal}</h2><p className="mt-1 text-sm text-muted-foreground">{habitosHechos === habitosActivos.length ? "Por hoy, tu base está completa." : "Un paso cada vez. Lo demás puede esperar."}</p></div>
            <div className="flex flex-wrap gap-2">
              {habitosHechos < habitosActivos.length ? <Button size="sm" onClick={() => abrir("habitos")} className="gap-1.5"><CheckCircle2 className="size-3.5" /> Revisar hábitos</Button>
                : r.peso.actual == null ? <Button size="sm" onClick={() => abrir("peso")} className="gap-1.5"><Scale className="size-3.5" /> Añadir primer peso</Button>
                : comidas.length === 0 ? <Button size="sm" variant="secondary" onClick={() => abrir("comida")} className="gap-1.5"><Plus className="size-3.5" /> Añadir comida, si quieres</Button>
                : <Link href="/progreso" className="text-sm font-medium text-primary underline underline-offset-4">Ver evolución</Link>}
            </div>
          </div>
          <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-3 sm:flex sm:gap-7">
            <Ring value={consumidas} max={objetivoKcal} colorVar="--energy" segments={[{ value: macros.p, max: objMacros.proteinas, colorVar: "--weight" }, { value: macros.c, max: objMacros.carbohidratos, colorVar: "--habit" }, { value: macros.g, max: objMacros.grasas, colorVar: "--energy" }]} size={116} stroke={11} className="sm:[width:140px] sm:[height:140px]" ariaLabel={`Energía de hoy: ${fmtKcal(consumidas)} de ${fmtKcal(objetivoKcal)} kcal`}>
              <div><span className="block font-display text-3xl font-bold leading-none tabular">{fmtKcal(Math.abs(restanteKcal))}</span><span className="text-xs text-muted-foreground">{restanteKcal >= 0 ? "kcal restantes" : "kcal de más"}</span></div>
            </Ring>
            <div className="grid w-full flex-1 gap-2 sm:gap-3">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground"><span className="font-semibold tabular text-foreground">{fmtKcal(consumidas)}</span> de {fmtKcal(objetivoKcal)} kcal</span></div>
              <div className="grid grid-cols-3 gap-1.5 text-center text-[0.68rem] sm:hidden"><span className="rounded-lg bg-weight-wash py-1 font-semibold text-weight">P {Math.round(macros.p)}g</span><span className="rounded-lg bg-habit-wash py-1 font-semibold text-habit-ink">C {Math.round(macros.c)}g</span><span className="rounded-lg bg-energy-wash py-1 font-semibold text-energy-ink">G {Math.round(macros.g)}g</span></div>
              <div className="hidden gap-3 sm:grid"><MacroBar label="Proteínas" value={macros.p} max={objMacros.proteinas} colorVar="--weight" /><MacroBar label="Carbohidratos" value={macros.c} max={objMacros.carbohidratos} colorVar="--habit" /><MacroBar label="Grasas" value={macros.g} max={objMacros.grasas} colorVar="--energy" /></div>
            </div>
          </div>

          {/* Balance del día — basado en hábitos */}
          {(() => {
            const marcados = habitosHechos;
            const total = habitosActivos.length;
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
              <div className={cn("mt-3 flex flex-col gap-2 rounded-xl border px-3 py-2.5 sm:mt-4 sm:px-4 sm:py-3", tonos.border, tonos.bg)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Target className={cn("size-5", tonos.text)} />
                    <div>
                      <p className={cn("text-sm font-bold", tonos.text)}>Hábitos de hoy</p>
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
          <RecordQuality level={calidadRegistro.level} detail={calidadRegistro.detail} className="mt-4" />
        </Card>
      </section>

      <div className="today-overview-side">
      {/* Último pesaje */}
      {pesoEnSegundoPlano ? (
        <div className="invisible-reading" role="status">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-weight-wash text-weight"><EyeOff className="size-4" /></span>
          <span className="min-w-0 flex-1"><span className="block text-xs font-semibold">Peso estable, en segundo plano</span><span className="block truncate text-[0.68rem] text-muted-foreground">Tu último pesaje es reciente y no requiere una acción.</span></span>
          <button type="button" onClick={() => setMostrarLecturasSecundarias(true)} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-primary hover:bg-primary/8"><Eye className="size-3.5" /> Mostrar</button>
        </div>
      ) : <section className="today-weight">
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
      </section>}

      {/* Hábitos de hoy */}
      <section className="today-habits">
        <SectionLabel action={<Link href="/habitos" className="text-xs font-medium text-primary hover:underline">Ver hábitos</Link>}>
          Hábitos de hoy · {habitosHechos}/{habitosActivos.length}
        </SectionLabel>
        <Card className="p-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {habitosActivos.map((h) => {
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
      </div>
      </div>

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
      <WeeklyInsights r={r} estado={estado} detectorAvanzado={experimentos.detectorAvanzado} />
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

function WeeklyInsights({ r, estado, detectorAvanzado }: { r: ReturnType<typeof resumen>; estado: Parameters<typeof resumen>[0]; detectorAvanzado: boolean }) {
  const porHabito = React.useMemo(
    () => [...adherenciaPorHabito(estado, habitosModelo(estado.perfil), 7)].sort((a, b) => b.pct - a.pct),
    [estado],
  );
  const rec = React.useMemo(() => recordsPersonales(estado), [estado]);
  const senales = React.useMemo(() => detectarSenales(estado), [estado]);
  const meses = React.useMemo(() => resumenPorMes(estado), [estado]);

  const adh = r.habitos.adherencia7;
  const quiere = estado.perfil.objetivo ?? "perder";
  const tendencia = r.prediccion.modelo?.kgSemana ?? null;
  let veredicto: Veredicto = adh >= 85 ? "excelente" : adh >= 70 ? "bien" : adh >= 50 ? "flojea" : "mal";
  const enContra = tendencia != null && ((quiere === "perder" && tendencia > 0.15) || (quiere === "ganar" && tendencia < -0.15));
  if (enContra && veredicto !== "mal") veredicto = veredicto === "excelente" ? "bien" : veredicto === "bien" ? "flojea" : "mal";
  const v = VEREDICTO[veredicto];
  const estaSemana = resumenSemana(estado, hoy());
  const semanaAnterior = resumenSemana(estado, sumarDias(hoy(), -7));
  const deltaSemana = estaSemana.adherencia - semanaAnterior.adherencia;
  const mediaPersonal = mediaSemanalPersonal(estado, hoy());
  const deltaMedia = mediaPersonal == null ? null : estaSemana.adherencia - mediaPersonal;
  const peor = porHabito[porHabito.length - 1];
  const mejorRacha = r.habitos.mejorRacha.longitud;
  const hayRecords = rec.mejorMesAdherencia || rec.mayorPerdidaMes || rec.totalDiasRegistrados > 0;

  const foco = peor && peor.pct < 100
    ? {
        icon: <Target className="size-4 text-warning" />,
        text: "Refuerza " + peor.etiqueta.toLowerCase() + ": lo cumpliste " + peor.hechos + " de " + peor.total + " días.",
      }
    : tendencia != null
      ? {
          icon: tendencia <= 0 ? <TrendingDown className="size-4 text-weight" /> : <TrendingUp className="size-4 text-energy" />,
          text: (tendencia <= 0 ? "La tendencia baja" : "La tendencia sube") + " " + Math.abs(tendencia).toFixed(1) + " kg/semana.",
        }
      : null;

  return (
    <section>
      <SectionLabel action={<MonthlyShare meses={meses} estado={estado} />}>Esta semana</SectionLabel>
      <Card className="flex flex-col gap-0 overflow-hidden p-0">
        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className={cn("size-2.5 shrink-0 rounded-full", v.punto)} aria-hidden="true" />
              <h2 className="truncate font-display text-xl font-bold">{v.titulo}</h2>
            </div>
            <div className="flex shrink-0 items-baseline gap-1.5">
              <span className={cn("font-display text-2xl font-bold tabular", v.clase)}>{adh}%</span>
              <span className="text-xs text-muted-foreground">constancia</span>
            </div>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">{estaSemana.diasConDatos}/7 días registrados · {estaSemana.comidas} comidas</p>
          {foco ? (
            <div className="mt-4 flex items-center gap-2.5 border-t border-border pt-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary">{foco.icon}</span>
              <p className="min-w-0 text-sm text-muted-foreground"><span className="font-semibold text-foreground">Siguiente foco:</span> {foco.text}</p>
            </div>
          ) : (
            <p className="mt-4 border-t border-border pt-3 text-sm text-muted-foreground">Registra unos días más para obtener una lectura útil.</p>
          )}
        </div>

        <RitmoDisclosure title="Comparativa y mejores marcas" openLabel="Ver resumen">
          <div className="border-t border-border py-4">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 px-4 text-xs sm:px-5">
              <span className="font-semibold text-foreground">Esta semana {estaSemana.adherencia}%</span>
              {mediaPersonal != null && <><span className="text-muted-foreground">tu media {mediaPersonal}%</span><span className={cn("font-semibold tabular", (deltaMedia ?? 0) >= 0 ? "text-weight" : "text-energy")}>{fmtSigno(deltaMedia, 0)} pts</span></>}
              <span className="text-muted-foreground">· anterior {semanaAnterior.adherencia}% ({fmtSigno(deltaSemana, 0)})</span>
              <span className="text-muted-foreground">· {estaSemana.diasConDatos}/7 días</span>
            </div>

            {meses.length > 0 && <MonthlyRanking meses={meses} estado={estado} />}

            {hayRecords && (
              <div className="mt-3 border-t border-border px-4 pt-3 sm:px-5">
                <h3 className="text-xs font-semibold text-muted-foreground">Mejores marcas</h3>
                <div className="mt-2 grid divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                  <RecordLineCompact icon={<Award className="size-4 text-streak" />} label="Mejor racha" value={String(mejorRacha)} unit="días" />
                  {rec.mejorMesAdherencia && <RecordLineCompact icon={<Flame className="size-4 text-habit" />} label="Mejor mes" value={rec.mejorMesAdherencia.adherenciaMedia + "%"} sub={rec.mejorMesAdherencia.etiqueta} />}
                  {rec.mayorPerdidaMes && <RecordLineCompact icon={<TrendingDown className="size-4 text-weight" />} label="Mejor avance" value={fmtSigno(rec.mayorPerdidaMes.cambioPeso as number, 1)} unit="kg" sub={rec.mayorPerdidaMes.etiqueta} />}
                </div>
              </div>
            )}
          </div>
        </RitmoDisclosure>

        {detectorAvanzado && <RitmoDisclosure title="Detector de señales" openLabel={senales.length ? `${senales.length} señales` : "Aún aprendiendo"}><div className="border-t border-border"><SignalDetector senales={senales} /></div></RitmoDisclosure>}
      </Card>
    </section>
  );
}

function MonthlyRanking({ meses, estado }: { meses: ReturnType<typeof resumenPorMes>; estado: Parameters<typeof resumen>[0] }) {
  const habitosActivos = habitosModelo(estado.perfil);
  const perfectosPorMes = new Map<string, number>();
  for (const dia of Object.values(estado.dias)) {
    if (habitosActivos.length === 0 || !habitosActivos.every((habito) => dia.habitos?.[habito.clave] === true)) continue;
    const mes = dia.fecha.slice(0, 7);
    perfectosPorMes.set(mes, (perfectosPorMes.get(mes) ?? 0) + 1);
  }
  const ranking = [...meses]
    .filter((mes) => mes.diasRegistrados > 0)
    .map((mes) => ({ ...mes, diasPerfectos: perfectosPorMes.get(mes.clave) ?? 0 }))
    .sort((a, b) => b.diasPerfectos - a.diasPerfectos || b.adherenciaMedia - a.adherenciaMedia || b.clave.localeCompare(a.clave));

  if (ranking.length === 0) return null;
  const maxPerfectos = Math.max(1, ...ranking.map((mes) => mes.diasPerfectos));

  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="mb-1 flex items-center justify-between gap-3 px-4 sm:px-5"><h3 className="text-xs font-semibold text-muted-foreground">Ranking de días perfectos</h3><span className="text-[0.62rem] text-muted-foreground">{habitosActivos.length}/{habitosActivos.length} hábitos</span></div>
      <ol className="divide-y divide-border px-4 sm:px-5" aria-label="Ranking mensual por días con todos los hábitos cumplidos">
        {ranking.map((mes, index) => (
          <li key={mes.clave} className="grid grid-cols-[1.6rem_minmax(0,1fr)_auto] items-center gap-2.5 py-2">
            <span className={cn("grid size-6 place-items-center rounded-full text-[0.65rem] font-bold tabular", index < 3 ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground")}>{index + 1}</span>
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-xs font-semibold capitalize">{mes.etiqueta}</span>
                <span className="shrink-0 text-[0.62rem] text-muted-foreground">{mes.adherenciaMedia}% constancia</span>
                {mes.cambioPeso != null && <span className={cn("ml-auto hidden shrink-0 text-[0.62rem] font-medium tabular sm:inline", mes.cambioPeso <= 0 ? "text-weight" : "text-energy")}>{fmtSigno(mes.cambioPeso, 1)} kg</span>}
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden="true"><span className="block h-full rounded-full bg-primary" style={{ width: `${(mes.diasPerfectos / maxPerfectos) * 100}%` }} /></div>
            </div>
            <div className="min-w-16 text-right"><span className="font-display text-base font-bold tabular text-primary">{mes.diasPerfectos}</span><span className="ml-1 text-[0.62rem] text-muted-foreground">día{mes.diasPerfectos === 1 ? "" : "s"}</span>{mes.cambioPeso != null && <span className={cn("block text-[0.58rem] font-medium tabular sm:hidden", mes.cambioPeso <= 0 ? "text-weight" : "text-energy")}>{fmtSigno(mes.cambioPeso, 1)} kg</span>}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function RecordLineCompact({ icon, label, value, unit, sub }: { icon: React.ReactNode; label: string; value: string; unit?: string; sub?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 px-2 py-2 first:pl-0 last:pr-0 sm:py-1">
      <span className="shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <p className="mt-0.5 font-display text-base font-bold leading-none tabular">{value}{unit && <span className="ml-1 text-[0.62rem] font-medium text-muted-foreground">{unit}</span>}</p>
        {sub && <p className="mt-0.5 truncate text-[0.62rem] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

function resumenSemana(estado: Parameters<typeof resumen>[0], hasta: string) {
  const habitosActivos = habitosModelo(estado.perfil);
  let habitos = 0; let comidas = 0; let diasConDatos = 0;
  for (let i = 0; i < 7; i++) {
    const d = estado.dias[sumarDias(hasta, -i)];
    const hechos = habitosActivos.filter((h) => d?.habitos?.[h.clave]).length;
    habitos += hechos; comidas += d?.comidas?.length ?? 0;
    if (hechos > 0 || (d?.comidas?.length ?? 0) > 0 || d?.peso != null) diasConDatos++;
  }
  return { adherencia: Math.round((habitos / (habitosActivos.length * 7)) * 100), comidas, diasConDatos };
}

function mediaSemanalPersonal(estado: Parameters<typeof resumen>[0], hasta: string): number | null {
  const semanas = Array.from({ length: 8 }, (_, index) => resumenSemana(estado, sumarDias(hasta, -(index + 1) * 7)))
    .filter((semana) => semana.diasConDatos > 0);
  if (semanas.length === 0) return null;
  return Math.round(semanas.reduce((total, semana) => total + semana.adherencia, 0) / semanas.length);
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
