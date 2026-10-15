import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Play, Trash2 } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { db, hoje } from "@/lib/db";
import { formatarData } from "@/lib/utils";
import { excluirDeck, excluirFlashcard, importarFlashcards, salvarFlashcard } from "@/app/actions/estudos";
import { Botao, Cartao, LinkBotao, Vazio } from "@/components/ui";

export default async function PaginaDeck({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirUsuario();
  const id = Number((await params).id);
  const deck = db().prepare("SELECT id, nome FROM flashcard_decks WHERE id = ? AND usuario_id = ?").get(id, usuario.id) as
    | { id: number; nome: string }
    | undefined;
  if (!deck) notFound();
  const cartas = db()
    .prepare("SELECT id, frente, verso, vence_em, repeticoes, questao_id FROM flashcards WHERE deck_id = ? ORDER BY id DESC")
    .all(id) as { id: number; frente: string; verso: string; vence_em: string; repeticoes: number; questao_id: number | null }[];
  const vencidas = cartas.filter((c) => c.vence_em <= hoje()).length;

  return (
    <>
      <Link href="/flashcards" className="mb-4 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
        <ArrowLeft className="h-4 w-4" /> Flashcards
      </Link>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{deck.nome}</h1>
          <p className="text-sm text-slate-500">
            {cartas.length} cartas · {vencidas} para revisar hoje
          </p>
        </div>
        <div className="flex gap-2">
          <LinkBotao href={`/flashcards/revisar?deck=${id}`}>
            <Play className="h-4 w-4" /> Revisar
          </LinkBotao>
          <form action={excluirDeck}>
            <input type="hidden" name="id" value={id} />
            <Botao variante="fantasma" className="text-rose-600" title="Excluir baralho">
              <Trash2 className="h-4 w-4" />
            </Botao>
          </form>
        </div>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Cartao className="p-4">
          <h2 className="mb-3 font-semibold">Nova carta</h2>
          <form action={salvarFlashcard} className="space-y-2">
            <input type="hidden" name="deck" value={id} />
            <textarea name="frente" required rows={2} className="campo" placeholder="Frente: pergunta, termo ou artigo" />
            <textarea name="verso" required rows={3} className="campo" placeholder="Verso: resposta" />
            <Botao type="submit" tamanho="sm">
              Adicionar carta
            </Botao>
          </form>
        </Cartao>
        <Cartao className="p-4">
          <h2 className="mb-1 font-semibold">Importar várias</h2>
          <p className="mb-2 text-xs text-slate-500">Uma carta por linha, separando frente e verso com “;” ou tabulação (colado do Excel/Anki).</p>
          <form action={importarFlashcards} className="space-y-2">
            <input type="hidden" name="deck" value={id} />
            <textarea name="texto" rows={5} className="campo font-mono text-xs" placeholder={"Prazo do recurso administrativo (Lei 9.784); 10 dias\nPrescrição do PAD — demissão; 5 anos"} />
            <Botao type="submit" tamanho="sm" variante="secundario">
              Importar
            </Botao>
          </form>
        </Cartao>
      </div>

      {cartas.length === 0 ? (
        <Vazio titulo="Baralho vazio" descricao="Adicione cartas acima." />
      ) : (
        <div className="cartao divide-y divide-slate-100 dark:divide-slate-800">
          {cartas.map((c) => (
            <details key={c.id} className="group">
              <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-line text-sm font-medium">{c.frente}</p>
                  <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-sm text-slate-500">{c.verso}</p>
                </div>
                <span className="shrink-0 text-xs text-slate-400">{c.repeticoes === 0 ? "nova" : `próx. ${formatarData(c.vence_em)}`}</span>
              </summary>
              <div className="space-y-2 bg-slate-50 px-4 py-3 dark:bg-slate-950/40">
                <form action={salvarFlashcard} className="space-y-2">
                  <input type="hidden" name="deck" value={id} />
                  <input type="hidden" name="id" value={c.id} />
                  <textarea name="frente" defaultValue={c.frente} rows={2} className="campo" />
                  <textarea name="verso" defaultValue={c.verso} rows={3} className="campo" />
                  <div className="flex items-center gap-2">
                    <Botao type="submit" tamanho="sm" variante="secundario">
                      Salvar
                    </Botao>
                    <button formAction={excluirFlashcard} className="text-xs text-rose-600 hover:underline">
                      Excluir carta
                    </button>
                    {c.questao_id && (
                      <Link href={`/questoes/${c.questao_id}`} className="ml-auto text-xs text-marca-600 hover:underline">
                        Ver questão de origem
                      </Link>
                    )}
                  </div>
                </form>
              </div>
            </details>
          ))}
        </div>
      )}
    </>
  );
}
