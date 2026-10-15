"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { PartyPopper, RotateCcw } from "lucide-react";
import { revisarFlashcard } from "@/app/actions/estudos";
import { previsaoIntervalos, type NotaFlashcard } from "@/lib/srs";
import { cn } from "@/lib/utils";
import { BarraProgresso, LinkBotao } from "../ui";

type Carta = { id: number; frente: string; verso: string; deck: string; facilidade: number; intervalo: number; repeticoes: number };

const BOTOES: { nota: NotaFlashcard; rotulo: string; classe: string }[] = [
  { nota: 0, rotulo: "Errei", classe: "bg-rose-600 hover:bg-rose-700" },
  { nota: 1, rotulo: "Difícil", classe: "bg-amber-500 hover:bg-amber-600" },
  { nota: 2, rotulo: "Bom", classe: "bg-emerald-600 hover:bg-emerald-700" },
  { nota: 3, rotulo: "Fácil", classe: "bg-sky-600 hover:bg-sky-700" },
];

function rotuloIntervalo(dias: number) {
  if (dias === 0) return "hoje";
  if (dias === 1) return "1 dia";
  if (dias < 30) return `${dias} dias`;
  if (dias < 365) return `${Math.round(dias / 30)} meses`;
  return `${(dias / 365).toFixed(1)} anos`;
}

export function RevisaoFlashcards({ cartas: iniciais }: { cartas: Carta[] }) {
  const [fila, setFila] = useState(iniciais);
  const [virada, setVirada] = useState(false);
  const [feitas, setFeitas] = useState(0);
  const [acertos, setAcertos] = useState(0);
  const [, iniciar] = useTransition();
  const atual = fila[0];

  const avaliar = useCallback(
    (nota: NotaFlashcard) => {
      if (!atual || !virada) return;
      iniciar(() => revisarFlashcard(atual.id, nota).then(() => undefined));
      setFeitas((n) => n + 1);
      if (nota >= 2) setAcertos((n) => n + 1);
      setVirada(false);
      // Cartas erradas voltam para o fim da fila da sessão.
      setFila((f) => (nota === 0 ? [...f.slice(1), { ...f[0], repeticoes: 0, intervalo: 0 }] : f.slice(1)));
    },
    [atual, virada],
  );

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "TEXTAREA" || (e.target as HTMLElement).tagName === "INPUT") return;
      if (e.code === "Space" || e.key === "Enter") {
        e.preventDefault();
        setVirada((v) => !v);
      } else if (["1", "2", "3", "4"].includes(e.key)) avaliar((Number(e.key) - 1) as NotaFlashcard);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [avaliar]);

  if (!atual) {
    return (
      <div className="cartao mx-auto max-w-lg p-10 text-center">
        <PartyPopper className="mx-auto mb-3 h-12 w-12 text-marca-500" />
        <h2 className="text-xl font-bold">Revisão concluída!</h2>
        <p className="mt-2 text-sm text-slate-500">
          {feitas > 0 ? `Você revisou ${feitas} cartas (${Math.round((acertos / feitas) * 100)}% de lembrança).` : "Nenhuma carta para revisar agora."}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <LinkBotao href="/flashcards" variante="secundario">
            Voltar aos baralhos
          </LinkBotao>
          <LinkBotao href="/questoes">Resolver questões</LinkBotao>
        </div>
      </div>
    );
  }

  const previsoes = previsaoIntervalos(atual);
  const total = feitas + fila.length;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center gap-3 text-sm text-slate-500">
        <BarraProgresso valor={(feitas / Math.max(1, total)) * 100} />
        <span className="shrink-0">
          {feitas}/{total}
        </span>
      </div>
      <div className="flip-card mb-6 h-80 cursor-pointer" onClick={() => setVirada(!virada)}>
        <div className={cn("flip-card-inner relative h-full w-full", virada && "virado")}>
          <div className="flip-face cartao absolute inset-0 flex flex-col p-8">
            <span className="text-xs uppercase tracking-wide text-slate-400">{atual.deck} · Frente</span>
            <div className="flex flex-1 items-center justify-center overflow-y-auto text-center text-lg font-medium whitespace-pre-line">{atual.frente}</div>
            <span className="text-center text-xs text-slate-400">Clique ou pressione espaço para ver a resposta</span>
          </div>
          <div className="flip-face flip-verso cartao absolute inset-0 flex flex-col border-marca-300 p-8 dark:border-marca-800">
            <span className="text-xs uppercase tracking-wide text-marca-500">Verso</span>
            <div className="flex flex-1 items-center justify-center overflow-y-auto text-center text-lg whitespace-pre-line">{atual.verso}</div>
          </div>
        </div>
      </div>
      {virada ? (
        <div className="grid grid-cols-4 gap-2">
          {BOTOES.map((b, i) => (
            <button key={b.nota} onClick={() => avaliar(b.nota)} className={cn("rounded-lg px-2 py-3 text-white shadow-sm transition", b.classe)}>
              <span className="block text-sm font-semibold">{b.rotulo}</span>
              <span className="block text-xs opacity-80">
                {rotuloIntervalo(previsoes[i])} · {i + 1}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <button onClick={() => setVirada(true)} className="flex w-full items-center justify-center gap-2 rounded-lg bg-marca-600 py-3 font-semibold text-white hover:bg-marca-700">
          <RotateCcw className="h-4 w-4" /> Mostrar resposta
        </button>
      )}
      <p className="mt-4 text-center text-xs text-slate-400">
        Atalhos: espaço vira a carta · 1 a 4 avaliam · <Link href="/flashcards" className="underline">sair</Link>
      </p>
    </div>
  );
}
