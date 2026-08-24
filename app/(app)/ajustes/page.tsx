"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Download, LogOut, Monitor, Moon, Sun, Upload } from "lucide-react";
import { useRitmo } from "@/lib/store/provider";
import { FACTORES_ACTIVIDAD } from "@/lib/model/metrics";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionLabel } from "@/components/app/primitives";
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
    await actualizarPerfil({
      nombre: form.nombre,
      sexo: form.sexo,
      edad: Number(form.edad),
      alturaCm: Number(form.alturaCm),
      objetivo: form.objetivo,
      pesoObjetivo: form.pesoObjetivo ? Number(form.pesoObjetivo) : undefined,
      kcalObjetivo: Number(form.kcalObjetivo),
      aguaObjetivoMl: form.aguaObjetivoMl ? Number(form.aguaObjetivoMl) : undefined,
      pasosObjetivo: form.pasosObjetivo ? Number(form.pasosObjetivo) : undefined,
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
  }

  async function subir(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const datos = JSON.parse(await file.text());
      await importar(datos);
    } catch {
      toast.error("Archivo no válido.");
    }
    e.target.value = "";
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-bold tracking-tight">Ajustes</h1>

      {/* Perfil */}
      <section>
        <SectionLabel>Perfil</SectionLabel>
        <Card className="flex flex-col gap-4 p-5">
          <Row label="Nombre">
            <Input value={form.nombre ?? ""} onChange={(e) => set("nombre", e.target.value)} className="max-w-48" />
          </Row>
          <Row label="Sexo biológico">
            <div className="flex gap-1.5">
              {(["hombre", "mujer"] as Sexo[]).map((s) => (
                <Pill key={s} activo={form.sexo === s} onClick={() => set("sexo", s)}>{s === "hombre" ? "Hombre" : "Mujer"}</Pill>
              ))}
            </div>
          </Row>
          <Row label="Edad">
            <Input inputMode="numeric" value={String(form.edad ?? "")} onChange={(e) => set("edad", Number(e.target.value) as never)} className="max-w-24 tabular" />
          </Row>
          <Row label="Altura (cm)">
            <Input inputMode="numeric" value={String(form.alturaCm ?? "")} onChange={(e) => set("alturaCm", Number(e.target.value) as never)} className="max-w-24 tabular" />
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
          <Row label="Peso objetivo (kg)">
            <Input inputMode="decimal" value={String(form.pesoObjetivo ?? "")} onChange={(e) => set("pesoObjetivo", Number(e.target.value) as never)} className="max-w-24 tabular" />
          </Row>
          <Row label="Calorías objetivo">
            <Input inputMode="numeric" value={String(form.kcalObjetivo ?? "")} onChange={(e) => set("kcalObjetivo", Number(e.target.value) as never)} className="max-w-28 tabular" />
          </Row>
          <Row label="Agua objetivo (ml)">
            <Input inputMode="numeric" value={String(form.aguaObjetivoMl ?? "")} onChange={(e) => set("aguaObjetivoMl", Number(e.target.value) as never)} className="max-w-28 tabular" />
          </Row>
          <Row label="Pasos objetivo">
            <Input inputMode="numeric" value={String(form.pasosObjetivo ?? "")} onChange={(e) => set("pasosObjetivo", Number(e.target.value) as never)} className="max-w-28 tabular" />
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
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={descargar} className="gap-2"><Download className="size-4" /> Exportar JSON</Button>
            <Button variant="secondary" onClick={() => fileRef.current?.click()} className="gap-2"><Upload className="size-4" /> Importar</Button>
            <input ref={fileRef} type="file" accept="application/json" hidden onChange={subir} />
          </div>
          <p className="text-xs text-muted-foreground">La exportación incluye tu perfil, todos los días y las mediciones. La importación fusiona sin borrar lo que el archivo no contenga.</p>
        </Card>
      </section>

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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  );
}

function Pill({ children, activo, onClick }: { children: React.ReactNode; activo: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn("rounded-full border px-3 py-1 text-sm transition-colors", activo ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground")}
    >
      {children}
    </button>
  );
}
