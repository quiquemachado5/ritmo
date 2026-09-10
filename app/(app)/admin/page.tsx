import { ShieldCheck } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { AdminConsole } from "@/components/admin/admin-console";
import { PageHeader } from "@/components/app/primitives";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { supabase } = await requireAdmin();
  const [{ data: snapshot, error: snapshotError }, { data: users, error: usersError }] = await Promise.all([
    supabase.rpc("ritmo_admin_snapshot"),
    supabase.rpc("ritmo_admin_users", { p_search: "", p_limit: 50, p_offset: 0 }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Administración"
        description="Control de plataforma, accesos y lanzamientos. Los datos personales de salud quedan fuera de este espacio."
        action={<span className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/8 px-3 py-2 text-xs font-semibold text-primary"><ShieldCheck className="size-4" /> Acceso privado</span>}
      />
      <AdminConsole
        initialSnapshot={snapshot}
        initialUsers={Array.isArray(users) ? users : []}
        initialError={snapshotError?.message ?? usersError?.message ?? null}
      />
    </div>
  );
}
