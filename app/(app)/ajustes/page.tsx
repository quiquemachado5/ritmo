"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Download, FileSpreadsheet, HistoryIcon, LogOut, Monitor, Moon, Plane, ShieldCheck, Sun, Trash2, Upload, UserRound } from "lucide-react";
import { useRitmo } from "@/lib/store/provider";
import { FACTORES_ACTIVIDAD } from "@/lib/model/metrics";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionLabel } from "@/components/app/primitives";
import { limpiarDatosLocales, marcarExportacion, diasDesdeExportacion, leerBackupLocal } from "@/lib/backup";
import { limpiarPreferenciasComidas } from "@/lib/meal-prefs";
import { fmtFechaCorta } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Objetivo, Sexo } from "@/lib/model/types";
import { guardarModoViaje, useModoViaje } from "@/lib/travel-mode";

type Densidad = "compacta" | "espaciosa";

export default function AjustesPage() {
  const { estado, cargando, modo, userEmail, actualizarPerfil, exportar, importar, cerrarSesion, borrarDatos } = useRitmo();
  const { theme, setTheme } = useTheme();
  const viaje = useModoViaje();
  const fileRef = React.useRef<HTMLInputElement>(null);

  const p = estado.perfil;
  const [form, setForm] = React.useState(p);
  React.useEffect(() => setForm(p), [p]);
  // Todos los hooks van ANTES de cualquier return: las reglas de hooks exigen
  // el mismo número y orden en cada render (cargando vs cargado incluido).
  const [diasSinExportar, setDiasSinExportar] = React.useState<number | null>(null);
  const [backupInfo, setBackupInfo] = React.useState<{ at: string } | null>(null);
  const [importando, setImportando] = React.useState(false);
  const [previewDatos, setPreviewDatos] = React.useState<any>(null);
  const [densidad, setDensidad] = React.useState<Densidad>("espaciosa");
  const [nombreViaje, setNombreViaje] = React.useState(viaje.etiqueta);
  const [finViaje, setFinViaje] = React.useState(viaje.hasta ?? "");
  const [confirmarBorrado, setConfirmarBorrado] = React.useState(false);
  React.useEffect(() => {
    setDiasSinExportar(diasDesdeExportacion());
    const b = leerBackupLocal();
    setBackupInfo(b ? { at: b.at } : null);
  }, []);
  React.useEffect(() => {
    const guardada = window.localStorage.getItem("ritmo:densidad");
    const proxima: Densidad = guardada === "compacta" ? "compacta" : "espaciosa";
    setDensidad(proxima);
    document.documentElement.dataset.densidad = proxima;
  }, []);
  // g/kg por defecto según objetivo, para el placeholder del campo de proteína.
  const proteinaSugerida = String(form.objetivo === "perder" ? 2.0 : form.objetivo === "ganar" ? 1.8 : 1.6);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  function cambiarDensidad(proxima: Densidad) {
    setDensidad(proxima);
    window.localStorage.setItem("ritmo:densidad", proxima);
    document.documentElement.dataset.densidad = proxima;
  }

  if (cargando) return <div className="flex flex-col gap-6"><Skeleton className="h-8 w-40" /><Skeleton className="h-64 w-full rounded-xl" /></div>;

  async function guardarPerfil() {
    const edad = Number(form.edad);
    const altura = Number(form.alturaCm);
    const pesoObj = form.pesoObjetivo ? Number(form.pesoObjetivo) : undefined;
    const kcal = Number(form.kcalObjetivo);

    if (!edad || edad < 13 || edad > 120) {
      toast.error("Edad: entre 13 y 120 años");
      return;
    }
    if (!altura || altura < 100 || altura > 250) {
      toast.error("Altura: entre 100 y 250 cm");
      return;
    }
    if (pesoObj && (pesoObj < 30 || pesoObj > 300)) {
      toast.error("Peso objetivo: entre 30 y 300 kg");
      return;
    }
    if (!kcal || kcal < 800 || kcal > 5000) {
      toast.error("Calorías objetivo: entre 800 y 5000");
      return;
    }
    const proteina = form.proteinaObjetivo != null && String(form.proteinaObjetivo) !== "" ? Number(form.proteinaObjetivo) : undefined;
    if (proteina != null && (!Number.isFinite(proteina) || proteina < 0.5 || proteina > 4)) {
      toast.error("Proteína: entre 0,5 y 4 g/kg (o vacío para automático)");
      return;
    }

    await actualizarPerfil({
      nombre: form.nombre,
      sexo: form.sexo,
      edad,
      alturaCm: altura,
      objetivo: form.objetivo,
      pesoObjetivo: pesoObj,
      kcalObjetivo: kcal,
      proteinaObjetivo: proteina,
      factorActividad: Number(form.factorActividad),
    });
    toast.success("Perfil guardado");
  }

  function descargar() {
    const blob = new Blob([JSON.stringify(exportar(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ritmo-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    marcarExportacion();
    setDiasSinExportar(0);
  }

  function descargarCSV() {
    const dias = Object.values(estado.dias).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
    const cabecera = "fecha,peso,kcal_consumidas,kcal_quemadas,habitos_cumplidos,comidas";
    const filas = dias.map((d) => {
      const habs = Object.values(d.habitos || {}).filter(Boolean).length;
      const nComidas = d.comidas?.length ?? 0;
      return [d.fecha, d.peso ?? "", d.kcalConsumidas ?? "", d.kcalQuemadas ?? "", habs, nComidas].join(",");
    });
    const csv = [cabecera, ...filas].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ritmo-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    marcarExportacion();
    setDiasSinExportar(0);
  }

  async function restaurarCopiaLocal() {
    const b = leerBackupLocal();
    if (!b) {
      toast.error("No hay copia local guardada.");
      return;
    }
    setPreviewDatos(b.data);
  }

  async function subirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const datos = JSON.parse(await file.text());
      setPreviewDatos(datos);
    } catch {
      toast.error("Archivo no válido.");
    }
    e.target.value = "";
  }

  async function confirmarImportacion() {
    if (!previewDatos) return;
    setImportando(true);
    try {
      await importar(previewDatos);
      toast.success("Datos importados");
      setPreviewDatos(null);
    } catch (err) {
      toast.error("Error al importar");
    }
    setImportando(false);
  }

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-col gap-1 border-b border-border/70 pb-5"><h1 className="font-display text-2xl font-bold tracking-tight">Ajustes</h1><p className="text-sm text-muted-foreground">Perfil, preferencias, datos y cuenta en un único sistema ordenado.</p></header>

      {/* Datos que alimentan el modelo, separados para una lectura más clara. */}
      <section>
        <SectionLabel>Datos personales</SectionLabel>
        <SettingsCard>
          <SettingsSubhead title="Tu perfil" description="La base para calcular tus objetivos con precisión." />
          <Row label="Nombre" htmlFor="nombre">
            <Input id="nombre" value={form.nombre ?? ""} onChange={(e) => set("nombre", e.target.value)} className="h-11 w-full rounded-xl sm:w-56" />
          </Row>
          <Row label="Sexo biológico">
            <div className="flex gap-1.5">
              {(["hombre", "mujer"] as Sexo[]).map((s) => (
                <Pill key={s} activo={form.sexo === s} onClick={() => set("sexo", s)}>{s === "hombre" ? "Hombre" : "Mujer"}</Pill>
              ))}
            </div>
          </Row>
          <Row label="Edad" htmlFor="edad">
            <Input id="edad" inputMode="numeric" value={String(form.edad ?? "")} onChange={(e) => set("edad", Number(e.target.value) as never)} className="h-11 w-full rounded-xl tabular sm:w-28" />
          </Row>
          <Row label="Altura (cm)" htmlFor="altura">
            <Input id="altura" inputMode="numeric" value={String(form.alturaCm ?? "")} onChange={(e) => set("alturaCm", Number(e.target.value) as never)} className="h-11 w-full rounded-xl tabular sm:w-28" />
          </Row>
        </SettingsCard>
      </section>

      <section>
        <SectionLabel>Objetivo y nutrición</SectionLabel>
        <SettingsCard>
          <SettingsSubhead title="Tu estrategia" description="Las referencias con las que RITMO interpreta tu evolución." />
          <Row label="Objetivo principal">
            <div className="flex flex-wrap gap-1.5">
              {(["perder", "mantener", "ganar"] as Objetivo[]).map((o) => (
                <Pill key={o} activo={form.objetivo === o} onClick={() => set("objetivo", o)}>
                  {o === "perder" ? "Perder" : o === "mantener" ? "Mantener" : "Ganar"}
                </Pill>
              ))}
            </div>
          </Row>
          <Row label="Peso objetivo (kg)" htmlFor="pesoObjetivo">
            <Input id="pesoObjetivo" inputMode="decimal" value={String(form.pesoObjetivo ?? "")} onChange={(e) => set("pesoObjetivo", Number(e.target.value) as never)} className="h-11 w-full rounded-xl tabular sm:w-28" />
          </Row>
          <Row label="Calorías objetivo" htmlFor="kcalObjetivo">
            <Input id="kcalObjetivo" inputMode="numeric" value={String(form.kcalObjetivo ?? "")} onChange={(e) => set("kcalObjetivo", Number(e.target.value) as never)} className="h-11 w-full rounded-xl tabular sm:w-32" />
          </Row>
          <div>
            <Row label="Proteína (g/kg)" htmlFor="proteinaObjetivo">
              <Input
                id="proteinaObjetivo"
                inputMode="decimal"
                placeholder={proteinaSugerida}
                value={form.proteinaObjetivo != null ? String(form.proteinaObjetivo) : ""}
                onChange={(e) => set("proteinaObjetivo", (e.target.value === "" ? undefined : Number(e.target.value)) as never)}
                className="h-11 w-full rounded-xl tabular sm:w-28"
              />
            </Row>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Gramos de proteína por kg de peso. Vacío = automático ({proteinaSugerida} g/kg según tu objetivo).
            </p>
          </div>
          <div className="border-t border-border pt-4">
            <Label className="mb-2 block text-sm">Nivel de actividad</Label>
            <div className="flex flex-col gap-1.5">
              {FACTORES_ACTIVIDAD.map((f) => (
                <button
                  key={f.clave}
                  onClick={() => set("factorActividad", f.factor)}
                  className={cn("flex min-h-11 items-center justify-between gap-3 rounded-xl border px-3 text-left text-sm transition-colors", form.factorActividad === f.factor ? "border-primary bg-primary/8" : "border-border hover:bg-secondary/50")}
                >
                  <span className="font-medium">{f.etiqueta}</span>
                  <span className="text-xs text-muted-foreground">{f.detalle}</span>
                </button>
              ))}
            </div>
          </div>
          <Button onClick={guardarPerfil} className="mt-1 h-11 self-start rounded-xl px-5">Guardar cambios</Button>
        </SettingsCard>
      </section>

      {/* Reglas del modelo */}
      <section>
        <SectionLabel>Modelo y adherencia</SectionLabel>
        <SettingsCard>
          <SettingsSubhead title="Días sin hábitos" description="Cómo interpreta RITMO una jornada sin adherencia registrada." />
          <div className="rounded-xl border border-warning-border bg-warning-wash/65 p-3.5">
          <p className="text-sm font-semibold text-warning-ink">Superávit conservador</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Con cero hábitos en un día registrado, RITMO aplica un superávit estimado de {p.imputarSuperavitKcal ?? 500} kcal. Así un día sin adherencia nunca se interpreta como déficit.
          </p>
          </div>
          <div className="border-t border-border pt-4"><Row label="Contar días totalmente vacíos">
            <Switch checked={form.imputarActiva !== false} onCheckedChange={(v) => { set("imputarActiva", v); actualizarPerfil({ imputarActiva: v }); }} aria-label="Contar días totalmente vacíos" />
          </Row><p className="mt-1.5 text-xs text-muted-foreground">También aplica ese superávit a huecos sin ningún dato desde la fecha de corte configurada.</p></div>
        </SettingsCard>
      </section>

      <section>
        <SectionLabel>Contexto y viaje</SectionLabel>
        <SettingsCard>
          <SettingsSubhead title="Modo viaje / vacaciones" description="Un contexto visual para interpretar tus días sin alterar kcal, hábitos ni predicciones." />
          <Row label="Estado actual">
            <div className="flex items-center gap-2"><span className={cn("inline-flex h-9 items-center rounded-xl px-3 text-xs font-semibold", viaje.activo ? "bg-habit-wash text-habit-ink" : "bg-secondary text-muted-foreground")}>{viaje.activo ? viaje.etiqueta : "Sin viaje activo"}</span>{viaje.activo && <Button variant="secondary" size="sm" className="h-9 rounded-xl" onClick={() => guardarModoViaje({ ...viaje, activo: false })}>Finalizar</Button>}</div>
          </Row>
          {!viaje.activo && <div className="grid gap-2 border-t border-border pt-4 sm:grid-cols-[minmax(0,1fr)_11rem_auto]"><Input value={nombreViaje} onChange={(e) => setNombreViaje(e.target.value)} placeholder="Viaje a Lisboa" className="h-11 rounded-xl" /><Input type="date" value={finViaje} onChange={(e) => setFinViaje(e.target.value)} className="h-11 rounded-xl" /><Button className="h-11 rounded-xl px-4" onClick={() => guardarModoViaje({ activo: true, etiqueta: nombreViaje.trim() || "Viaje", desde: new Date().toISOString().slice(0, 10), hasta: finViaje || undefined })}><Plane className="size-4" /> Activar</Button></div>}
        </SettingsCard>
      </section>

      {/* Preferencias de uso */}
      <section>
        <SectionLabel>Experiencia</SectionLabel>
        <SettingsCard>
          <SettingsSubhead title="Apariencia" description="Elige el modo de color que mejor encaja con tu entorno." />
          <div className="flex gap-2">
            {([["light", "Claro", Sun], ["dark", "Oscuro", Moon], ["system", "Sistema", Monitor]] as const).map(([val, label, Icon]) => (
              <button
                key={val}
                onClick={() => setTheme(val)}
                className={cn("flex min-h-20 flex-1 flex-col items-center justify-center gap-1.5 rounded-xl border py-3 text-sm transition-colors", theme === val ? "border-primary bg-primary/8 text-foreground shadow-sm" : "border-border text-muted-foreground hover:bg-secondary/50")}
              >
                <Icon className="size-5" />
                {label}
              </button>
            ))}
          </div>
          <div className="border-t border-border pt-5">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div><p className="text-sm font-semibold">Densidad visual</p><p className="mt-0.5 text-xs text-muted-foreground">Ajusta el espacio entre secciones y el aire de lectura.</p></div>
              <span className="text-xs font-medium text-primary">{densidad === "compacta" ? "Compacta" : "Espaciosa"}</span>
            </div>
            <div className="mt-3 inline-flex rounded-xl bg-secondary p-1" role="group" aria-label="Densidad visual">
              {(["compacta", "espaciosa"] as const).map((opcion) => <button key={opcion} type="button" onClick={() => cambiarDensidad(opcion)} aria-pressed={densidad === opcion} className={cn("h-9 rounded-xl px-4 text-sm font-medium transition-colors", densidad === opcion ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{opcion === "compacta" ? "Compacta" : "Espaciosa"}</button>)}
            </div>
          </div>
        </SettingsCard>
      </section>

      {/* Respaldo y portabilidad */}
      <section>
        <SectionLabel>Datos y respaldo</SectionLabel>
        <SettingsCard className="gap-3.5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-sm font-semibold">Tu historial, siempre contigo</p><p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">Exporta, importa o recupera una copia sin salir de tu espacio.</p></div>
            <div className="grid grid-cols-3 gap-1.5 sm:flex sm:shrink-0">
              <Button variant="secondary" onClick={descargar} className="h-10 rounded-xl gap-1.5 px-2.5 text-xs sm:px-3 sm:text-sm"><Download className="size-4" /> JSON</Button>
              <Button variant="secondary" onClick={descargarCSV} className="h-10 rounded-xl gap-1.5 px-2.5 text-xs sm:px-3 sm:text-sm"><FileSpreadsheet className="size-4" /> CSV</Button>
              <Button variant="secondary" onClick={() => fileRef.current?.click()} className="h-10 rounded-xl gap-1.5 px-2.5 text-xs sm:px-3 sm:text-sm"><Upload className="size-4" /> Importar</Button>
            </div>
          </div>
          {/* Aviso si hace mucho de la última exportación manual */}
          {diasSinExportar != null && diasSinExportar >= 14 && (
            <div className="flex items-start gap-2.5 rounded-xl bg-warning-wash px-3 py-2.5 text-xs text-warning-ink">
              <ShieldCheck className="size-4 shrink-0" />
              <span>Hace <span className="font-semibold">{diasSinExportar} días</span> que no exportas una copia. Descarga un respaldo para tenerlo a salvo fuera de la nube.</span>
            </div>
          )}
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={subirArchivo} />

          {/* Copia de seguridad local automática */}
          <div className="flex flex-col gap-2.5 rounded-xl border border-border/70 bg-secondary/35 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
              <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-card text-weight shadow-sm"><HistoryIcon className="size-3.5" /></span>
              <span>{backupInfo ? <>Copia local guardada · {fmtFechaCorta(backupInfo.at.slice(0, 10))}</> : "Aún no hay copia local automática."}</span>
            </div>
            {backupInfo && (
              <Button variant="ghost" size="sm" onClick={restaurarCopiaLocal} className="h-8 w-full rounded-lg gap-2 text-xs sm:w-auto">
                <HistoryIcon className="size-3.5" /> Restaurar copia local
              </Button>
            )}
          </div>
        </SettingsCard>
      </section>

      {/* Diálogo de confirmación de importación */}
      {previewDatos && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
          <Card className="w-full max-w-sm rounded-t-2xl border-t p-5 sm:rounded-2xl">
            <div className="mb-4">
              <h2 className="font-display text-lg font-bold">Confirmar importación</h2>
              <p className="mt-1 text-sm text-muted-foreground">Se fusionarán los datos del archivo con tu cuenta.</p>
            </div>
            <div className="mb-5 space-y-2 rounded-lg bg-secondary/50 p-3 text-xs">
              {previewDatos.perfil?.nombre && <div>👤 {previewDatos.perfil.nombre}</div>}
              {previewDatos.dias && <div>📅 {Object.keys(previewDatos.dias || {}).length} días</div>}
              {previewDatos.cuerpo && Object.keys(previewDatos.cuerpo || {}).length > 0 && <div>📏 Mediciones de cuerpo</div>}
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => setPreviewDatos(null)}
                disabled={importando}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={confirmarImportacion}
                disabled={importando}
                className="flex-1"
              >
                {importando ? "Importando..." : "Importar"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      <section>
        <SectionLabel>Privacidad</SectionLabel>
        <SettingsCard className="gap-3.5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-sm font-semibold">Tus datos siguen siendo tuyos</p><p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">Gemini solo recibe una comida cuando eliges analizarla.</p></div>
            <Button variant="secondary" onClick={() => { limpiarDatosLocales(); limpiarPreferenciasComidas(); toast.success("Datos locales eliminados"); }} className="h-10 w-full rounded-xl gap-2 sm:w-auto"><Trash2 className="size-4" /> Limpiar este dispositivo</Button>
          </div>
          {confirmarBorrado ? <div className="flex flex-col gap-3 rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs leading-relaxed text-destructive">Borra perfil, días, comidas y mediciones de la nube. Tu acceso seguirá existiendo.</p><div className="flex shrink-0 gap-1.5"><Button variant="ghost" size="sm" className="h-8 rounded-lg" onClick={() => setConfirmarBorrado(false)}>Cancelar</Button><Button variant="destructive" size="sm" className="h-8 rounded-lg" onClick={() => void borrarDatos().then(() => { limpiarDatosLocales(); limpiarPreferenciasComidas(); toast.success("Datos de RITMO eliminados"); }).catch(() => toast.error("No se pudieron eliminar los datos."))}>Eliminar</Button></div></div> : <button type="button" onClick={() => setConfirmarBorrado(true)} className="self-start text-xs font-medium text-destructive transition-opacity hover:opacity-75">Eliminar todos mis datos de RITMO…</button>}
        </SettingsCard>
      </section>

      {/* Cuenta */}
      <section>
        <SectionLabel>Cuenta</SectionLabel>
        <SettingsCard className="gap-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><UserRound className="size-4" /></span><div className="min-w-0"><p className="truncate text-sm font-semibold">{userEmail ?? "Modo demo (local)"}</p><p className="mt-0.5 text-xs text-muted-foreground">{modo === "nube" ? "Cuenta sincronizada" : "Datos solo en este dispositivo"}</p></div></div>
            <Button variant="ghost" onClick={() => void cerrarSesion()} className="h-10 w-full rounded-xl gap-2 text-muted-foreground hover:text-destructive sm:w-auto"><LogOut className="size-4" /> {modo === "nube" ? "Cerrar sesión" : "Salir"}</Button>
          </div>
        </SettingsCard>
      </section>
    </div>
  );
}

function Row({ label, children, htmlFor }: { label: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className="grid gap-2 border-b border-border/70 pb-4 last:border-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_minmax(13rem,22rem)] sm:items-center sm:gap-8">
      <Label htmlFor={htmlFor} className="text-sm font-medium">{label}</Label>
      <div className="flex w-full justify-start sm:justify-end">{children}</div>
    </div>
  );
}

function Pill({ children, activo, onClick }: { children: React.ReactNode; activo: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn("h-10 rounded-xl border px-3 text-sm font-medium transition-colors", activo ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary/50")}
    >
      {children}
    </button>
  );
}

function SettingsCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <Card className={cn("flex flex-col gap-5 rounded-2xl border-border/80 p-4 shadow-sm sm:p-5", className)}>{children}</Card>;
}

function SettingsSubhead({ title, description, className }: { title: string; description: string; className?: string }) {
  return <div className={cn("border-b border-border/70 pb-3", className)}><p className="text-sm font-semibold">{title}</p><p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p></div>;
}
