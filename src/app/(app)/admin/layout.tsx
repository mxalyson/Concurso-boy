import { Shield } from "lucide-react";
import { exigirAdmin } from "@/lib/auth";
import { AbasAdmin } from "@/components/admin/abas-admin";

export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  await exigirAdmin();
  return (
    <>
      <div className="mb-4 flex items-center gap-2 text-2xl font-bold">
        <Shield className="h-6 w-6 text-marca-600" /> Administração
      </div>
      <AbasAdmin />
      {children}
    </>
  );
}
