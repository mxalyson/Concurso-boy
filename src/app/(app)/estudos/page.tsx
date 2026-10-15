import Link from "next/link";
import { BookOpen, FileText, Plus } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { db } from "@/lib/db";
import { pct, tempoRelativo } from "@/lib/utils";
import { BarraProgresso, CabecalhoPagina, LinkBotao, Vazio } from "@/components/ui";

export const metadata = { title: "Disciplinas e teoria" };

export default async function PaginaEstudos({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const usuario = await exigirUsuario();
  const { q } = await searchParams;
  const disciplinas = db()
    .prepare(
      `SELECT d.id, d.nome, d.slug, d.cor,
         (SELECT count(*) FROM assuntos a WHERE a.disciplina_id = d.id) AS assuntos,
         (SELECT count(*) FROM progresso_assuntos pa JOIN assuntos a ON a.id = pa.assunto_id
            WHERE a.disciplina_id = d.id AND pa.usuario_id = @p1 AND pa.status = 'concluido') AS concluidos,
         (SELECT count(*) FROM questoes q WHERE q.disciplina_id = d.id) AS questoes,
         (SELECT count(*) FROM materiais m WHERE m.disciplina_id = d.id AND (m.publico = 1 OR m.autor_id = @p1)) AS materiais,
         (SELECT count(*) FROM respostas r JOIN questoes q ON q.id = r.questao_id WHERE q.disciplina_id = d.id AND r.usuario_id = @p1) AS respostas,
         (SELECT ifnull(sum(r.correta), 0) FROM respostas r JOIN questoes q ON q.id = r.questao_id WHERE q.disciplina_id = d.id AND r.usuario_id = @p1) AS acertos
       FROM disciplinas d ORDER BY d.nome`,
    )
    .all({ p1: usuario.id }) as {
    id: number;
    nome: string;
    slug: string;
    cor: string;
    assuntos: number;
    concluidos: number;
    questoes: number;
    materiais: number;
    respostas: number;
    acertos: number;
  }[];

  const busca = q?.trim();
  const materiais = db()
    .prepare(
      `SELECT m.id, m.titulo, m.atualizado_em, m.publico, d.nome AS disciplina, d.cor, a.nome AS assunto
       FROM materiais m JOIN disciplinas d ON d.id = m.disciplina_id LEFT JOIN assuntos a ON a.id = m.assunto_id
       WHERE (m.publico = 1 OR m.autor_id = ?) ${busca ? "AND (m.titulo LIKE ? OR m.conteudo LIKE ?)" : "AND m.autor_id = ?"}
       ORDER BY m.atualizado_em DESC LIMIT 30`,
    )
    .all(...(busca ? [usuario.id, `%${busca}%`, `%${busca}%`] : [usuario.id, usuario.id])) as {
    id: number;
    titulo: string;
    atualizado_em: string;
    publico: number;
    disciplina: string;
    cor: string;
    assunto: string | null;
  }[];

  return (
    <>
      <CabecalhoPagina
        titulo="Disciplinas e teoria"
        descricao="Edital verticalizado, resumos teóricos e progresso por assunto. Marque o que já estudou para receber revisões programadas."
        icone={<BookOpen className="h-5 w-5" />}
        acoes={
          <LinkBotao href="/estudos/material/novo" variante="secundario">
            <Plus className="h-4 w-4" /> Novo resumo
          </LinkBotao>
        }
      />
      {disciplinas.length === 0 ? (
        <Vazio titulo="Nenhuma disciplina cadastrada" descricao="Importe questões ou carregue os dados de exemplo para começar." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {disciplinas.map((d) => (
            <Link key={d.id} href={`/estudos/${d.slug}`} className="cartao group block overflow-hidden transition hover:shadow-md">
              <div className="h-1.5" style={{ backgroundColor: d.cor }} />
              <div className="p-4">
                <p className="font-semibold text-slate-900 group-hover:text-marca-600 dark:text-white">{d.nome}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {d.assuntos} assuntos · {d.questoes} questões · {d.materiais} resumos
                </p>
                <div className="mt-4 flex justify-between text-xs text-slate-500">
                  <span>Edital: {pct(d.concluidos, d.assuntos)}%</span>
                  <span>{d.respostas > 0 ? `${pct(d.acertos, d.respostas)}% de acerto` : "Sem questões resolvidas"}</span>
                </div>
                <BarraProgresso valor={pct(d.concluidos, d.assuntos)} cor={d.cor} className="mt-1.5" />
              </div>
            </Link>
          ))}
        </div>
      )}

      <section className="mt-10">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-semibold">{busca ? `Resumos com “${busca}”` : "Meus resumos"}</h2>
          <form className="flex gap-2">
            <input name="q" defaultValue={busca} className="campo w-64" placeholder="Buscar em todos os resumos..." />
          </form>
        </div>
        {materiais.length === 0 ? (
          <p className="text-sm text-slate-500">
            {busca ? "Nada encontrado." : "Você ainda não escreveu resumos. Os resumos públicos ficam dentro de cada disciplina."}
          </p>
        ) : (
          <ul className="cartao divide-y divide-slate-100 dark:divide-slate-800">
            {materiais.map((m) => (
              <li key={m.id}>
                <Link href={`/estudos/material/${m.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <FileText className="h-4 w-4 shrink-0" style={{ color: m.cor }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{m.titulo}</span>
                    <span className="text-xs text-slate-500">
                      {m.disciplina}
                      {m.assunto && ` › ${m.assunto}`}
                    </span>
                  </span>
                  <span className="text-xs text-slate-400">{tempoRelativo(m.atualizado_em)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
