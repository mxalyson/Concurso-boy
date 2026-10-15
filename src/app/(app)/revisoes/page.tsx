import Link from "next/link";
import { BookOpen, Layers, ListChecks, RotateCcw, XCircle } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { db, hoje } from "@/lib/db";
import { revisoesPendentes } from "@/lib/estudos";
import { resumoUsuario } from "@/lib/estatisticas";
import { formatarData } from "@/lib/utils";
import { concluirRevisao } from "@/app/actions/estudos";
import { Botao, CabecalhoPagina, Cartao, LinkBotao, Vazio } from "@/components/ui";

export const metadata = { title: "Revisões" };

export default async function PaginaRevisoes() {
  const usuario = await exigirUsuario();
  const pendentes = revisoesPendentes(usuario.id);
  const resumo = resumoUsuario(usuario.id);
  const proximas = db()
    .prepare(
      `SELECT pa.proxima_revisao AS dia, count(*) AS n FROM progresso_assuntos pa
       WHERE pa.usuario_id = ? AND pa.proxima_revisao > ? AND pa.proxima_revisao <= ?
       GROUP BY dia ORDER BY dia`,
    )
    .all(usuario.id, hoje(), hoje(7)) as { dia: string; n: number }[];
  const erradas = (
    db()
      .prepare(
        `SELECT count(*) AS n FROM respostas r WHERE r.usuario_id = @p1 AND r.correta = 0
         AND r.id = (SELECT max(id) FROM respostas r2 WHERE r2.usuario_id = @p1 AND r2.questao_id = r.questao_id)`,
      )
      .get({ p1: usuario.id }) as { n: number }
  ).n;

  return (
    <>
      <CabecalhoPagina
        titulo="Revisões"
        descricao="Revisar no momento certo é o que fixa o conteúdo. Aqui estão as revisões programadas, os flashcards do dia e as questões que você errou."
        icone={<RotateCcw className="h-5 w-5" />}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Cartao className="p-4">
          <div className="flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-marca-500" />
            <div>
              <p className="text-2xl font-bold">{pendentes.length}</p>
              <p className="text-sm text-slate-500">assuntos para revisar</p>
            </div>
          </div>
        </Cartao>
        <Link href="/flashcards/revisar" className="cartao p-4 hover:border-marca-300">
          <div className="flex items-center gap-3">
            <Layers className="h-8 w-8 text-sky-500" />
            <div>
              <p className="text-2xl font-bold">{resumo.flashcardsVencidos}</p>
              <p className="text-sm text-slate-500">flashcards para hoje →</p>
            </div>
          </div>
        </Link>
        <Link href="/questoes?st=errei&ord=aleatoria&seed=17" className="cartao p-4 hover:border-rose-300">
          <div className="flex items-center gap-3">
            <XCircle className="h-8 w-8 text-rose-500" />
            <div>
              <p className="text-2xl font-bold">{erradas}</p>
              <p className="text-sm text-slate-500">questões erradas para refazer →</p>
            </div>
          </div>
        </Link>
      </div>

      <h2 className="mb-3 font-semibold">Assuntos com revisão pendente</h2>
      {pendentes.length === 0 ? (
        <Vazio
          titulo="Tudo em dia!"
          descricao={
            <>
              Marque assuntos como concluídos nas <Link href="/estudos" className="text-marca-600 underline">disciplinas</Link> para receber revisões programadas.
            </>
          }
        />
      ) : (
        <div className="cartao divide-y divide-slate-100 dark:divide-slate-800">
          {pendentes.map((p) => (
            <div key={p.assunto_id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{p.assunto}</p>
                <p className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.cor }} /> {p.disciplina} · {p.revisoes + 1}ª revisão · prevista para{" "}
                  {formatarData(p.proxima_revisao)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {p.material_id && (
                  <LinkBotao href={`/estudos/material/${p.material_id}`} variante="fantasma" tamanho="sm">
                    <BookOpen className="h-3.5 w-3.5" /> Resumo
                  </LinkBotao>
                )}
                {p.questoes > 0 && (
                  <LinkBotao href={`/questoes?a=${p.assunto_id}&ord=aleatoria&seed=${p.assunto_id}`} variante="fantasma" tamanho="sm">
                    <ListChecks className="h-3.5 w-3.5" /> {p.questoes} questões
                  </LinkBotao>
                )}
                <form action={concluirRevisao} className="flex items-center gap-1">
                  <input type="hidden" name="assunto" value={p.assunto_id} />
                  <input name="minutos" type="number" min={0} max={240} defaultValue={15} className="campo w-16 py-1 text-xs" title="Minutos gastos" />
                  <Botao tamanho="sm" variante="sucesso">
                    Revisei
                  </Botao>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}

      {proximas.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 font-semibold">Próximos 7 dias</h2>
          <div className="flex flex-wrap gap-2">
            {proximas.map((p) => (
              <span key={p.dia} className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm dark:bg-slate-800">
                {formatarData(p.dia).slice(0, 5)}: <strong>{p.n}</strong>
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
