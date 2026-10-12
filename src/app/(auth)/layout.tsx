import Link from "next/link";
import { redirect } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { usuarioAtual } from "@/lib/auth";
import { AlternarTema } from "@/components/tema";

export default async function LayoutAuth({ children }: { children: React.ReactNode }) {
  if (await usuarioAtual()) redirect("/painel");
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
          <GraduationCap className="h-6 w-6 text-marca-600" /> Concurso Boy
        </Link>
        <AlternarTema />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
