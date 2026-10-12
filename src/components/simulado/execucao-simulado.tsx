"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Clock, Flag, Send } from "lucide-react";
import { finalizarSimulado, salvarRespostaSimulado } from "@/app/actions/simulados";
import type { QuestaoResumo } from "@/lib/questoes";
import { cn } from "@/lib/utils";
import { Botao } from "../ui";

type Item = { ordem: number; questao: QuestaoResumo; resposta: string | null };

function formatarTempo(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const seg = s % 60;
  return `${h > 0 ? `${h}:` : ""}${String(m).padStart(2, "0")}:${String(seg).padStart(2, "0")}`;
}

export function ExecucaoSimulado({ id, titulo, prazo, itens: iniciais }: { id: number; titulo: string; prazo: number; itens: Item[] }) {
  const [itens, setItens] = useState(iniciais);
  const [atual, setAtual] = useState(() => Math.max(0, iniciais.findIndex((i) => !i.resposta)));
  const [marcadas, setMarcadas] = useState<Set<number>>(new Set());
  const [restante, setRestante] = useState(prazo - Date.now());
  const [finalizando, iniciar] = useTransition();
  const finalizou = useRef(false);

  const finalizar = () => {
    if (finalizou.current) return;
    finalizou.current = true;
    iniciar(() => finalizarSimulado(id));
  };

  useEffect(() => {
    const t = setInterval(() => {
      const r = prazo - Date.now();
      setRestante(r);
      if (r <= 0) {
        clearInterval(t);
        finalizar();
      }
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prazo]);

  const item = itens[atual];
  const q = item.questao;
  const respondidas = itens.filter((i) => i.resposta).length;
  const opcoes = q.tipo === "certo_errado" ? [{ letra: "C", texto: "Certo" }, { letra: "E", texto: "Errado" }] : q.alternativas;

  const responder = (letra: string) => {
    const nova = item.resposta === letra ? null : letra;
    setItens(itens.map((i, k) => (k === atual ? { ...i, resposta: nova } : i)));
    void salvarRespostaSimulado(id, item.ordem, nova);
  };

  const alternarMarca = () => {
    const nova = new Set(marcadas);
    if (nova.has(item.ordem)) nova.delete(item.ordem);
    else nova.add(item.ordem);
    setMarcadas(nova);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">{titulo}</h1>
          <span className="text-sm text-slate-500">
            Questão {atual + 1} de {itens.length}
          </span>
        </div>
        <article className="cartao p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: q.disciplina_cor }} />
            <span className="font-medium text-slate-700 dark:text-slate-300">{q.disciplina_nome}</span>
            {q.assunto_nome && <span>› {q.assunto_nome}</span>}
            {q.banca && <span>· {q.banca}</span>}
            {q.ano && <span>· {q.ano}</span>}
          </div>
          {q.texto_base && (
            <div className="texto-questao mb-4 max-h-80 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-950/50">
              {q.texto_base}
            </div>
          )}
          <div className="texto-questao mb-4 text-[15px]">{q.enunciado}</div>
          <div className={q.tipo === "certo_errado" ? "flex gap-2" : "space-y-2"}>
            {opcoes.map((a) => (
              <button
                key={a.letra}
                onClick={() => responder(a.letra)}
                className={cn(
                  "flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition",
                  q.tipo === "certo_errado" ? "min-w-32 justify-center font-semibold" : "w-full",
                  item.resposta === a.letra
                    ? "border-marca-500 bg-marca-50 ring-1 ring-marca-500 dark:bg-marca-950/40"
                    : "border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50",
                )}
              >
                {q.tipo === "multipla" && (
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                      item.resposta === a.letra ? "border-marca-500 bg-marca-500 text-white" : "border-slate-300 dark:border-slate-600",
                    )}
                  >
                    {a.letra}
                  </span>
                )}
                <span className="texto-questao pt-0.5">{a.texto}</span>
              </button>
            ))}
          </div>
        </article>
        <div className="flex items-center justify-between">
          <Botao variante="secundario" onClick={() => setAtual(Math.max(0, atual - 1))} disabled={atual === 0}>
            <ChevronLeft className="h-4 w-4" /> Anterior
          </Botao>
          <Botao variante="fantasma" onClick={alternarMarca}>
            <Flag className={cn("h-4 w-4", marcadas.has(item.ordem) && "fill-amber-400 text-amber-500")} />
            {marcadas.has(item.ordem) ? "Desmarcar" : "Marcar p/ revisar"}
          </Botao>
          <Botao variante="secundario" onClick={() => setAtual(Math.min(itens.length - 1, atual + 1))} disabled={atual === itens.length - 1}>
            Próxima <ChevronRight className="h-4 w-4" />
          </Botao>
        </div>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <div className={cn("cartao p-4 text-center", restante < 5 * 60_000 && "border-rose-300 bg-rose-50 dark:bg-rose-950/30")}>
          <p className="flex items-center justify-center gap-1.5 text-xs uppercase tracking-wide text-slate-500">
            <Clock className="h-3.5 w-3.5" /> Tempo restante
          </p>
          <p className={cn("mt-1 font-mono text-3xl font-bold", restante < 5 * 60_000 && "text-rose-600")}>{formatarTempo(restante)}</p>
        </div>
        <div className="cartao p-4">
          <p className="mb-3 text-sm font-medium">
            Respondidas: {respondidas}/{itens.length}
          </p>
          <div className="grid grid-cols-6 gap-1.5">
            {itens.map((i, k) => (
              <button
                key={i.ordem}
                onClick={() => setAtual(k)}
                className={cn(
                  "relative h-8 rounded text-xs font-semibold",
                  k === atual && "ring-2 ring-marca-500",
                  i.resposta ? "bg-marca-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
                )}
              >
                {i.ordem}
                {marcadas.has(i.ordem) && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-400" />}
              </button>
            ))}
          </div>
        </div>
        <Botao
          variante="sucesso"
          className="w-full"
          disabled={finalizando}
          onClick={() => {
            const brancos = itens.length - respondidas;
            if (brancos === 0 || confirm(`Você deixou ${brancos} questão(ões) em branco. Finalizar mesmo assim?`)) finalizar();
          }}
        >
          <Send className="h-4 w-4" /> {finalizando ? "Corrigindo..." : "Finalizar simulado"}
        </Botao>
      </aside>
    </div>
  );
}
