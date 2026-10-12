"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ABAS = [
  { href: "/admin", rotulo: "Visão geral" },
  { href: "/admin/questoes", rotulo: "Questões" },
  { href: "/admin/importar", rotulo: "Importar provas" },
  { href: "/admin/taxonomia", rotulo: "Disciplinas e assuntos" },
  { href: "/admin/reportes", rotulo: "Notificações de erro" },
  { href: "/admin/usuarios", rotulo: "Usuários" },
];

export function AbasAdmin() {
  const caminho = usePathname();
  return (
    <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
      {ABAS.map((a) => {
        const ativo = a.href === "/admin" ? caminho === "/admin" : caminho.startsWith(a.href);
        return (
          <Link
            key={a.href}
            href={a.href}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium",
              ativo ? "border-marca-600 text-marca-700 dark:text-marca-300" : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200",
            )}
          >
            {a.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
