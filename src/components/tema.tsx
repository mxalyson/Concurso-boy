"use client";

import { Moon, Sun } from "lucide-react";

export function AlternarTema({ className }: { className?: string }) {
  const alternar = () => {
    const escuro = document.documentElement.classList.toggle("dark");
    try {
      localStorage.setItem("tema", escuro ? "escuro" : "claro");
    } catch {}
  };
  return (
    <button
      type="button"
      onClick={alternar}
      className={className ?? "rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"}
      aria-label="Alternar tema claro/escuro"
      title="Alternar tema"
    >
      <Sun className="hidden h-5 w-5 dark:block" />
      <Moon className="h-5 w-5 dark:hidden" />
    </button>
  );
}
