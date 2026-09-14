"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Activity, Beaker, Bot, Check, ChevronRight, CircleAlert, EyeOff, FlaskConical,
  History, LockKeyhole, Megaphone, RefreshCw, Search, ShieldCheck, Sparkles,
  UserCheck, UserRoundCog, UsersRound,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { VERSION_MODELO_CANDIDATO, VERSION_MODELO_ESTABLE } from "@/lib/model-audit/lifecycle";

type FeatureState = "hidden" | "pilot" | "public";
type ModelMode = "automatic" | "stable" | "candidate";
type Metrics = { users: number; onboarded: number; active30: number; suspended: number; admins: number; pilots: number };
type Feature = { key: string; label: string; description: string; state: FeatureState; updatedAt: string };
type AuditEntry = { id: number; action: string; actor: string; target: string; metadata: Record<string, unknown>; createdAt: string };
type Control = { weightModelMode: ModelMode; announcementEnabled: boolean; announcementText: string; updatedAt: string };
type Snapshot = { metrics: Metrics; features: Feature[]; control: Control; audit: AuditEntry[] };
type Health = { windowHours: number; total: number; errors: number; byEvent: Partial<Record<"auth" | "sync" | "nutrition" | "import" | "ui", number>>; latestBuild: string | null };
type AdminUser = { user_id: string; email_masked: string; provider: string; created_at: string; last_sign_in_at: string | null; status: "active" | "suspended"; role: "admin" | "pilot" | "user"; onboarding_complete: boolean; is_self: boolean };

const EMPTY: Snapshot = {
  metrics: { users: 0, onboarded: 0, active30: 0, suspended: 0, admins: 0, pilots: 0 },
  features: [],
  control: { weightModelMode: "automatic", announcementEnabled: false, announcementText: "", updatedAt: "" },
  audit: [],
};

function normalizeSnapshot(value: unknown): Snapshot {
  if (!value || typeof value !== "object") return EMPTY;
  const raw = value as Partial<Snapshot>;
  return {
    metrics: { ...EMPTY.metrics, ...(raw.metrics ?? {}) },
    features: Array.isArray(raw.features) ? raw.features : [],
    control: { ...EMPTY.control, ...(raw.control ?? {}) },
    audit: Array.isArray(raw.audit) ? raw.audit : [],
  };
}

const stateMeta: Record<FeatureState, { label: string; className: string }> = {
  hidden: { label: "Oculta", className: "bg-secondary text-muted-foreground" },
  pilot: { label: "Piloto", className: "bg-habit-wash text-habit-ink" },
  public: { label: "Pública", className: "bg-weight-wash text-weight-ink" },
};

const actionLabels: Record<string, string> = {
  feature_state: "Audiencia de función",
  weight_model_mode: "Canal del modelo",
  announcement: "Aviso de plataforma",
  user_status: "Estado de cuenta",
  user_role: "Rol de cuenta",
};

export function AdminConsole({ initialSnapshot, initialUsers, initialHealth, initialError }: { initialSnapshot: unknown; initialUsers: AdminUser[]; initialHealth: unknown; initialError: string | null }) {
  const [snapshot, setSnapshot] = React.useState(() => normalizeSnapshot(initialSnapshot));
  const [users, setUsers] = React.useState<AdminUser[]>(initialUsers);
  const [health, setHealth] = React.useState<Health>(() => initialHealth && typeof initialHealth === "object"
    ? { windowHours: 24, total: 0, errors: 0, byEvent: {}, latestBuild: null, ...(initialHealth as Partial<Health>) }
    : { windowHours: 24, total: 0, errors: 0, byEvent: {}, latestBuild: null });
  const [query, setQuery] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [setupError, setSetupError] = React.useState(initialError);
  const [announcementText, setAnnouncementText] = React.useState(snapshot.control.announcementText);
  const [announcementEnabled, setAnnouncementEnabled] = React.useState(snapshot.control.announcementEnabled);
  const [supabase] = React.useState(() => createClient());
  const router = useRouter();
  const refresh = React.useCallback(async (search = query) => {
    setBusy("refresh");
    const [{ data: nextSnapshot, error: snapshotError }, { data: nextUsers, error: usersError }, { data: nextHealth }] = await Promise.all([
      supabase.rpc("ritmo_admin_snapshot"),
      supabase.rpc("ritmo_admin_users", { p_search: search.trim(), p_limit: 50, p_offset: 0 }),
      supabase.rpc("ritmo_admin_health"),
    ]);
    const error = snapshotError ?? usersError;
    if (error) {
      setSetupError(error.message);
      toast.error("No se pudo actualizar la administración");
    } else {
      const normalized = normalizeSnapshot(nextSnapshot);
      setSnapshot(normalized);
      setUsers(Array.isArray(nextUsers) ? nextUsers as AdminUser[] : []);
      if (nextHealth && typeof nextHealth === "object") {
        setHealth({ windowHours: 24, total: 0, errors: 0, byEvent: {}, latestBuild: null, ...(nextHealth as Partial<Health>) });
      }
      setAnnouncementText(normalized.control.announcementText);
      setAnnouncementEnabled(normalized.control.announcementEnabled);
      setSetupError(null);
    }
    setBusy(null);
  }, [query, supabase]);

  async function command(commandValue: Record<string, unknown>, operation: string) {
    setBusy(operation);
    const { error } = await supabase.rpc("ritmo_admin_command", { p_command: commandValue });
    if (error) toast.error(error.message || "No se pudo aplicar el cambio");
    else {
      toast.success("Cambio aplicado y registrado");
      await refresh();
      router.refresh();
    }
    setBusy(null);
  }

  if (setupError) return <SetupState detail={setupError} onRetry={() => void refresh()} busy={busy === "refresh"} />;

  const metrics = snapshot.metrics;
  const nutritionEnabled = snapshot.features.find((feature) => feature.key === "nutrition_engine")?.state !== "hidden";
  return (
    <Tabs defaultValue="overview" className="min-w-0 gap-5">
      <div className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        <TabsList className="h-11 min-w-max rounded-xl border border-border/70 bg-card p-1 shadow-sm">
          <TabsTrigger value="overview" className="px-3"><Activity />Resumen</TabsTrigger>
          <TabsTrigger value="users" className="px-3"><UsersRound />Usuarios</TabsTrigger>
          <TabsTrigger value="features" className="px-3"><Sparkles />Funciones</TabsTrigger>
          <TabsTrigger value="models" className="px-3"><Bot />Modelos</TabsTrigger>
          <TabsTrigger value="audit" className="px-3"><History />Registro</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="overview" className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <AdminMetric label="Cuentas" value={metrics.users} detail={`${metrics.onboarded} configuradas`} icon={UsersRound} />
          <AdminMetric label="Activas" value={metrics.active30} detail="últimos 30 días" icon={Activity} />
          <AdminMetric label="Piloto" value={metrics.pilots} detail="audiencia previa" icon={FlaskConical} />
          <AdminMetric label="Incidencias" value={metrics.suspended} detail={metrics.suspended ? "cuentas suspendidas" : "sin bloqueos"} icon={CircleAlert} warning={metrics.suspended > 0} />
        </div>
        <div className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
          <Card className="gap-0 overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-border px-4 py-4 sm:px-5"><div><h2 className="text-sm font-semibold">Estado de plataforma</h2><p className="mt-0.5 text-xs text-muted-foreground">Las fronteras que protegen la operación diaria.</p></div><Badge className="bg-weight-wash text-weight-ink">Operativa</Badge></div>
            <StatusRow icon={LockKeyhole} title="Datos de salud aislados" detail="La administración no consulta comidas, peso, hábitos ni medidas." />
            <StatusRow icon={ShieldCheck} title={`${metrics.admins} ${metrics.admins === 1 ? "administrador" : "administradores"}`} detail="Todas las acciones sensibles quedan registradas." />
            <StatusRow icon={Bot} title={nutritionEnabled ? "Nutrición operativa" : "Nutrición pausada"} detail={nutritionEnabled ? "Motor local activo, sin proveedores externos ni facturación." : "Parada de emergencia activa; los borradores se conservan."} warning={!nutritionEnabled} />
            <StatusRow icon={Sparkles} title={`${snapshot.features.filter((item) => item.state === "public").length} funciones públicas`} detail={`${snapshot.features.filter((item) => item.state === "pilot").length} en piloto · ${snapshot.features.filter((item) => item.state === "hidden").length} ocultas`} last />
          </Card>
          <Card className="gap-4 p-4 sm:p-5">
            <div><p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Acción recomendada</p><h2 className="mt-2 font-display text-xl font-bold">Prueba antes de publicar</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">El Laboratorio modifica solo tu experiencia. Después publica cada módulo para pilotos o para todo RITMO.</p></div>
            <Button asChild className="w-full justify-between"><Link href="/laboratorio"><span className="flex items-center gap-2"><Beaker className="size-4" />Abrir laboratorio</span><ChevronRight className="size-4" /></Link></Button>
          </Card>
        </div>
        <Card className="gap-0 overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-border px-4 py-3.5 sm:px-5"><div><h2 className="text-sm font-semibold">Señales técnicas · 24 h</h2><p className="mt-0.5 text-xs text-muted-foreground">Eventos anónimos con consentimiento; nunca incluyen comida, peso, correo ni identificador.</p></div><Badge variant="outline">{health.total} señales</Badge></div>
          <div className="grid sm:grid-cols-3">
            <HealthSignal label="Autenticación" count={health.byEvent.auth ?? 0} />
            <HealthSignal label="Sincronización" count={health.byEvent.sync ?? 0} />
            <HealthSignal label="Nutrición" count={health.byEvent.nutrition ?? 0} />
          </div>
        </Card>
        <AnnouncementEditor enabled={announcementEnabled} text={announcementText} setEnabled={setAnnouncementEnabled} setText={setAnnouncementText} busy={busy === "announcement"} save={() => void command({ type: "announcement", enabled: announcementEnabled, text: announcementText }, "announcement")} />
      </TabsContent>

      <TabsContent value="users" className="space-y-4">
        <Card className="gap-4 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-base font-semibold">Acceso y roles</h2><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Correos protegidos por defecto; nunca se muestran registros personales de salud.</p></div><Badge variant="outline">{metrics.users} cuentas</Badge></div>
          <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void refresh(query); }}><div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por correo exacto" className="h-11 pl-9" /></div><Button type="submit" variant="secondary" disabled={busy === "refresh"}><RefreshCw className={cn("size-4", busy === "refresh" && "animate-spin")} /><span className="hidden sm:inline">Actualizar</span></Button></form>
        </Card>
        <Card className="gap-0 overflow-hidden p-0">
          {users.length ? users.map((user) => <UserRow key={user.user_id} user={user} busy={busy === user.user_id} onStatus={(status) => void command({ type: "user_status", userId: user.user_id, value: status }, user.user_id)} onRole={(role) => void command({ type: "user_role", userId: user.user_id, value: role }, user.user_id)} />) : <div className="p-8 text-center"><UserRoundCog className="mx-auto size-6 text-muted-foreground" /><p className="mt-3 text-sm font-semibold">No hay cuentas que coincidan</p><p className="mt-1 text-xs text-muted-foreground">Prueba con el correo completo o limpia la búsqueda.</p></div>}
        </Card>
      </TabsContent>

      <TabsContent value="features" className="space-y-4">
        <Card className="gap-0 overflow-hidden p-0">
          <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"><div><h2 className="text-base font-semibold">Publicación progresiva</h2><p className="mt-1 text-sm text-muted-foreground">Oculta, prueba con la cohorte piloto o publica. El cambio afecta a la siguiente carga.</p></div><Button asChild variant="secondary" size="sm"><Link href="/laboratorio"><Beaker className="size-4" />Probar módulos</Link></Button></div>
          {snapshot.features.map((feature) => <FeatureRow key={feature.key} feature={feature} busy={busy === feature.key} onChange={(state) => void command({ type: "feature_state", key: feature.key, value: state }, feature.key)} />)}
        </Card>
        <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><EyeOff className="mt-0.5 size-4 shrink-0" />“Oculta” desactiva el módulo aunque una persona lo tuviera habilitado localmente. “Piloto” lo limita a administradores y cuentas piloto.</p>
      </TabsContent>

      <TabsContent value="models" className="space-y-4">
        <Card className="gap-0 overflow-hidden p-0">
          <div className="border-b border-border px-4 py-4 sm:px-5"><h2 className="text-base font-semibold">Canal de predicción de peso</h2><p className="mt-1 text-sm text-muted-foreground">Control global efectivo en Hoy, Hábitos, Nutrición y Progreso.</p></div>
          <div className="grid gap-2 p-3 sm:grid-cols-3 sm:p-4">
            <ModelChoice title="Automático" detail="Promueve o revierte usando MAE y cobertura reales." active={snapshot.control.weightModelMode === "automatic"} disabled={Boolean(busy)} onClick={() => void command({ type: "weight_model_mode", value: "automatic" }, "model")} />
            <ModelChoice title="Estable" detail={VERSION_MODELO_ESTABLE} active={snapshot.control.weightModelMode === "stable"} disabled={Boolean(busy)} onClick={() => void command({ type: "weight_model_mode", value: "stable" }, "model")} />
            <ModelChoice title="Candidato" detail={VERSION_MODELO_CANDIDATO} active={snapshot.control.weightModelMode === "candidate"} disabled={Boolean(busy)} warning onClick={() => void command({ type: "weight_model_mode", value: "candidate" }, "model")} />
          </div>
        </Card>
        <div className="grid gap-4 md:grid-cols-2">
          <GovernanceCard icon={Bot} title="Peso" status="Auditado" detail="Dos versiones emiten predicciones selladas. El modo automático solo promociona con mejora suficiente y puede revertir." />
          <GovernanceCard icon={FlaskConical} title="Nutrición" status="Local" detail="Catálogo trazable, correcciones confirmadas y recomprobación por macros. Los proveedores externos permanecen bloqueados." />
        </div>
      </TabsContent>

      <TabsContent value="audit">
        <Card className="gap-0 overflow-hidden p-0">
          <div className="border-b border-border px-4 py-4 sm:px-5"><h2 className="text-base font-semibold">Registro administrativo</h2><p className="mt-1 text-sm text-muted-foreground">Quién cambió qué y cuándo, sin copiar datos personales.</p></div>
          {snapshot.audit.length ? <ol className="divide-y divide-border">{snapshot.audit.map((entry) => <AuditRow key={entry.id} entry={entry} />)}</ol> : <div className="p-8 text-center"><History className="mx-auto size-6 text-muted-foreground" /><p className="mt-3 text-sm font-semibold">Aún no hay cambios</p><p className="mt-1 text-xs text-muted-foreground">La primera operación aparecerá aquí.</p></div>}
        </Card>
      </TabsContent>
    </Tabs>
  );
}

function AdminMetric({ label, value, detail, icon: Icon, warning = false }: { label: string; value: number; detail: string; icon: typeof Activity; warning?: boolean }) {
  return <Card className="gap-3 p-4 sm:p-5"><div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p><span className={cn("grid size-8 place-items-center rounded-lg", warning ? "bg-warning-wash text-warning" : "bg-primary/8 text-primary")}><Icon className="size-4" /></span></div><div><p className="font-display text-3xl font-bold leading-none tabular-nums">{value}</p><p className="mt-1.5 text-xs text-muted-foreground">{detail}</p></div></Card>;
}

function HealthSignal({ label, count }: { label: string; count: number }) {
  return <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3.5 last:border-0 sm:border-b-0 sm:border-r sm:last:border-r-0 sm:px-5"><div><p className="text-sm font-semibold">{label}</p><p className="mt-0.5 text-xs text-muted-foreground">{count ? "Requiere seguimiento" : "Sin incidencias recibidas"}</p></div><span className={cn("font-display text-2xl font-bold tabular-nums", count ? "text-warning" : "text-primary")}>{count}</span></div>;
}

function StatusRow({ icon: Icon, title, detail, last = false, warning = false }: { icon: typeof Activity; title: string; detail: string; last?: boolean; warning?: boolean }) {
  return <div className={cn("flex items-start gap-3 px-4 py-3.5 sm:px-5", !last && "border-b border-border")}><span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", warning ? "bg-warning-wash text-warning" : "bg-primary/8 text-primary")}><Icon className="size-4" /></span><div><p className="text-sm font-semibold">{title}</p><p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{detail}</p></div>{warning ? <CircleAlert className="ml-auto mt-1 size-4 text-warning" /> : <Check className="ml-auto mt-1 size-4 text-primary" />}</div>;
}

function AnnouncementEditor({ enabled, text, setEnabled, setText, save, busy }: { enabled: boolean; text: string; setEnabled: (value: boolean) => void; setText: (value: string) => void; save: () => void; busy: boolean }) {
  return <Card className="gap-4 p-4 sm:p-5"><div className="flex items-start justify-between gap-4"><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-habit-wash text-habit-ink"><Megaphone className="size-4" /></span><div><h2 className="text-sm font-semibold">Aviso de plataforma</h2><p className="mt-0.5 text-xs text-muted-foreground">Mensaje breve visible sobre la aplicación; úsalo solo cuando haya algo accionable.</p></div></div><Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Activar aviso" /></div><div className="flex flex-col gap-2 sm:flex-row"><Input value={text} onChange={(event) => setText(event.target.value.slice(0, 180))} placeholder="Ej. Mantenimiento previsto el domingo a las 09:00" className="h-11 flex-1" /><Button onClick={save} disabled={busy || (enabled && !text.trim())}>{busy ? "Guardando…" : "Guardar aviso"}</Button></div><p className="text-right text-[0.68rem] tabular-nums text-muted-foreground">{text.length}/180</p></Card>;
}

function UserRow({ user, busy, onStatus, onRole }: { user: AdminUser; busy: boolean; onStatus: (status: "active" | "suspended") => void; onRole: (role: "admin" | "pilot" | "user") => void }) {
  const joined = new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(user.created_at));
  const last = user.last_sign_in_at ? new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(user.last_sign_in_at)) : "nunca";
  return <div className="grid gap-3 border-b border-border px-4 py-4 last:border-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5"><div className="flex min-w-0 items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-muted-foreground"><UserCheck className="size-4" /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-semibold">{user.email_masked}</p><Badge variant="outline" className="capitalize">{user.role === "user" ? "usuario" : user.role}</Badge>{user.is_self && <Badge className="bg-primary/8 text-primary">Tú</Badge>}{user.status === "suspended" && <Badge variant="destructive">Suspendida</Badge>}</div><p className="mt-1 text-xs text-muted-foreground">{user.provider} · alta {joined} · último acceso {last} · {user.onboarding_complete ? "configurada" : "sin completar"}</p></div></div><div className="flex flex-wrap gap-2 sm:justify-end"><select aria-label={`Rol de ${user.email_masked}`} value={user.role} disabled={busy || user.is_self} onChange={(event) => onRole(event.target.value as AdminUser["role"])} className="h-10 rounded-lg border border-input bg-background px-3 text-xs font-medium disabled:opacity-60"><option value="user">Usuario</option><option value="pilot">Piloto</option><option value="admin">Admin</option></select><Button variant={user.status === "suspended" ? "secondary" : "outline"} size="sm" disabled={busy || user.role === "admin" || user.is_self} onClick={() => { const next = user.status === "suspended" ? "active" : "suspended"; if (next === "active" || window.confirm("¿Suspender temporalmente esta cuenta? Podrás restaurarla después.")) onStatus(next); }}>{busy ? "Aplicando…" : user.status === "suspended" ? "Restaurar" : "Suspender"}</Button></div></div>;
}

function FeatureRow({ feature, busy, onChange }: { feature: Feature; busy: boolean; onChange: (state: FeatureState) => void }) {
  return <div className="grid gap-3 border-b border-border px-4 py-4 last:border-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5"><div><div className="flex items-center gap-2"><p className="text-sm font-semibold">{feature.label}</p><span className={cn("rounded-md px-2 py-0.5 text-[0.65rem] font-semibold", stateMeta[feature.state].className)}>{stateMeta[feature.state].label}</span></div><p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">{feature.description}</p></div><div className="grid grid-cols-3 rounded-xl bg-secondary p-1">{(["hidden","pilot","public"] as const).map((state) => <button key={state} type="button" disabled={busy} aria-pressed={feature.state === state} onClick={() => onChange(state)} className={cn("h-9 rounded-lg px-2.5 text-xs font-medium transition-colors disabled:opacity-50", feature.state === state ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{stateMeta[state].label}</button>)}</div></div>;
}

function ModelChoice({ title, detail, active, warning = false, disabled, onClick }: { title: string; detail: string; active: boolean; warning?: boolean; disabled: boolean; onClick: () => void }) {
  return <button type="button" aria-pressed={active} disabled={disabled} onClick={onClick} className={cn("min-h-28 rounded-xl border p-3 text-left transition-[border-color,background-color,box-shadow] disabled:opacity-50", active ? warning ? "border-warning-border bg-warning-wash shadow-sm" : "border-primary/35 bg-primary/8 shadow-sm" : "border-border bg-background hover:bg-secondary/45")}><span className="flex items-center justify-between text-sm font-semibold">{title}{active && <Check className={cn("size-4", warning ? "text-warning" : "text-primary")} />}</span><span className="mt-2 block break-all text-xs leading-relaxed text-muted-foreground">{detail}</span></button>;
}

function GovernanceCard({ icon: Icon, title, status, detail }: { icon: typeof Bot; title: string; status: string; detail: string }) {
  return <Card className="gap-3 p-4 sm:p-5"><div className="flex items-center justify-between"><span className="grid size-9 place-items-center rounded-xl bg-body-wash text-body-ink"><Icon className="size-4" /></span><Badge variant="outline">{status}</Badge></div><div><h3 className="text-sm font-semibold">Modelo de {title.toLowerCase()}</h3><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</p></div></Card>;
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  const when = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.createdAt));
  const detail = Object.entries(entry.metadata ?? {}).map(([key, value]) => `${key}: ${String(value)}`).join(" · ");
  return <li className="grid gap-1 px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-5"><div><p className="text-sm font-semibold">{actionLabels[entry.action] ?? entry.action}</p><p className="mt-0.5 text-xs text-muted-foreground">{entry.actor}{entry.target && entry.target !== "cuenta protegida" ? ` → ${entry.target}` : ""}{detail ? ` · ${detail}` : ""}</p></div><time className="text-xs tabular-nums text-muted-foreground">{when}</time></li>;
}

function SetupState({ detail, onRetry, busy }: { detail: string; onRetry: () => void; busy: boolean }) {
  return <Card className="mx-auto w-full max-w-2xl gap-4 p-5 sm:p-6"><span className="grid size-10 place-items-center rounded-xl bg-warning-wash text-warning"><CircleAlert className="size-5" /></span><div><h2 className="font-display text-xl font-bold">Falta activar la base administrativa</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">La interfaz y el acceso privado están preparados. Aplica la última migración de Supabase para habilitar usuarios, lanzamientos y auditoría.</p></div><details className="rounded-xl bg-secondary/55 px-3 py-2 text-xs text-muted-foreground"><summary className="cursor-pointer font-medium text-foreground">Detalle técnico</summary><p className="mt-2 break-words">{detail}</p></details><Button onClick={onRetry} disabled={busy} className="w-full sm:w-auto"><RefreshCw className={cn("size-4", busy && "animate-spin")} />{busy ? "Comprobando…" : "Comprobar de nuevo"}</Button></Card>;
}
