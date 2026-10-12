"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  BookOpen,
  CalendarClock,
  ClipboardList,
  FileStack,
  GraduationCap,
  Layers,
  LayoutDashboard,
  ListChecks,
  ScrollText,
  LogOut,
  Menu,
  RotateCcw,
  Settings,
  Shield,
  Timer,
  User,
  X,
} from "lucide-react";
import { sair } from "@/app/actions/auth";
import { AlternarTema } from "./tema";
import { cn } from "@/lib/utils";

const GRUPOS = [
  { titulo: null, itens: [{ href: "/painel", rotulo: "Painel", icone: LayoutDashboard }] },
  {
    titulo: "Questões",
    itens: [
      { href: "/questoes", rotulo: "Banco de questões", icone: ListChecks },
      { href: "/provas", rotulo: "Provas", icone: ScrollText },
      { href: "/cadernos", rotulo: "Cadernos", icone: FileStack },
      { href: "/simulados", rotulo: "Simulados", icone: ClipboardList },
      { href: "/revisoes", rotulo: "Revisões", icone: RotateCcw },
    ],
  },
  {
    titulo: "Estudos",
    itens: [
      { href: "/estudos", rotulo: "Disciplinas e teoria", icone: BookOpen },
      { href: "/plano", rotulo: "Plano e ciclo", icone: CalendarClock },
      { href: "/foco", rotulo: "Cronômetro", icone: Timer },
      { href: "/flashcards", rotulo: "Flashcards", icone: Layers },
    ],
  },
  { titulo: "Análise", itens: [{ href: "/desempenho", rotulo: "Desempenho", icone: BarChart3 }] },
];

export function MenuLateral({ nome, admin, pendencias }: { nome: string; admin: boolean; pendencias: number }) {
  const caminho = usePathname();
  const [aberto, setAberto] = useState(false);
  useEffect(() => setAberto(false), [caminho]);

  const grupos = admin
    ? [...GRUPOS, { titulo: "Administração", itens: [{ href: "/admin", rotulo: "Painel admin", icone: Shield }] }]
    : GRUPOS;

  const ativo = (href: string) => caminho === href || caminho.startsWith(href + "/");

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-950/90">
        <Link href="/painel" className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
          <GraduationCap className="h-6 w-6 text-marca-600" /> Concurso Boy
        </Link>
        <div className="flex items-center gap-1">
          <AlternarTema />
          <button className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setAberto(true)} aria-label="Abrir menu">
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {aberto && <div className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden" onClick={() => setAberto(false)} />}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform dark:border-slate-800 dark:bg-slate-950",
          aberto ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <Link href="/painel" className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-marca-600 text-white">
              <GraduationCap className="h-5 w-5" />
            </span>
            Concurso Boy
          </Link>
          <button className="rounded-lg p-1.5 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800" onClick={() => setAberto(false)} aria-label="Fechar menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
          {grupos.map((g, i) => (
            <div key={i}>
              {g.titulo && <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">{g.titulo}</p>}
              <ul className="space-y-0.5">
                {g.itens.map(({ href, rotulo, icone: Icone }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                        ativo(href)
                          ? "bg-marca-50 text-marca-700 dark:bg-marca-900/40 dark:text-marca-300"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100",
                      )}
                    >
                      <Icone className="h-4 w-4" />
                      <span className="flex-1">{rotulo}</span>
                      {href === "/revisoes" && pendencias > 0 && (
                        <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">{pendencias}</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-200 p-3 dark:border-slate-800">
          <div className="flex items-center gap-2 px-2 py-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <User className="h-4 w-4" />
            </div>
            <span className="flex-1 truncate text-sm font-medium">{nome}</span>
            <span className="hidden lg:block">
              <AlternarTema />
            </span>
          </div>
          <div className="mt-1 flex gap-1">
            <Link
              href="/conta"
              className="flex flex-1 items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900"
            >
              <Settings className="h-4 w-4" /> Conta
            </Link>
            <form action={sair}>
              <button className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900">
                <LogOut className="h-4 w-4" /> Sair
              </button>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}
