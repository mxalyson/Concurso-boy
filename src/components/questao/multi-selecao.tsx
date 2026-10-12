"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type OpcaoSelecao = { valor: string; rotulo: string; detalhe?: string | number; nivel?: number; cor?: string };

export function MultiSelecao({
  rotulo,
  opcoes,
  selecionados,
  onChange,
  unico = false,
  placeholder = "Todos",
}: {
  rotulo: string;
  opcoes: OpcaoSelecao[];
  selecionados: string[];
  onChange: (valores: string[]) => void;
  unico?: boolean;
  placeholder?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fechar = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, []);

  const filtradas = useMemo(() => {
    const termo = busca
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();
    if (!termo) return opcoes;
    return opcoes.filter((o) =>
      o.rotulo
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .includes(termo),
    );
  }, [busca, opcoes]);

  const alternar = (valor: string) => {
    if (unico) {
      onChange(selecionados[0] === valor ? [] : [valor]);
      setAberto(false);
      return;
    }
    onChange(selecionados.includes(valor) ? selecionados.filter((v) => v !== valor) : [...selecionados, valor]);
  };

  const resumo =
    selecionados.length === 0
      ? placeholder
      : selecionados.length === 1
        ? (opcoes.find((o) => o.valor === selecionados[0])?.rotulo ?? "1 selecionado")
        : `${selecionados.length} selecionados`;

  return (
    <div className="relative" ref={ref}>
      <span className="rotulo">{rotulo}</span>
      <button
        type="button"
        onClick={() => setAberto(!aberto)}
        className={cn("campo flex items-center justify-between gap-2 text-left", selecionados.length > 0 && "border-marca-400 dark:border-marca-700")}
      >
        <span className={cn("truncate", selecionados.length === 0 && "text-slate-400")}>{resumo}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>
      {aberto && (
        <div className="absolute z-30 mt-1 w-full min-w-64 rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {opcoes.length > 8 && (
            <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 dark:border-slate-800">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                autoFocus
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar..."
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
          )}
          <ul className="max-h-72 overflow-y-auto py-1">
            {filtradas.length === 0 && <li className="px-3 py-2 text-sm text-slate-400">Nenhuma opção</li>}
            {filtradas.map((o) => {
              const marcado = selecionados.includes(o.valor);
              return (
                <li key={o.valor}>
                  <button
                    type="button"
                    onClick={() => alternar(o.valor)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                    style={{ paddingLeft: `${0.75 + (o.nivel ?? 0) * 1}rem` }}
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                        marcado ? "border-marca-600 bg-marca-600 text-white" : "border-slate-300 dark:border-slate-600",
                        unico && "rounded-full",
                      )}
                    >
                      {marcado && <Check className="h-3 w-3" />}
                    </span>
                    {o.cor && <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: o.cor }} />}
                    <span className="flex-1 truncate">{o.rotulo}</span>
                    {o.detalhe !== undefined && <span className="text-xs text-slate-400">{o.detalhe}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
          {selecionados.length > 0 && (
            <div className="border-t border-slate-100 px-3 py-2 text-right dark:border-slate-800">
              <button type="button" onClick={() => onChange([])} className="text-xs text-marca-600 hover:underline">
                Limpar seleção
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
