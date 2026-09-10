import { requireAdmin } from "@/lib/admin/auth";
import { LaboratoryClient } from "@/components/admin/laboratory-client";

export default async function LaboratorioPage() {
  await requireAdmin();
  return <LaboratoryClient />;
}
