import Link from "next/link";
import { Layers, Play, Plus } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { db, hoje } from "@/lib/db";
import { listarDisciplinas } from "@/lib/taxonomia";
import { criarDeck } from "@/app/actions/estudos";
import { Botao, CabecalhoPagina, Cartao, LinkBotao, Selo, Vazio } from "@/components/ui";

export const metadata = { title: "Flashcards" };

export default async function PaginaFlashcards() {
  const usuario = await exigirUsuario();
  const decks = db()
    .prepare(
      `SELECT k.id, k.nome, d.nome AS disciplina, d.cor,
         (SELECT count(*) FROM flashcards f WHERE f.deck_id = k.id) AS total,
         (SELECT count(*) FROM flashcards f WHERE f.deck_id = k.id AND f.vence_em <= @p2) AS vencidos,
         (SELECT count(*) FROM flashcards f WHERE f.deck_id = k.id AND f.repeticoes = 0 AND f.intervalo = 0) AS novos
       FROM flashcard_decks k LEFT JOIN disciplinas d ON d.id = k.disciplina_id
       WHERE k.usuario_id = @p1 ORDER BY k.nome`,
    )
    .all({ p1: usuario.id, p2: hoje() }) as { id: number; nome: string; disciplina: string | null; cor: string | null; total: number; vencidos: number; novos: number }[];
  const totalVencidos = decks.reduce((s, d) => s + d.vencidos, 0);

  return (
    <>
      <CabecalhoPagina
        titulo="Flashcards"
        descricao="Memorize prazos, conceitos e artigos de lei com repetição espaçada: cada carta volta no momento certo para você não esquecer."
        icone={<Layers className="h-5 w-5" />}
        acoes={
          totalVencidos > 0 && (
            <LinkBotao href="/flashcards/revisar">
              <Play className="h-4 w-4" /> Revisar tudo ({totalVencidos})
            </LinkBotao>
          )
        }
      />
      <Cartao className="mb-6 p-4">
        <form action={criarDeck} className="flex flex-col gap-2 sm:flex-row">
          <input name="nome" required className="campo" placeholder="Nome do baralho (ex.: Prazos processuais)" />
          <select name="disciplina" className="campo sm:w-64">
            <option value="">Disciplina (opcional)</option>
            {listarDisciplinas().map((d) => (
              <option key={d.id} value={d.id}>
                {d.nome}
              </option>
            ))}
          </select>
          <Botao type="submit">
            <Plus className="h-4 w-4" /> Criar baralho
          </Botao>
        </form>
      </Cartao>
      {decks.length === 0 ? (
        <Vazio
          icone={<Layers className="h-10 w-10" />}
          titulo="Nenhum baralho ainda"
          descricao="Crie um baralho acima ou transforme questões em flashcards pelo botão “Flashcard” em cada questão."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((d) => (
            <div key={d.id} className="cartao flex flex-col p-4">
              <Link href={`/flashcards/${d.id}`} className="font-semibold hover:text-marca-600">
                {d.nome}
              </Link>
              {d.disciplina && (
                <span className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.cor ?? undefined }} /> {d.disciplina}
                </span>
              )}
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Selo>{d.total} cartas</Selo>
                {d.novos > 0 && <Selo cor="azul">{d.novos} novas</Selo>}
                {d.vencidos > 0 && <Selo cor="vermelho">{d.vencidos} para hoje</Selo>}
              </div>
              <div className="mt-4 flex gap-2">
                <LinkBotao href={`/flashcards/revisar?deck=${d.id}`} tamanho="sm" variante={d.vencidos ? "primario" : "secundario"} className="flex-1">
                  {d.vencidos ? "Revisar" : "Estudar mesmo assim"}
                </LinkBotao>
                <LinkBotao href={`/flashcards/${d.id}`} tamanho="sm" variante="fantasma">
                  Gerenciar
                </LinkBotao>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
