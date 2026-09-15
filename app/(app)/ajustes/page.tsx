"use client";

import * as React from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Download, FileSpreadsheet, HistoryIcon, ListChecks, LogOut, Monitor, Moon, Palette, Plane, Shield, ShieldCheck, Sun, Trash2, Upload, UserRound } from "lucide-react";
import { useRitmo } from "@/lib/store/provider";
import { FACTORES_ACTIVIDAD } from "@/lib/model/metrics";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { PageHeader, SectionLabel } from "@/components/app/primitives";
import { ejecutarSimulacroRestauracion, limpiarDatosLocales, marcarExportacion, diasDesdeExportacion, leerBackupLocal, leerSimulacroRestauracion, type RestoreDrillResult } from "@/lib/backup";
import { limpiarPreferenciasComidas } from "@/lib/meal-prefs";
import { fmtFechaCorta } from "@/lib/format";
import { hoy } from "@/lib/model/dates";
import { cn, uid } from "@/lib/utils";
import type { Objetivo, Sexo, Perfil } from "@/lib/model/types";
import { guardarModoViaje, useModoViaje } from "@/lib/travel-mode";
import { analizarImportacion, type ArchivoRitmo, type ResumenImportacion } from "@/lib/store/import";
import { HABITOS, habitosModelo, habitosUsuario } from "@/lib/model/config";
import { erroresPerfil } from "@/lib/profile-validation";
import { diagnosticoCompartido, permitirDiagnostico } from "@/lib/observability";
import { EXTERNAL_NUTRITION_ENABLED } from "@/lib/nutrition/policy";
import { ProfessionalReport } from "@/components/app/professional-report";
import { AccountHealth, PrivacyMap } from "@/components/app/account-health";
import { guardarExperimentos, useExperimentos } from "@/lib/experiments";
import { SyncCenter } from "@/components/app/sync-center";
import { DataHealthCenter } from "@/components/app/data-health-center";
import { usePlatformConfig } from "@/components/app/platform-provider";
import type { ProgresoImportacion } from "@/lib/store/types";

type Densidad = "automatica" | "compacta" | "espaciosa";
type PanelAjustes = "personal" | "rutina" | "experiencia" | "datos";
const PANELES_AJUSTES = [
  { id: "personal", etiqueta: "Perfil y objetivo", detalle: "Datos personales y estrategia", icono: UserRound },
  { id: "rutina", etiqueta: "Rutina y modelo", detalle: "Hábitos, reglas y viajes", icono: ListChecks },
  { id: "experiencia", etiqueta: "Experiencia", detalle: "Apariencia y estado", icono: Palette },
  { id: "datos", etiqueta: "Datos y cuenta", detalle: "Copias, privacidad y acceso", icono: Shield },
] as const;
const CAMPOS_NUMERICOS = ["edad", "alturaCm", "pesoObjetivo", "kcalObjetivo", "proteinaObjetivo"] as const;
type CampoNumerico = typeof CAMPOS_NUMERICOS[number];
function numerosDelPerfil(perfil: Perfil): Record<CampoNumerico, string> {
  return Object.fromEntries(CAMPOS_NUMERICOS.map(campo => [campo, perfil[campo] == null ? "" : String(perfil[campo])])) as Record<CampoNumerico, string>;
}

export default function AjustesPage() {
  const { estado, cargando, modo, userId, userEmail, actualizarPerfil, exportar, importar, cerrarSesion, borrarDatos } = useRitmo();
  const { theme, setTheme } = useTheme();
  const { features } = usePlatformConfig();
  const viaje = useModoViaje(userId);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const focoImportacionRef = React.useRef<HTMLButtonElement | null>(null);
  const barraGuardarRef = React.useRef<HTMLDivElement>(null);
  const [barraGuardarFija, setBarraGuardarFija] = React.useState(true);
  React.useEffect(() => {
    const barra = barraGuardarRef.current;
    if (!barra) return;
    const viewport = window.visualViewport;
    let frame = 0;
    const medir = () => {
      const disponible = viewport?.height ?? window.innerHeight;
      // Con texto ampliado o teclado abierto, una barra alta debe fluir con
      // la página, no tapar el formulario. Los botones siempre permanecen.
      const cabe = barra.getBoundingClientRect().height <= disponible * 0.28;
      setBarraGuardarFija(anterior => anterior === cabe ? anterior : cabe);
    };
    const programar = () => { window.cancelAnimationFrame(frame); frame = window.requestAnimationFrame(medir); };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(programar);
    observer?.observe(barra);
    window.addEventListener("resize", programar);
    viewport?.addEventListener("resize", programar);
    programar();
    return () => {
      window.cancelAnimationFrame(frame); observer?.disconnect();
      window.removeEventListener("resize", programar);
      viewport?.removeEventListener("resize", programar);
    };
  }, [cargando]);

  const p = estado.perfil;
  const [form, setForm] = React.useState(p);
  const [numeros, setNumeros] = React.useState(() => numerosDelPerfil(p));
  const [mostrarErrores, setMostrarErrores] = React.useState(false);
  const [guardandoPerfil, setGuardandoPerfil] = React.useState(false);
  const [errorGuardado, setErrorGuardado] = React.useState<string | null>(null);
  const dirty = React.useRef(false);
  const cuentaForm = React.useRef(userId);
  const secuenciaGuardado = React.useRef(0);
  const guardadoEnCurso = React.useRef<number | null>(null);
  const generacionCuenta = React.useRef(0);
  // El perfil llega de una fuente externa asíncrona y debe rehidratar el borrador.
  React.useEffect(() => {
    if (cuentaForm.current !== userId) {
      dirty.current = false; cuentaForm.current = userId; generacionCuenta.current += 1;
      guardadoEnCurso.current = null; setGuardandoPerfil(false); setMostrarErrores(false); setErrorGuardado(null);
    }
    if (!dirty.current) { setForm(p); setNumeros(numerosDelPerfil(p)); }
  }, [p, userId]);
  React.useEffect(() => () => { guardadoEnCurso.current = null; generacionCuenta.current += 1; }, []);
  // Todos los hooks van ANTES de cualquier return: las reglas de hooks exigen
  // el mismo número y orden en cada render (cargando vs cargado incluido).
  const [diasSinExportar, setDiasSinExportar] = React.useState<number | null>(null);
  const [backupInfo, setBackupInfo] = React.useState<{ at: string } | null>(null);
  const [simulacroInfo, setSimulacroInfo] = React.useState<RestoreDrillResult | null>(null);
  const [probandoCopia, setProbandoCopia] = React.useState(false);
  const [importando, setImportando] = React.useState(false);
  const [progresoImportacion, setProgresoImportacion] = React.useState<ProgresoImportacion | null>(null);
  const importacionEnCurso = React.useRef(false);
  const [previewDatos, setPreviewDatos] = React.useState<ArchivoRitmo | null>(null);
  const [resumenImportacion, setResumenImportacion] = React.useState<ResumenImportacion | null>(null);
  const [densidad, setDensidad] = React.useState<Densidad>("automatica");
  const [nombreViaje, setNombreViaje] = React.useState(viaje.etiqueta);
  const [finViaje, setFinViaje] = React.useState(viaje.hasta ?? "");
  const [confirmarBorrado, setConfirmarBorrado] = React.useState(false);
  const [borrandoDatos, setBorrandoDatos] = React.useState(false);
  const borradoEnCurso = React.useRef(false);
  const [nuevoHabito, setNuevoHabito] = React.useState("");
  const [panel, setPanel] = React.useState<PanelAjustes>("personal");
  const [diagnostico, setDiagnostico] = React.useState(() => diagnosticoCompartido(userId));
  const preferenciasExperimentos = useExperimentos(userId);
  React.useEffect(() => {
    // Ningún borrador, confirmación ni archivo de la cuenta anterior cruza a la nueva.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreviewDatos(null); setResumenImportacion(null); setImportando(false); setProgresoImportacion(null);
    importacionEnCurso.current = false; borradoEnCurso.current = false;
    setConfirmarBorrado(false); setBorrandoDatos(false); setNuevoHabito("");
  }, [userId]);
  React.useEffect(() => {
    // Rehidrata el contexto externo de viaje de la identidad actual.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNombreViaje(viaje.etiqueta); setFinViaje(viaje.hasta ?? "");
  }, [userId, viaje.etiqueta, viaje.hasta]);
  React.useEffect(() => {
    // Preferencia externa y privada de la identidad recién cargada.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDiagnostico(diagnosticoCompartido(userId));
  }, [userId]);
  React.useEffect(() => {
    // Datos externos del almacenamiento local, aislados por la identidad activa.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDiasSinExportar(diasDesdeExportacion(userId));
    const b = leerBackupLocal(userId);
    setBackupInfo(b ? { at: b.at } : null);
    setSimulacroInfo(leerSimulacroRestauracion(userId));
    const actualizar = (event: Event) => {
      if ((event as CustomEvent<string>).detail === userId) setSimulacroInfo(leerSimulacroRestauracion(userId));
    };
    window.addEventListener("ritmo:backup-drill", actualizar);
    return () => window.removeEventListener("ritmo:backup-drill", actualizar);
  }, [userId]);
  React.useEffect(() => {
    let guardada: string | null = null;
    try { guardada = window.localStorage.getItem("ritmo:densidad"); } catch { /* La preferencia es opcional si el navegador bloquea el almacenamiento. */ }
    const proxima: Densidad = guardada === "compacta" || guardada === "espaciosa" ? guardada : "automatica";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDensidad(proxima);
    document.documentElement.setAttribute("data-densidad", proxima);
  }, []);
  React.useEffect(() => {
    const solicitado = new URLSearchParams(window.location.search).get("panel");
    // El panel de un enlace profundo solo existe en el navegador.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (PANELES_AJUSTES.some((item) => item.id === solicitado)) setPanel(solicitado as PanelAjustes);
  }, []);
  // g/kg por defecto según objetivo, para el placeholder del campo de proteína.
  const proteinaSugerida = String(form.objetivo === "perder" ? 2.0 : form.objetivo === "ganar" ? 1.8 : 1.6);
  // Una escritura parcial (perfil enviado, preferencias locales fallidas)
  // también debe poder reintentarse aunque la vista optimista ya coincida.
  const perfilPendiente = JSON.stringify(form) !== JSON.stringify(p) || Boolean(errorGuardado);
  const errores = mostrarErrores ? erroresPerfil(form) : {};
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => { dirty.current = true; setErrorGuardado(null); setForm((f) => ({ ...f, [k]: v })); };
  const setNumero = (campo: CampoNumerico, texto: string) => {
    setNumeros(anterior => ({ ...anterior, [campo]: texto }));
    const opcional = campo === "pesoObjetivo" || campo === "proteinaObjetivo";
    set(campo, (texto.trim() === "" ? (opcional ? undefined : NaN) : Number(texto.replace(",", "."))) as never);
  };
  function descartarPerfil() {
    dirty.current = false;
    setForm(p); setNumeros(numerosDelPerfil(p)); setMostrarErrores(false); setNuevoHabito(""); setErrorGuardado(null);
  }
  React.useEffect(() => {
    if (!perfilPendiente) return;
    const salir = (event: BeforeUnloadEvent) => { if (!dirty.current) return; event.preventDefault(); event.returnValue = ""; };
    const navegar = (event: MouseEvent) => {
      if (!dirty.current || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const enlace = event.target instanceof Element ? event.target.closest("a[href]") as HTMLAnchorElement | null : null;
      if (!enlace || enlace.download || (enlace.target && enlace.target !== "_self")) return;
      const destino = new URL(enlace.href, window.location.href);
      if (destino.origin === window.location.origin && destino.pathname === window.location.pathname && destino.search === window.location.search) return;
      if (!window.confirm("Tienes cambios de perfil sin guardar. ¿Quieres salir y descartarlos?")) { event.preventDefault(); event.stopImmediatePropagation(); }
      else dirty.current = false; // El permiso de descartar evita una segunda confirmación en beforeunload.
    };
    window.addEventListener("beforeunload", salir);
    document.addEventListener("click", navegar, true);
    return () => { window.removeEventListener("beforeunload", salir); document.removeEventListener("click", navegar, true); };
  }, [perfilPendiente]);

  function cambiarDensidad(proxima: Densidad) {
    setDensidad(proxima);
    document.documentElement.setAttribute("data-densidad", proxima);
    try { window.localStorage.setItem("ritmo:densidad", proxima); }
    catch { toast.error("La apariencia se ha aplicado, pero este navegador no permite guardar la preferencia."); }
  }

  function anadirHabitoPersonal() {
    const etiqueta = nuevoHabito.trim().slice(0, 28);
    if (!etiqueta) return;
    const actuales = form.habitosPersonalizados || [];
    if (actuales.some((h) => h.etiqueta.toLocaleLowerCase("es-ES") === etiqueta.toLocaleLowerCase("es-ES"))) { toast.error("Ese hábito ya existe."); return; }
    const siguiente = [...actuales, { clave: `personal-${uid()}`, etiqueta, codigo: etiqueta.slice(0, 3).toUpperCase(), icono: "Check" }];
    set("habitosPersonalizados", siguiente as never); setNuevoHabito("");
  }

  function quitarHabitoPersonal(clave: string) {
    if (!(form.habitosDesactivados || []).includes(clave) && habitosModelo(form).length <= 1) {
      toast.error("Mantén al menos un hábito activo antes de eliminar este.");
      return;
    }
    const siguiente = (form.habitosPersonalizados || []).filter((h) => h.clave !== clave);
    set("habitosPersonalizados", siguiente as never);
    set("habitosDesactivados", (form.habitosDesactivados || []).filter(id => id !== clave));
  }

  function alternarHabitoModelo(clave: string) {
    const actuales = new Set(form.habitosDesactivados || []);
    if (!actuales.has(clave) && habitosModelo(form).length <= 1) {
      toast.error("Mantén al menos un hábito activo para que RITMO pueda interpretar tus días.");
      return;
    }
    if (actuales.has(clave)) actuales.delete(clave);
    else actuales.add(clave);
    const habitosDesactivados = [...actuales];
    set("habitosDesactivados", habitosDesactivados as never);
  }

  if (cargando) return <div className="flex flex-col gap-6"><Skeleton className="h-8 w-40" /><Skeleton className="h-64 w-full rounded-xl" /></div>;

  async function guardarPerfil() {
    if (guardadoEnCurso.current !== null || importacionEnCurso.current || borradoEnCurso.current || !perfilPendiente) return;
    const validacion = erroresPerfil(form);
    if (Object.keys(validacion).length) {
      setMostrarErrores(true);
      setPanel("personal");
      const campo = Object.keys(validacion)[0];
      window.requestAnimationFrame(() => document.getElementById(campo === "alturaCm" ? "altura" : campo)?.focus());
      return;
    }
    const cuenta = userId;
    const operacion = ++secuenciaGuardado.current;
    guardadoEnCurso.current = operacion;
    setErrorGuardado(null);
    setGuardandoPerfil(true);
    try {
      const ok = await actualizarPerfil({ ...form });
      if (cuentaForm.current !== cuenta || guardadoEnCurso.current !== operacion) return;
      if (ok) { dirty.current = false; setMostrarErrores(false); toast.success("Cambios guardados"); }
      else setErrorGuardado("No se pudo confirmar el guardado. Tus cambios siguen aquí para reintentarlo.");
    } catch {
      if (cuentaForm.current === cuenta && guardadoEnCurso.current === operacion) setErrorGuardado("No se pudo guardar. Revisa la conexión y vuelve a intentarlo.");
    } finally {
      if (cuentaForm.current === cuenta && guardadoEnCurso.current === operacion) { guardadoEnCurso.current = null; setGuardandoPerfil(false); }
    }
  }

  function descargar() {
    const blob = new Blob([JSON.stringify(exportar(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ritmo-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    marcarExportacion(userId);
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
    // El CSV es un resumen; solo el JSON permite restaurar la cuenta completa.
  }

  async function restaurarCopiaLocal() {
    const b = leerBackupLocal(userId);
    if (!b) {
      toast.error("No hay copia local guardada.");
      return;
    }
    const analisis = analizarImportacion(b.data, { perfil: estado.perfil, dias: estado.dias, composicion: estado.composicion });
    if (!analisis.valido) { toast.error(analisis.error); return; }
    setPreviewDatos(b.data as ArchivoRitmo); setResumenImportacion(analisis);
  }

  async function probarRestauracion() {
    if (!userId || probandoCopia) return;
    setProbandoCopia(true);
    try {
      const resultado = await ejecutarSimulacroRestauracion(exportar(), userId, true);
      setSimulacroInfo(resultado);
      if (resultado.ok) toast.success("Copia preparada para restaurarse");
      else toast.error(resultado.detail);
    } catch {
      toast.error("No se ha podido comprobar la copia. Vuelve a intentarlo.");
    } finally { setProbandoCopia(false); }
  }

  async function subirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    const generacion = generacionCuenta.current;
    try {
      const datos: unknown = JSON.parse(await file.text());
      if (generacionCuenta.current !== generacion) return;
      const analisis = analizarImportacion(datos, { perfil: estado.perfil, dias: estado.dias, composicion: estado.composicion });
      if (!analisis.valido) { toast.error(analisis.error); return; }
      setPreviewDatos(datos as ArchivoRitmo);
      setResumenImportacion(analisis);
    } catch {
      if (generacionCuenta.current === generacion) toast.error("Archivo no válido.");
    } finally { input.value = ""; }
  }

  async function confirmarImportacion() {
    if (!previewDatos || importacionEnCurso.current || guardadoEnCurso.current !== null || borradoEnCurso.current) return;
    if (perfilPendiente && !window.confirm("La importación puede cambiar tu perfil. ¿Quieres descartar los cambios sin guardar y continuar?")) return;
    const generacion = generacionCuenta.current;
    importacionEnCurso.current = true;
    descartarPerfil();
    setImportando(true); setProgresoImportacion({ porcentaje: 5, etapa: "preparando" });
    try {
      await importar(previewDatos, setProgresoImportacion);
      if (generacionCuenta.current !== generacion) return;
      toast.success("Datos importados");
      setPreviewDatos(null); setResumenImportacion(null);
    } catch {
      if (generacionCuenta.current === generacion) toast.error("Error al importar");
    } finally { if (generacionCuenta.current === generacion) { importacionEnCurso.current = false; setImportando(false); setProgresoImportacion(null); } }
  }

  async function eliminarDatos() {
    if (borradoEnCurso.current || guardadoEnCurso.current !== null || importacionEnCurso.current) return;
    const generacion = generacionCuenta.current;
    const cuenta = userId;
    borradoEnCurso.current = true; setBorrandoDatos(true);
    try {
      await borrarDatos();
      if (generacionCuenta.current !== generacion) return;
      limpiarDatosLocales(cuenta); limpiarPreferenciasComidas();
      dirty.current = false; setConfirmarBorrado(false);
      toast.success("Datos de RITMO eliminados");
    } catch {
      if (generacionCuenta.current === generacion) toast.error("No se pudieron eliminar los datos.");
    } finally {
      if (generacionCuenta.current === generacion) { borradoEnCurso.current = false; setBorrandoDatos(false); }
    }
  }

  const panelActivo = PANELES_AJUSTES.find(opcion => opcion.id === panel) ?? PANELES_AJUSTES[0];
  const PanelIcono = panelActivo.icono;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Ajustes" description="Tu centro de control: elige un área y cambia solo lo que necesitas." />

      <div className="settings-workspace grid min-w-0 gap-5 lg:grid-cols-[15.5rem_minmax(0,1fr)] lg:items-start">
      <nav aria-label="Áreas de ajustes" className="settings-index grid grid-cols-2 gap-2 sm:grid-cols-4 lg:sticky lg:top-6 lg:flex lg:flex-col lg:rounded-2xl lg:border lg:border-border/80 lg:bg-card lg:p-2 lg:shadow-sm">
        {PANELES_AJUSTES.map(({ id, etiqueta, detalle, icono: Icono }) => (
          <button
            key={id}
            type="button"
            onClick={() => setPanel(id)}
            aria-pressed={panel === id}
            className={cn("group flex min-h-[4.5rem] min-w-0 items-center gap-2.5 rounded-xl border px-2.5 text-left transition-[background-color,border-color,color,box-shadow] max-[359px]:min-h-14 lg:w-full lg:gap-3 lg:px-3", panel === id ? "border-primary/25 bg-primary/8 text-foreground shadow-sm" : "border-border/70 bg-card text-muted-foreground hover:border-primary/15 hover:bg-secondary/45 hover:text-foreground lg:border-transparent lg:bg-transparent")}
          >
            <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl transition-colors", panel === id ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground group-hover:text-primary")}><Icono className="size-[1.05rem]" /></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-semibold leading-tight">{etiqueta}</span><span className="mt-1 block text-[0.68rem] leading-tight text-muted-foreground max-[359px]:hidden">{detalle}</span></span>
          </button>
        ))}
      </nav>
      <div id={`panel-ajustes-${panel}`} className="flex min-w-0 flex-col gap-5">
        <div className="settings-panel-intro flex min-w-0 items-start gap-3 rounded-2xl border border-primary/15 p-3 shadow-sm min-[360px]:p-4 sm:items-center sm:p-5">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground ring-1 ring-primary-foreground/10"><PanelIcono className="size-5" /></span>
          <div className="min-w-0"><h2 className="font-display text-xl font-bold tracking-tight">{panelActivo.etiqueta}</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground max-[359px]:hidden">{panelActivo.detalle}. Los cambios de perfil se guardan juntos; el resto se aplica al momento.</p></div>
        </div>

      {/* Datos que alimentan el modelo, separados para una lectura más clara. */}
      <form id="perfil-ajustes" onSubmit={event => { event.preventDefault(); void guardarPerfil(); }}>
      <fieldset disabled={guardandoPerfil || importando || borrandoDatos} className="flex min-w-0 flex-col gap-5" aria-busy={guardandoPerfil || importando || borrandoDatos}>
      <SettingsSection id="ajuste-perfil" active={panel === "personal"}>
        <SectionLabel>Datos personales</SectionLabel>
        <SettingsCard>
          <SettingsSubhead title="Tu perfil" description="Los datos que orientan las estimaciones de RITMO." />
          <Row label="Nombre" htmlFor="nombre" error={errores.nombre}>
            <Input id="nombre" autoComplete="given-name" maxLength={80} aria-invalid={!!errores.nombre} aria-describedby={errores.nombre ? "nombre-error" : undefined} value={form.nombre ?? ""} onChange={(e) => set("nombre", e.target.value)} className="h-11 w-full scroll-mt-28 rounded-xl sm:w-56" />
          </Row>
          <Row label="Sexo biológico" htmlFor="sexo" error={errores.sexo}>
            <div id="sexo" role="group" aria-label="Sexo biológico" tabIndex={-1} aria-describedby={errores.sexo ? "sexo-error" : undefined} className="grid w-full grid-cols-2 gap-1.5 sm:max-w-64">
              {(["hombre", "mujer"] as Sexo[]).map((s) => (
                <Pill key={s} activo={form.sexo === s} onClick={() => set("sexo", s)}>{s === "hombre" ? "Hombre" : "Mujer"}</Pill>
              ))}
            </div>
          </Row>
          <Row label="Edad" htmlFor="edad" error={errores.edad}>
            <Input id="edad" inputMode="numeric" value={numeros.edad} aria-invalid={!!errores.edad} aria-describedby={errores.edad ? "edad-error" : undefined} onChange={(e) => setNumero("edad", e.target.value)} className="h-11 w-full rounded-xl tabular sm:w-28" />
          </Row>
          <Row label="Altura (cm)" htmlFor="altura" error={errores.alturaCm}>
            <Input id="altura" inputMode="numeric" value={numeros.alturaCm} aria-invalid={!!errores.alturaCm} aria-describedby={errores.alturaCm ? "altura-error" : undefined} onChange={(e) => setNumero("alturaCm", e.target.value)} className="h-11 w-full rounded-xl tabular sm:w-28" />
          </Row>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection id="ajuste-objetivo" active={panel === "personal"}>
        <SectionLabel>Objetivo y nutrición</SectionLabel>
        <SettingsCard>
          <SettingsSubhead title="Tu estrategia" description="Las referencias con las que RITMO interpreta tu evolución." />
          <Row label="Objetivo principal" htmlFor="objetivo" error={errores.objetivo}>
            <div id="objetivo" role="group" aria-label="Objetivo principal" tabIndex={-1} aria-describedby={errores.objetivo ? "objetivo-error" : undefined} className="grid w-full grid-cols-3 gap-1.5 sm:max-w-80">
              {(["perder", "mantener", "ganar"] as Objetivo[]).map((o) => (
                <Pill key={o} activo={form.objetivo === o} onClick={() => set("objetivo", o)}>
                  {o === "perder" ? "Perder" : o === "mantener" ? "Mantener" : "Ganar"}
                </Pill>
              ))}
            </div>
          </Row>
          <Row label="Peso objetivo (kg)" htmlFor="pesoObjetivo" error={errores.pesoObjetivo}>
            <Input id="pesoObjetivo" inputMode="decimal" value={numeros.pesoObjetivo} aria-invalid={!!errores.pesoObjetivo} aria-describedby={errores.pesoObjetivo ? "pesoObjetivo-error" : undefined} onChange={(e) => setNumero("pesoObjetivo", e.target.value)} className="h-11 w-full rounded-xl tabular sm:w-28" />
          </Row>
          <Row label="Calorías objetivo" htmlFor="kcalObjetivo" error={errores.kcalObjetivo}>
            <Input id="kcalObjetivo" inputMode="numeric" value={numeros.kcalObjetivo} aria-invalid={!!errores.kcalObjetivo} aria-describedby={errores.kcalObjetivo ? "kcalObjetivo-error" : undefined} onChange={(e) => setNumero("kcalObjetivo", e.target.value)} className="h-11 w-full rounded-xl tabular sm:w-32" />
          </Row>
          <div>
            <Row label="Proteína (g/kg)" htmlFor="proteinaObjetivo" error={errores.proteinaObjetivo}>
              <Input
                id="proteinaObjetivo"
                inputMode="decimal"
                placeholder={proteinaSugerida}
                value={numeros.proteinaObjetivo}
                aria-invalid={!!errores.proteinaObjetivo}
                aria-describedby={errores.proteinaObjetivo ? "proteinaObjetivo-error" : undefined}
                onChange={(e) => setNumero("proteinaObjetivo", e.target.value)}
                className="h-11 w-full rounded-xl tabular sm:w-28"
              />
            </Row>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Gramos de proteína por kg de peso. Vacío = automático ({proteinaSugerida} g/kg según tu objetivo).
            </p>
          </div>
          <div className="border-t border-border pt-4">
            <Label className="mb-2 block text-sm">Nivel de actividad</Label>
            <div id="factorActividad" role="group" aria-label="Nivel de actividad" tabIndex={-1} aria-describedby={errores.factorActividad ? "factorActividad-error" : undefined} className="flex flex-col gap-1.5">
              {FACTORES_ACTIVIDAD.map((f) => (
                <button
                  key={f.clave}
                  type="button"
                  onClick={() => set("factorActividad", f.factor)}
                  aria-pressed={form.factorActividad === f.factor}
                  className={cn("flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl border px-3 py-2 text-left text-sm transition-colors", form.factorActividad === f.factor ? "border-primary bg-primary/8" : "border-border hover:bg-secondary/50")}
                >
                  <span className="font-medium">{f.etiqueta}</span>
                  <span className="text-xs text-muted-foreground">{f.detalle}</span>
                </button>
              ))}
            </div>
            {errores.factorActividad && <p id="factorActividad-error" role="alert" className="mt-1.5 text-xs leading-relaxed text-destructive">{errores.factorActividad}</p>}
          </div>
        </SettingsCard>
      </SettingsSection>

      {/* Reglas del modelo */}
      <SettingsSection id="ajuste-modelo" active={panel === "rutina"}>
        <SectionLabel>Modelo y adherencia</SectionLabel>
        <SettingsCard>
          <SettingsSubhead title="Días sin hábitos" description="Cómo interpreta RITMO una jornada sin adherencia registrada." />
          <div className="rounded-xl border border-warning-border bg-warning-wash/65 p-3.5">
          <p className="text-sm font-semibold text-warning-ink">Superávit conservador</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Con cero hábitos en un día registrado, RITMO aplica un superávit estimado de {p.imputarSuperavitKcal ?? 500} kcal. Así un día sin adherencia nunca se interpreta como déficit.
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">Cuando faltan comidas, los hábitos completan el día y el déficit inferido queda limitado a un ritmo máximo aproximado del 1% del peso por semana.</p>
          </div>
          <div className="border-t border-border pt-4"><Row label="Contar días totalmente vacíos">
            <Switch checked={form.imputarActiva !== false} onCheckedChange={(v) => set("imputarActiva", v)} aria-label="Contar días totalmente vacíos" />
          </Row><p className="mt-1.5 text-xs text-muted-foreground">También aplica ese superávit a huecos sin ningún dato desde la fecha de corte configurada.</p></div>
          <div className="border-t border-border pt-4"><Row label="Predicción silenciosa">
            <Switch checked={preferenciasExperimentos.modoInvisible} onCheckedChange={(valor) => guardarExperimentos(userId, { ...preferenciasExperimentos, modoInvisible: valor })} aria-label="Predicción silenciosa" />
          </Row><p className="mt-1.5 text-xs text-muted-foreground">Oculta horizontes rutinarios y los vuelve a mostrar si detecta retención, un cambio relevante o falta un pesaje reciente.</p></div>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection id="ajuste-habitos" active={panel === "rutina"}>
        <SectionLabel>Hábitos personales</SectionLabel>
        <SettingsCard>
          <SettingsSubhead title="Qué cuenta en tu modelo" description={`Los ${habitosModelo(form).length} hábitos activos definen la constancia y recalibran el peso. Desactiva los que no quieras usar.`} />
          <p className="rounded-xl bg-body-wash/45 px-3 py-2 text-xs leading-relaxed text-body-ink">Los cambios empiezan hoy. RITMO conserva la configuración anterior en los días pasados para no reescribir tu historia.</p>
          <div className="grid gap-2 sm:grid-cols-2">{habitosUsuario(form).map((h) => { const activo = !(form.habitosDesactivados || []).includes(h.clave); const esBase = HABITOS.some((base) => base.clave === h.clave); return <div key={h.clave} className={cn("flex min-h-12 items-center gap-2 rounded-xl border px-3", activo ? "border-primary/25 bg-primary/5" : "border-border bg-secondary/30 text-muted-foreground")}><button type="button" onClick={() => void alternarHabitoModelo(h.clave)} className="min-w-0 flex-1 text-left text-sm font-medium" aria-pressed={activo}>{h.etiqueta}<span className="mt-0.5 block text-[0.68rem] font-normal text-muted-foreground">{activo ? "Activo en el modelo" : "No cuenta en el modelo"}</span></button><Switch checked={activo} onCheckedChange={() => void alternarHabitoModelo(h.clave)} aria-label={`${activo ? "Desactivar" : "Activar"} ${h.etiqueta}`} />{!esBase && <button type="button" onClick={() => void quitarHabitoPersonal(h.clave)} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-card hover:text-destructive" aria-label={`Eliminar ${h.etiqueta}`}>×</button>}</div>; })}</div>
          <div className="flex flex-col gap-2 sm:flex-row"><Input aria-label="Nombre del nuevo hábito" value={nuevoHabito} onChange={(e) => setNuevoHabito(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void anadirHabitoPersonal(); } }} placeholder="Ej. Caminar 8.000 pasos" maxLength={28} className="h-11 rounded-xl" /><Button type="button" onClick={() => void anadirHabitoPersonal()} variant="secondary" className="h-11 shrink-0 rounded-xl">Añadir hábito</Button></div>
        </SettingsCard>
      </SettingsSection>
      </fieldset>
      </form>

      <SettingsSection id="ajuste-contexto" active={panel === "rutina"}>
        <SectionLabel>Contexto y viaje</SectionLabel>
        <SettingsCard>
          <SettingsSubhead title="Modo viaje / vacaciones" description="Un contexto visual para interpretar tus días sin alterar kcal, hábitos ni predicciones." />
          <Row label="Estado actual">
            <div className="flex flex-wrap items-center gap-2"><span className={cn("inline-flex min-h-9 max-w-full items-center rounded-xl px-3 py-1 text-xs font-semibold break-words", viaje.activo ? "bg-habit-wash text-habit-ink" : "bg-secondary text-muted-foreground")}>{viaje.activo ? viaje.etiqueta : "Sin viaje activo"}</span>{viaje.activo && <Button variant="secondary" size="sm" className="h-9 rounded-xl" onClick={() => guardarModoViaje({ ...viaje, activo: false }, userId)}>Finalizar</Button>}</div>
          </Row>
          {!viaje.activo && <form className="grid items-end gap-3 border-t border-border pt-4 sm:grid-cols-[minmax(0,1fr)_11rem_auto]" onSubmit={event => {
            event.preventDefault();
            if (finViaje && finViaje < hoy()) { toast.error("La fecha de fin debe ser hoy o posterior."); return; }
            try { guardarModoViaje({ activo: true, etiqueta: nombreViaje.trim() || "Viaje", desde: hoy(), hasta: finViaje || undefined }, userId); }
            catch { toast.error("No se ha podido guardar el viaje en este dispositivo. Vuelve a intentarlo."); }
          }}><div className="space-y-1.5"><Label htmlFor="nombre-viaje">Nombre del viaje</Label><Input id="nombre-viaje" value={nombreViaje} maxLength={80} onChange={(e) => setNombreViaje(e.target.value)} placeholder="Viaje a Lisboa" className="h-11 rounded-xl" /></div><div className="space-y-1.5"><Label htmlFor="fin-viaje">Fin (opcional)</Label><Input id="fin-viaje" type="date" min={hoy()} value={finViaje} onChange={(e) => setFinViaje(e.target.value)} className="h-11 rounded-xl" /></div><Button type="submit" className="h-11 rounded-xl px-4"><Plane className="size-4" /> Activar</Button></form>}
        </SettingsCard>
      </SettingsSection>

      <SettingsSection id="ajuste-experiencia" active={panel === "experiencia"}>
        <SectionLabel>Experiencia</SectionLabel>
        <SettingsCard>
          <SettingsSubhead title="Apariencia" description="Elige color y densidad para tu forma de usar RITMO." />
          <div className="flex flex-wrap gap-2">
            {([["light", "Claro", Sun], ["dark", "Oscuro", Moon], ["system", "Sistema", Monitor]] as const).map(([val, label, Icon]) => (
              <button
                key={val}
                type="button"
                onClick={() => setTheme(val)}
                aria-pressed={theme === val}
                className={cn("flex min-h-20 min-w-0 flex-1 basis-20 flex-col items-center justify-center gap-1.5 rounded-xl border py-3 text-sm transition-colors", theme === val ? "border-primary bg-primary/8 text-foreground shadow-sm" : "border-border text-muted-foreground hover:bg-secondary/50")}
              >
                <Icon className="size-5" />
                {label}
              </button>
            ))}
          </div>
          <div className="border-t border-border pt-5">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div><p className="text-sm font-semibold">Densidad visual</p><p className="mt-0.5 text-xs text-muted-foreground">Ajusta el espacio entre secciones y el aire de lectura.</p></div>
              <span className="text-xs font-medium text-primary">{densidad === "automatica" ? "Automática" : densidad === "compacta" ? "Compacta" : "Espaciosa"}</span>
            </div>
            <div className="mt-3 inline-flex max-w-full flex-wrap rounded-xl bg-secondary p-1" role="group" aria-label="Densidad visual">
              {(["automatica", "compacta", "espaciosa"] as const).map((opcion) => <button key={opcion} type="button" onClick={() => cambiarDensidad(opcion)} aria-pressed={densidad === opcion} className={cn("h-9 rounded-xl px-4 text-sm font-medium transition-colors", densidad === opcion ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{opcion === "automatica" ? "Automática" : opcion === "compacta" ? "Compacta" : "Espaciosa"}</button>)}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Automática compacta la navegación en móvil y mantiene más aire en pantallas grandes.</p>
          </div>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection id="ajuste-estado" active={panel === "experiencia"}>
        <SectionLabel>Estado de la cuenta</SectionLabel>
        <SettingsCard>
          <SettingsSubhead title="Todo lo importante, en una mirada" description="Conexión, cambios pendientes y copias sin mensajes técnicos." />
          <AccountHealth cloud={modo === "nube"} backupAt={backupInfo?.at} />
        </SettingsCard>
      </SettingsSection>

      {/* Respaldo y portabilidad */}
      <SettingsSection id="ajuste-datos" active={panel === "datos"}>
        <SectionLabel>Datos y respaldo</SectionLabel>
        <SettingsCard className="gap-3.5">
          <SyncCenter />
          {features.data_health && <DataHealthCenter />}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-sm font-semibold">Tu historial, siempre contigo</p><p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">El JSON guarda una copia para restaurar. El CSV resume tus días para abrirlos en una hoja de cálculo.</p></div>
            <div className="grid w-full grid-cols-2 gap-1.5 sm:w-auto sm:flex sm:shrink-0">
              <Button variant="secondary" onClick={descargar} className="h-11 rounded-xl gap-1.5 px-2.5 text-xs sm:px-3 sm:text-sm"><Download className="size-4" /> JSON</Button>
              <Button variant="secondary" onClick={descargarCSV} className="h-11 rounded-xl gap-1.5 px-2.5 text-xs sm:px-3 sm:text-sm"><FileSpreadsheet className="size-4" /> CSV</Button>
              <Button variant="secondary" onClick={event => { focoImportacionRef.current = event.currentTarget; fileRef.current?.click(); }} className="h-11 rounded-xl gap-1.5 px-2.5 text-xs sm:px-3 sm:text-sm"><Upload className="size-4" /> Importar</Button>
              <ProfessionalReport estado={estado} />
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
              <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-card text-weight ring-1 ring-border/70"><HistoryIcon className="size-3.5" /></span>
              <span>{backupInfo ? <>Copia local guardada · {fmtFechaCorta(backupInfo.at.slice(0, 10))}</> : "Aún no hay copia local automática."}</span>
            </div>
            {backupInfo && (
              <Button variant="ghost" size="sm" onClick={event => { focoImportacionRef.current = event.currentTarget; void restaurarCopiaLocal(); }} className="h-auto min-h-11 w-full rounded-lg gap-2 py-2 text-xs whitespace-normal sm:w-auto">
                <HistoryIcon className="size-3.5" /> Restaurar copia local
              </Button>
            )}
          </div>
          <div className="flex flex-col gap-2.5 rounded-xl border border-border/70 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 text-xs">
              <p className="font-semibold text-foreground">Prueba de restauración</p>
              <p className={cn("mt-0.5 leading-relaxed", simulacroInfo?.ok === false ? "text-destructive" : "text-muted-foreground")}>
                {simulacroInfo ? `${simulacroInfo.detail} · ${fmtFechaCorta(simulacroInfo.at.slice(0, 10))}` : "RITMO comprobará automáticamente la copia una vez por semana."}
              </p>
            </div>
            <Button variant="ghost" size="sm" disabled={!backupInfo || probandoCopia} onClick={() => void probarRestauracion()} className="h-auto min-h-9 w-full rounded-lg py-2 text-xs sm:w-auto">
              <ShieldCheck className="size-3.5" /> {probandoCopia ? "Comprobando…" : "Probar ahora"}
            </Button>
          </div>
        </SettingsCard>
      </SettingsSection>

      {/* Diálogo de confirmación de importación */}
      <Dialog open={!!previewDatos} onOpenChange={open => { if (!open && !importando) { setPreviewDatos(null); setResumenImportacion(null); } }}>
        {previewDatos && (
          <DialogContent showCloseButton={false} className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl p-5 sm:max-w-sm" onEscapeKeyDown={event => { if (importando) event.preventDefault(); }} onInteractOutside={event => { if (importando) event.preventDefault(); }} onCloseAutoFocus={event => { event.preventDefault(); focoImportacionRef.current?.focus(); }} aria-busy={importando}>
            <div className="mb-4">
              <DialogTitle className="font-display text-lg font-bold">Confirmar importación</DialogTitle>
              <DialogDescription className="mt-1">Revisa lo que se añadirá antes de fusionarlo con tu cuenta.</DialogDescription>
            </div>
            <div className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border text-xs">
              <ImportMetric label="Días nuevos" value={resumenImportacion?.diasNuevos ?? 0} />
              <ImportMetric label="Días existentes" value={resumenImportacion?.diasCoincidentes ?? 0} detail="se fusionan" />
              <ImportMetric label="Mediciones nuevas" value={resumenImportacion?.medicionesNuevas ?? 0} />
              <ImportMetric label="Coincidencias" value={resumenImportacion?.medicionesCoincidentes ?? 0} detail="se completan" />
            </div>
            <p className="mb-5 text-xs leading-relaxed text-muted-foreground">{resumenImportacion?.comidas ?? 0} comidas · formato {resumenImportacion?.version ?? "anterior"}{resumenImportacion?.schemaVersion ? ` · datos ${resumenImportacion.schemaVersion}` : ""}{resumenImportacion?.exportado ? ` · copia del ${fmtFechaCorta(resumenImportacion.exportado.slice(0, 10))}` : ""}. Los duplicados se detectan por fecha: no se crean dos días ni dos mediciones iguales.</p>
            {(previewDatos.auditoriaModelo || previewDatos.auditoriaDocumental) && <p className="mb-4 rounded-lg bg-secondary/60 px-3 py-2 text-xs leading-relaxed text-muted-foreground">El historial del modelo se conservará como copia documental; no contará como predicciones verificadas.</p>}
            {importando && progresoImportacion && <div className="mb-5 space-y-2" role="status" aria-live="polite">
              <div className="flex items-center justify-between gap-3 text-xs"><span className="font-medium">{progresoImportacion.etapa === "preparando" ? "Preparando datos" : progresoImportacion.etapa === "enviando" ? "Enviando de forma segura" : progresoImportacion.etapa === "confirmando" ? "Confirmando la transacción" : "Verificando el resultado"}</span><span className="tabular-nums text-muted-foreground">{progresoImportacion.porcentaje}%</span></div>
              <Progress value={progresoImportacion.porcentaje} aria-label="Progreso de la importación" />
              <p className="text-xs leading-relaxed text-muted-foreground">La base de datos confirmará todo el archivo a la vez. Si algo falla, no quedará una importación a medias.</p>
            </div>}
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => { setPreviewDatos(null); setResumenImportacion(null); }}
                disabled={importando}
                className="min-h-11 flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={confirmarImportacion}
                disabled={importando || guardandoPerfil || borrandoDatos}
                className="min-h-11 flex-1"
              >
                {importando ? "Importando..." : "Importar"}
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>

      <SettingsSection id="ajuste-privacidad" active={panel === "datos"}>
        <SectionLabel>Privacidad</SectionLabel>
        <SettingsCard className="gap-3.5">
          <PrivacyMap externalNutrition={EXTERNAL_NUTRITION_ENABLED} />
          <Row label="Compartir errores técnicos"><Switch checked={diagnostico} onCheckedChange={v => { permitirDiagnostico(userId, v); setDiagnostico(v); }} aria-label="Compartir errores técnicos" /></Row>
          <p className="text-xs leading-relaxed text-muted-foreground">Opcional: envía el tipo de error y la versión de RITMO, nunca tus comidas, peso ni notas. <Link href="/privacidad" className="font-medium text-primary underline underline-offset-4">Cómo se usan mis datos</Link></p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-sm font-semibold">Tus datos siguen siendo tuyos</p><p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{EXTERNAL_NUTRITION_ENABLED ? "Gemini solo recibe una comida cuando eliges analizarla." : "El análisis nutricional es local: no envía tus comidas a Gemini ni Edamam."}</p></div>
            <Button variant="secondary" onClick={() => { limpiarDatosLocales(userId); limpiarPreferenciasComidas(); toast.success("Datos locales eliminados"); }} className="h-auto min-h-10 w-full rounded-xl gap-2 py-2 whitespace-normal sm:w-auto"><Trash2 className="size-4" /> Limpiar este dispositivo</Button>
          </div>
          {confirmarBorrado ? <div className="flex flex-col gap-3 rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs leading-relaxed text-destructive">Borra perfil, días, comidas, mediciones y copias de seguridad de la nube. Tu acceso seguirá existiendo.</p><div className="flex shrink-0 gap-1.5"><Button variant="ghost" size="sm" className="h-8 rounded-lg" disabled={borrandoDatos} onClick={() => setConfirmarBorrado(false)}>Cancelar</Button><Button variant="destructive" size="sm" className="h-8 rounded-lg" disabled={borrandoDatos || guardandoPerfil || importando} onClick={() => void eliminarDatos()}>{borrandoDatos ? "Eliminando…" : "Eliminar"}</Button></div></div> : <button type="button" onClick={() => setConfirmarBorrado(true)} className="self-start text-xs font-medium text-destructive transition-opacity hover:opacity-75">Eliminar todos mis datos de RITMO…</button>}
        </SettingsCard>
      </SettingsSection>

      <SettingsSection id="ajuste-cuenta" active={panel === "datos"}>
        <SectionLabel>Cuenta</SectionLabel>
        <SettingsCard className="gap-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><UserRound className="size-4" /></span><div className="min-w-0"><p className="truncate text-sm font-semibold">{userEmail ?? "Modo demo (local)"}</p><p className="mt-0.5 text-xs text-muted-foreground">{modo === "nube" ? "Cuenta sincronizada" : "Datos solo en este dispositivo"}</p></div></div>
            <Button variant="ghost" onClick={() => { if (!perfilPendiente || window.confirm("Tienes cambios sin guardar. ¿Quieres cerrar sesión y descartarlos?")) { dirty.current = false; void cerrarSesion(); } }} className="h-10 w-full rounded-xl gap-2 text-muted-foreground hover:text-destructive sm:w-auto"><LogOut className="size-4" /> {modo === "nube" ? "Cerrar sesión" : "Salir"}</Button>
          </div>
        </SettingsCard>
      </SettingsSection>
      <div ref={barraGuardarRef} role="region" aria-label="Guardar ajustes" className={cn("z-30 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 transition-[background-color,border-color,box-shadow]", perfilPendiente || guardandoPerfil || errorGuardado ? "border-border bg-card shadow-lg" : "border-border/60 bg-secondary/35 shadow-none", panel !== "personal" && panel !== "rutina" && !perfilPendiente && !guardandoPerfil && !errorGuardado && "hidden", barraGuardarFija && (perfilPendiente || guardandoPerfil || !!errorGuardado) ? "sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-4" : "relative")}>
        <div className="min-w-0"><p className={cn("text-sm font-semibold", errorGuardado && "text-destructive")} role={errorGuardado ? "alert" : "status"}>{errorGuardado ?? (guardandoPerfil ? "Guardando tus cambios…" : perfilPendiente ? "Cambios pendientes" : "Todo al día")}</p><p className="mt-0.5 text-xs text-muted-foreground">Perfil, objetivos y hábitos</p></div>
        <div className="flex w-full min-w-0 flex-wrap gap-2 sm:w-auto"><Button type="button" variant="secondary" className="h-auto min-h-11 min-w-0 flex-1 basis-32 px-3 py-2 whitespace-normal sm:flex-none" onClick={descartarPerfil} disabled={!perfilPendiente || guardandoPerfil || importando || borrandoDatos}>Descartar</Button><Button type="submit" form="perfil-ajustes" className="h-auto min-h-11 min-w-0 flex-1 basis-32 px-3 py-2 whitespace-normal sm:flex-none" disabled={!perfilPendiente || guardandoPerfil || importando || borrandoDatos}>{guardandoPerfil ? "Guardando…" : "Guardar cambios"}</Button></div>
      </div>
      </div>
      </div>
    </div>
  );
}

function ImportMetric({ label, value, detail }: { label: string; value: number; detail?: string }) {
  return <div className="bg-card px-3 py-2.5"><p className="font-display text-xl font-bold tabular">{value}</p><p className="mt-0.5 text-[0.65rem] text-muted-foreground">{label}{detail ? ` · ${detail}` : ""}</p></div>;
}

function SettingsSection({ active, id, children }: { active: boolean; id: string; children: React.ReactNode }) {
  if (!active) return null;
  return <section id={id} className="scroll-mt-24">{children}</section>;
}

function Row({ label, children, htmlFor, error }: { label: string; children: React.ReactNode; htmlFor?: string; error?: string }) {
  return (
    <div className="settings-row grid gap-2 border-b border-border/70 pb-4 last:border-0 last:pb-0 sm:grid-cols-[minmax(8rem,.72fr)_minmax(13rem,1fr)] sm:items-center sm:gap-5">
      <Label htmlFor={htmlFor} className="text-sm font-medium">{label}</Label>
      <div className="min-w-0"><div className="flex w-full justify-start sm:justify-end [&>*]:min-w-0 [&>*]:max-w-full">{children}</div>{error && <p id={`${htmlFor}-error`} role="alert" className="mt-1.5 text-xs leading-relaxed text-destructive sm:text-right">{error}</p>}</div>
    </div>
  );
}

function Pill({ children, activo, onClick }: { children: React.ReactNode; activo: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={cn("min-h-10 w-full max-w-full rounded-lg border px-3 py-2 text-sm font-medium transition-colors", activo ? "border-primary bg-primary/10 text-primary shadow-sm" : "border-border text-muted-foreground hover:bg-secondary/50")}
    >
      {children}
    </button>
  );
}

function SettingsCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <Card className={cn("settings-card flex flex-col gap-4 rounded-2xl border-border/80 p-4 shadow-sm sm:p-5 lg:p-6", className)}>{children}</Card>;
}

function SettingsSubhead({ title, description, className }: { title: string; description: string; className?: string }) {
  return <div className={cn("border-b border-border/70 pb-3", className)}><p className="text-sm font-semibold">{title}</p><p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p></div>;
}
