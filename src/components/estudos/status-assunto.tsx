"use client";

import { useState, useTransition } from "react";
import { alterarStatusAssunto } from "@/app/actions/estudos";
import type { StatusAssunto } from "@/lib/estudos";
import { cn } from "@/lib/utils";

const OPCOES: { valor: StatusAssunto; rotulo: string; classe: string }[] = [
  { valor: "nao_iniciado", rotulo: "Não iniciado", classe: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
  { valor: "estudando", rotulo: "Estudando", classe: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  { valor: "concluido", rotulo: "Concluído", classe: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
];

export function StatusAssuntoSelect({ assuntoId, status }: { assuntoId: number; status: StatusAssunto }) {
  const [atual, setAtual] = useState(status);
  const [pendente, iniciar] = useTransition();
  const opcao = OPCOES.find((o) => o.valor === atual) ?? OPCOES[0];
  return (
    <select
      value={atual}
      disabled={pendente}
      onChange={(e) => {
        const novo = e.target.value as StatusAssunto;
        setAtual(novo);
        iniciar(() => alterarStatusAssunto(assuntoId, novo));
      }}
      className={cn("cursor-pointer rounded-md border-0 px-2 py-1 text-xs font-medium outline-none", opcao.classe)}
      aria-label="Status do assunto"
    >
      {OPCOES.map((o) => (
        <option key={o.valor} value={o.valor}>
          {o.rotulo}
        </option>
      ))}
    </select>
  );
}
