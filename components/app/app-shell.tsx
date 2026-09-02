"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, MoreHorizontal, Plus, Search, Settings } from "lucide-react";
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

function UserMenu({ compact = false }: { compact?: boolean }) {
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
        {secundarios.map((item) => (
          <DropdownMenuItem key={item.href} asChild>
            <Link href={item.href}>
              <item.icon className="size-4" />
              {item.label}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
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

  const activo = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const primarios = NAV_ITEMS.filter((i) => i.primary);

  // Atajos de teclado globales. Se ignoran si el foco está en un campo de texto
  // o si el panel de registro ya está abierto (para no capturar su escritura).
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
    <div className="min-h-dvh bg-background">
      <TravelBanner />
      {/* Sidebar — escritorio */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-card px-4 py-5 md:flex">
        <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
          <Link href="/" aria-label="RITMO — inicio" className="inline-flex">
            <RitmoLogo wordmarkClassName="h-10" />
          </Link>
          <UserCount compact className="rounded-full bg-secondary px-2.5 py-1.5" />
        </div>
        <Button
          onClick={() => abrir()}
          className="mt-4 h-11 justify-start gap-2 rounded-xl px-4 text-[0.95rem] shadow-sm"
        >
          <Plus className="size-5" />
          Registrar
        </Button>
        <button type="button" onClick={() => setBusquedaAbierta(true)} className="mt-2 flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
          <Search className="size-4" /><span className="flex-1 text-left">Buscar</span><kbd className="rounded-md border border-border px-1.5 py-0.5 text-[0.6rem]">⌘K</kbd>
        </button>
        <nav className="mt-5 flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.92rem] font-medium transition-colors",
                activo(item.href)
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <item.icon className="size-[1.15rem]" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <UserMenu />
          <div className="flex items-center gap-1">
            <Link href="/ajustes" aria-label="Ajustes" className="inline-flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
              <Settings className="size-[1.1rem]" />
            </Link>
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
      <div className="md:pl-64">
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
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-md md:hidden">
        <div className="mx-auto flex min-h-[4.2rem] max-w-lg items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
          {primarios.slice(0, 2).map((item) => (
            <NavTab key={item.href} item={item} active={activo(item.href)} />
          ))}
          <div className="flex items-center">
            <button
              onClick={() => abrir()}
              aria-label="Registrar"
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

function NavTab({ item, active }: { item: (typeof NAV_ITEMS)[number]; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-1 text-[0.62rem] font-medium transition-colors",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      <item.icon className={cn("size-[1.35rem]", active && "fill-primary/10")} />
      {item.label}
    </Link>
  );
}

/* Enlace de "más" reservado para futuras entradas de navegación. */
export function MoreLink() {
  return <MoreHorizontal className="size-5" />;
}
