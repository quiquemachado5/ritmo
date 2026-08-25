"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Download, FileSpreadsheet, HistoryIcon, LogOut, Monitor, Moon, ShieldCheck, Sun, Upload } from "lucide-react";
import { useRitmo } from "@/lib/store/provider";
import { FACTORES_ACTIVIDAD } from "@/lib/model/metrics";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionLabel } from "@/components/app/primitives";
import { marcarExportacion, diasDesdeExportacion, leerBackupLocal } from "@/lib/backup";
import { fmtFechaCorta } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Objetivo, Sexo } from "@/lib/model/types";

export default function AjustesPage() {
  const { estado, cargando, modo, userEmail, actualizarPerfil, exportar, importar, cerrarSesion } = useRitmo();
  const { theme, setTheme } = useTheme();
  const fileRef = React.useRef<HTMLInputElement>(null);

  const p = estado.perfil;
  const [form, setForm] = React.useState(p);
  React.useEffect(() => setForm(p), [p]);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

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

    await actualizarPerfil({
      nombre: form.nombre,
      sexo: form.sexo,
      edad,
      alturaCm: altura,
      objetivo: form.objetivo,
      pesoObjetivo: pesoObj,
      kcalObjetivo: kcal,
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

  const [diasSinExportar, setDiasSinExportar] = React.useState<number | null>(null);
  const [backupInfo, setBackupInfo] = React.useState<{ at: string } | null>(null);
  React.useEffect(() => {
    setDiasSinExportar(diasDesdeExportacion());
    const b = leerBackupLocal();
    setBackupInfo(b ? { at: b.at } : null);
  }, []);

  async function restaurarCopiaLocal() {
    const b = leerBackupLocal();
    if (!b) {
      toast.error("No hay copia local guardada.");
      return;
    }
    setPreviewDatos(b.data);
  }

  const [importando, setImportando] = React.useState(false);
  const [previewDatos, setPreviewDatos] = React.useState<any>(null);

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
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-bold tracking-tight">Ajustes</h1>

      {/* Perfil */}
      <section>
        <SectionLabel>Perfil</SectionLabel>
        <Card className="flex flex-col gap-4 p-5">
          <Row label="Nombre" htmlFor="nombre">
            <Input id="nombre" value={form.nombre ?? ""} onChange={(e) => set("nombre", e.target.value)} className="max-w-48 h-11" />
          </Row>
          <Row label="Sexo biológico">
            <div className="flex gap-1.5">
              {(["hombre", "mujer"] as Sexo[]).map((s) => (
                <Pill key={s} activo={form.sexo === s} onClick={() => set("sexo", s)}>{s === "hombre" ? "Hombre" : "Mujer"}</Pill>
              ))}
            </div>
          </Row>
          <Row label="Edad" htmlFor="edad">
            <Input id="edad" inputMode="numeric" value={String(form.edad ?? "")} onChange={(e) => set("edad", Number(e.target.value) as never)} className="max-w-24 tabular h-11" />
          </Row>
          <Row label="Altura (cm)" htmlFor="altura">
            <Input id="altura" inputMode="numeric" value={String(form.alturaCm ?? "")} onChange={(e) => set("alturaCm", Number(e.target.value) as never)} className="max-w-24 tabular h-11" />
          </Row>
        </Card>
      </section>

      {/* Objetivos */}
      <section>
        <SectionLabel>Objetivos</SectionLabel>
        <Card className="flex flex-col gap-4 p-5">
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
            <Input id="pesoObjetivo" inputMode="decimal" value={String(form.pesoObjetivo ?? "")} onChange={(e) => set("pesoObjetivo", Number(e.target.value) as never)} className="max-w-24 tabular h-11" />
          </Row>
          <Row label="Calorías objetivo" htmlFor="kcalObjetivo">
            <Input id="kcalObjetivo" inputMode="numeric" value={String(form.kcalObjetivo ?? "")} onChange={(e) => set("kcalObjetivo", Number(e.target.value) as never)} className="max-w-28 tabular h-11" />
          </Row>
          <div>
            <Label className="mb-2 block">Nivel de actividad</Label>
            <div className="flex flex-col gap-1.5">
              {FACTORES_ACTIVIDAD.map((f) => (
                <button
                  key={f.clave}
                  onClick={() => set("factorActividad", f.factor)}
                  className={cn("flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm", form.factorActividad === f.factor ? "border-primary bg-primary/8" : "border-border")}
                >
                  <span className="font-medium">{f.etiqueta}</span>
                  <span className="text-xs text-muted-foreground">{f.detalle}</span>
                </button>
              ))}
            </div>
          </div>
          <Button onClick={guardarPerfil} className="mt-1 self-start">Guardar cambios</Button>
        </Card>
      </section>

      {/* Días sin registro */}
      <section>
        <SectionLabel>Días sin registro</SectionLabel>
        <Card className="flex flex-col gap-4 p-5">
          <Row label="Contar huecos como días malos">
            <Switch
              checked={form.imputarActiva !== false}
              onCheckedChange={(v) => { set("imputarActiva", v); actualizarPerfil({ imputarActiva: v }); }}
              aria-label="Contar huecos como días malos"
            />
          </Row>
          <p className="text-xs text-muted-foreground">
            Cuando está activo, un día sin registrar a partir de la fecha de corte se cuenta como un pequeño superávit ({p.imputarSuperavitKcal ?? 500} kcal), en lugar de ignorarse. Ensancha el rango de la predicción.
          </p>
        </Card>
      </section>

      {/* Apariencia */}
      <section>
        <SectionLabel>Apariencia</SectionLabel>
        <Card className="p-5">
          <div className="flex gap-2">
            {([["light", "Claro", Sun], ["dark", "Oscuro", Moon], ["system", "Sistema", Monitor]] as const).map(([val, label, Icon]) => (
              <button
                key={val}
                onClick={() => setTheme(val)}
                className={cn("flex flex-1 flex-col items-center gap-1.5 rounded-xl border py-3 text-sm", theme === val ? "border-primary bg-primary/8 text-foreground" : "border-border text-muted-foreground")}
              >
                <Icon className="size-5" />
                {label}
              </button>
            ))}
          </div>
        </Card>
      </section>

      {/* Datos */}
      <section>
        <SectionLabel>Datos</SectionLabel>
        <Card className="flex flex-col gap-3 p-5">
          {/* Aviso si hace mucho de la última exportación manual */}
          {diasSinExportar != null && diasSinExportar >= 14 && (
            <div className="flex items-start gap-2.5 rounded-lg bg-warning-wash px-3 py-2.5 text-xs text-warning-ink">
              <ShieldCheck className="size-4 shrink-0" />
              <span>Hace <span className="font-semibold">{diasSinExportar} días</span> que no exportas una copia. Descarga un respaldo para tenerlo a salvo fuera de la nube.</span>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={descargar} className="gap-2"><Download className="size-4" /> Exportar JSON</Button>
            <Button variant="secondary" onClick={descargarCSV} className="gap-2"><FileSpreadsheet className="size-4" /> Exportar CSV</Button>
            <Button variant="secondary" onClick={() => fileRef.current?.click()} className="gap-2"><Upload className="size-4" /> Importar</Button>
            <input ref={fileRef} type="file" accept="application/json" hidden onChange={subirArchivo} />
          </div>
          <p className="text-xs text-muted-foreground">La exportación incluye tu perfil, todos los días y las mediciones. La importación fusiona sin borrar lo que el archivo no contenga.</p>

          {/* Copia de seguridad local automática */}
          <div className="mt-1 flex flex-col gap-2 border-t border-border pt-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <HistoryIcon className="size-4 shrink-0 text-weight" />
              {backupInfo
                ? <span>Copia local automática guardada · {fmtFechaCorta(backupInfo.at.slice(0, 10))}</span>
                : <span>Aún no hay copia local automática.</span>}
            </div>
            {backupInfo && (
              <Button variant="ghost" size="sm" onClick={restaurarCopiaLocal} className="w-fit gap-2 text-xs">
                <HistoryIcon className="size-3.5" /> Restaurar copia local
              </Button>
            )}
            <p className="text-[0.7rem] text-muted-foreground/80">
              RITMO guarda automáticamente una copia en este dispositivo cada vez que cambian tus datos. Es tu red de seguridad si la nube fallara.
            </p>
          </div>
        </Card>
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

      {/* Cuenta */}
      <section>
        <SectionLabel>Cuenta</SectionLabel>
        <Card className="flex items-center justify-between p-5">
          <div>
            <p className="text-sm font-medium">{userEmail ?? "Modo demo (local)"}</p>
            <p className="text-xs text-muted-foreground">{modo === "nube" ? "Sincronizado con la nube" : "Datos en este dispositivo"}</p>
          </div>
          <Button variant="ghost" onClick={() => void cerrarSesion()} className="gap-2 text-muted-foreground hover:text-destructive">
            <LogOut className="size-4" /> {modo === "nube" ? "Cerrar sesión" : "Salir"}
          </Button>
        </Card>
      </section>
    </div>
  );
}

function Row({ label, children, htmlFor }: { label: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <Label htmlFor={htmlFor} className="text-sm">{label}</Label>
      {children}
    </div>
  );
}

function Pill({ children, activo, onClick }: { children: React.ReactNode; activo: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn("h-11 rounded-full border px-3 text-sm font-medium transition-colors", activo ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground")}
    >
      {children}
    </button>
  );
}
