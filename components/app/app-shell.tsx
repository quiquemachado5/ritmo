"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronUp, LogOut, MoreHorizontal, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RitmoLogo } from "@/components/ritmo-mark";
import { ThemeToggle } from "./theme-toggle";
import { NAV_ITEMS } from "./nav-items";
import { useQuickLog } from "./quick-log-provider";
import { useRitmo } from "@/lib/store/provider";
import { QuickLog } from "./quick-log";
import { PageTransition } from "@/components/page-transition";
import { UserCount } from "./user-count";
import { TravelBanner } from "./travel-banner";
import { GlobalSearch } from "./global-search";
import { hoy } from "@/lib/model/dates";
import { siguienteAccion } from "@/lib/model/next-action";
import { useExperimentos } from "@/lib/experiments";
import { estadoVisualRitmo } from "@/lib/model/insights";
import { useModoViaje } from "@/lib/travel-mode";

type MomentoRitmo = "dia" | "manana" | "tarde" | "noche";

function momentoActual(): MomentoRitmo {
  const hora = new Date().getHours();
  if (hora < 6 || hora >= 21) return "noche";
  if (hora < 13) return "manana";
  if (hora < 18) return "tarde";
  return "noche";
}

function UserMenu({ compact = false, expanded = false }: { compact?: boolean; expanded?: boolean }) {
  const { userEmail, cerrarSesion } = useRitmo();
  const inicial = (userEmail?.[0] ?? "R").toUpperCase();
  const secundarios = NAV_ITEMS.filter((i) => !i.primary);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {compact ? (
          <Button variant="ghost" size="icon" className="size-9 rounded-xl" aria-label="Más opciones">
            <MoreHorizontal className="size-5" />
          </Button>
        ) : expanded ? (
          <Button variant="ghost" className="h-12 min-w-0 flex-1 justify-start gap-2.5 rounded-xl px-2 text-left hover:bg-secondary/70" aria-label="Menú de la cuenta">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/12 text-xs font-bold text-primary">
              {inicial}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.68rem] font-semibold text-foreground">Cuenta</span>
              <span className="block truncate text-[0.68rem] font-normal text-muted-foreground">{userEmail ?? "Modo demo"}</span>
            </span>
            <ChevronUp className="size-3.5 shrink-0 text-muted-foreground/75" />
          </Button>
        ) : (
          <Button variant="ghost" size="icon" className="rounded-full" aria-label="Menú">
            <span className="grid size-8 place-items-center rounded-full bg-primary/12 text-sm font-bold text-primary">
              {inicial}
            </span>
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="truncate">{userEmail ?? "Modo demo"}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {!expanded && secundarios.map((item) => (
            <DropdownMenuItem key={item.href} asChild>
              <Link href={item.href}>
                <item.icon className="size-4" />
                {item.label}
              </Link>
            </DropdownMenuItem>
          ))}
        {!expanded && <DropdownMenuSeparator />}
        <DropdownMenuItem onSelect={() => void cerrarSesion()}>
          <LogOut className="size-4" />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { abrir, abierto } = useQuickLog();
  const [busquedaAbierta, setBusquedaAbierta] = React.useState(false);
  const modoMinimo = pathname === "/minimo";
  const { estado, userId, errorCarga, recargar } = useRitmo();
  const recomendada = React.useMemo(() => siguienteAccion(estado, hoy()), [estado]);
  const experimentos = useExperimentos(userId);
  const pulso = React.useMemo(() => estadoVisualRitmo(estado), [estado]);
  const viaje = useModoViaje(userId);
  const [momento, setMomento] = React.useState<MomentoRitmo>("dia");

  const activo = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const primarios = NAV_ITEMS.filter((i) => i.primary);
  const herramientas = NAV_ITEMS.filter((i) => !i.primary);

  // Atajos de teclado globales. Se ignoran si el foco está en un campo de texto
  // o si el panel de registro ya está abierto (para no capturar su escritura).
  React.useEffect(() => {
    const focus = new URLSearchParams(window.location.search).get("focus");
    if (focus === "peso" || focus === "comida" || focus === "habitos") {
      abrir(focus);
      const url = new URL(window.location.href); url.searchParams.delete("focus");
      window.history.replaceState(window.history.state, "", url.pathname + url.search);
    }
  }, [abrir]);

  React.useEffect(() => {
    const actualizarMomento = () => setMomento(momentoActual());
    actualizarMomento();
    const intervalo = window.setInterval(actualizarMomento, 5 * 60_000);
    return () => window.clearInterval(intervalo);
  }, []);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (modoMinimo) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setBusquedaAbierta(true); return; }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const enCampo = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (enCampo || abierto || busquedaAbierta) return;
      const k = e.key.toLowerCase();
      if (k === "/") { e.preventDefault(); setBusquedaAbierta(true); }
      else if (k === "r" || k === "n") { e.preventDefault(); abrir("comida"); }
      else if (k === "p") { e.preventDefault(); abrir("peso"); }
      else if (k === "h") { e.preventDefault(); abrir("habitos"); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [abrir, abierto, busquedaAbierta, modoMinimo]);

  if (errorCarga) {
    return <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 px-6">
      <RitmoLogo />
      <h1 className="text-2xl font-semibold">No hemos podido cargar tus datos</h1>
      <p className="text-muted-foreground">No se han sustituido tus registros ni tus copias de seguridad. Comprueba la conexión y vuelve a intentarlo.</p>
      <Button onClick={() => void recargar()}>Volver a cargar</Button>
      <Link className="text-center text-sm underline underline-offset-4" href="/login">Volver a iniciar sesión</Link>
    </main>;
  }

  if (modoMinimo) {
    return (
      <div className="min-h-dvh bg-background">
        <main className="mx-auto flex min-h-dvh w-full items-start px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] sm:items-center sm:px-6 sm:py-8">
          <PageTransition>{children}</PageTransition>
        </main>
        <QuickLog />
      </div>
    );
  }

  return (
    <div
      data-ritmo={experimentos.interfazViva ? pulso.estado : "neutro"}
      data-momento={experimentos.interfazViva ? momento : "dia"}
      data-contexto={experimentos.interfazViva && viaje.activo ? "viaje" : pulso.estado}
      className="app-canvas min-h-dvh bg-background"
    >
      {experimentos.interfazViva && <div className="biological-ambient" aria-hidden="true" />}
      <TravelBanner />
      {/* Sidebar — escritorio */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[16.25rem] flex-col border-r border-border/80 bg-card/97 px-3 py-3 shadow-[8px_0_28px_-28px_var(--foreground)] md:flex">
        <div className="flex h-12 items-center justify-between gap-3 px-2">
          <Link href="/" aria-label="RITMO — inicio" className="inline-flex rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <RitmoLogo wordmarkClassName="h-8" />
          </Link>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="size-9 rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground" onClick={() => setBusquedaAbierta(true)} aria-label="Buscar en RITMO" title="Buscar · ⌘K">
              <Search className="size-[1.05rem]" />
            </Button>
            <UserCount compact className="rounded-lg border border-border/80 bg-secondary/55 px-2 py-1" />
          </div>
        </div>
        <div className="mt-3">
          <Button
            onClick={() => abrir(recomendada.tab)}
            className="h-14 w-full justify-start gap-2.5 rounded-2xl px-2.5 text-sm shadow-sm"
            aria-label="Registrar"
            title={`${recomendada.etiqueta}. ${recomendada.detalle}`}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-foreground/12"><Plus className="size-[1.125rem]" /></span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block font-semibold leading-tight">Registrar</span>
              <span className="mt-0.5 block truncate text-[0.62rem] font-medium text-primary-foreground/70">{recomendada.etiqueta}</span>
            </span>
            <span className="ml-auto rounded-md bg-primary-foreground/12 px-2 py-1 text-[0.62rem] font-bold tabular">{recomendada.corta}</span>
          </Button>
        </div>
        <nav className="mt-3 overflow-y-auto rounded-2xl bg-secondary/35 p-2 [scrollbar-width:none]" aria-label="Secciones de RITMO">
          <p className="px-2 pb-1.5 pt-1 text-[0.58rem] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">Principal</p>
          <div className="flex flex-col gap-0.5">
            {primarios.map((item) => <SidebarNavLink key={item.href} item={item} active={activo(item.href)} />)}
          </div>
          <div className="mx-2 my-2.5 h-px bg-border/80" aria-hidden="true" />
          <p className="px-2 pb-1.5 text-[0.58rem] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">Herramientas</p>
          <div className="flex flex-col gap-0.5">
            {herramientas.map((item) => <SidebarNavLink key={item.href} item={item} active={activo(item.href)} />)}
          </div>
        </nav>
        <div className="min-h-3 flex-1" aria-hidden="true" />
        <div className="mt-3 rounded-2xl border border-border/80 bg-background/60 p-1 shadow-sm">
          <div className="flex min-w-0 items-center gap-0.5">
            <UserMenu expanded />
            <span className="h-7 w-px bg-border" aria-hidden="true" />
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* Cabecera — móvil */}
      <header className="sticky top-0 z-30 flex min-h-14 items-center justify-between border-b border-border bg-background/92 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-md md:hidden">
        <Link href="/" aria-label="RITMO — inicio">
          <RitmoLogo />
        </Link>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="size-9 rounded-xl" onClick={() => setBusquedaAbierta(true)} aria-label="Buscar"><Search className="size-5" /></Button>
          <ThemeToggle />
          <UserMenu />
        </div>
      </header>

      {/* Contenido */}
      <div className="md:pl-[16.25rem]">
        <main className="app-content mx-auto w-full max-w-[88rem] px-[clamp(1rem,3vw,3.5rem)] pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-5 md:pb-14 md:pt-9">
          <PageTransition>{children}</PageTransition>
          <footer className="mt-10 border-t border-border pt-4 text-center text-[0.68rem] text-muted-foreground/60 md:text-left">
            hecho por{" "}
            <a href="https://github.com/quiquemachado5" target="_blank" rel="noopener noreferrer" className="font-medium text-muted-foreground transition-colors hover:text-foreground hover:underline">
              quiquemachado5
            </a>
          </footer>
        </main>
      </div>

      {/* Barra inferior + FAB — móvil */}
      <nav aria-label="Navegación principal móvil" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-md md:hidden">
        <div className="mx-auto flex min-h-[4.2rem] max-w-lg items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
          {primarios.slice(0, 2).map((item) => (
            <NavTab key={item.href} item={item} active={activo(item.href)} />
          ))}
          <div className="flex items-center">
            <button
              onClick={() => abrir(recomendada.tab)}
              aria-label="Registrar"
              title={`${recomendada.etiqueta}. ${recomendada.detalle}`}
              className="grid size-14 -translate-y-4 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-transform active:scale-95"
            >
              <Plus className="size-7" />
            </button>
          </div>
          {primarios.slice(2, 4).map((item) => (
            <NavTab key={item.href} item={item} active={activo(item.href)} />
          ))}
        </div>
      </nav>

      <QuickLog />
      <GlobalSearch open={busquedaAbierta} onOpenChange={setBusquedaAbierta} />
    </div>
  );
}

function SidebarNavLink({ item, active }: { item: (typeof NAV_ITEMS)[number]; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex h-10 items-center gap-2.5 rounded-xl px-2 text-[0.84rem] font-medium outline-none transition-[background-color,color,box-shadow,transform] focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-card text-foreground shadow-sm ring-1 ring-border/75"
          : "text-muted-foreground hover:translate-x-0.5 hover:bg-card/70 hover:text-foreground",
      )}
    >
      <span className={cn("grid size-7 shrink-0 place-items-center rounded-lg transition-colors", active ? "bg-primary text-primary-foreground" : "text-muted-foreground group-hover:text-foreground")}>
        <item.icon className="size-4" />
      </span>
      <span className="truncate">{item.label}</span>
      {active && <span className="ml-auto size-1.5 rounded-full bg-primary" aria-hidden="true" />}
    </Link>
  );
}

function NavTab({ item, active }: { item: (typeof NAV_ITEMS)[number]; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={cn(
        "flex min-w-0 flex-1 basis-0 flex-col items-center justify-center gap-1 px-1 py-2 text-center text-[0.62rem] font-medium transition-colors",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg transition-colors", active && "bg-primary/10")}><item.icon className="size-[1.25rem]" /></span>
      <span className="w-full hyphens-auto [overflow-wrap:anywhere]">{item.label}</span>
    </Link>
  );
}

/* Enlace de "más" reservado para futuras entradas de navegación. */
export function MoreLink() {
  return <MoreHorizontal className="size-5" />;
}
