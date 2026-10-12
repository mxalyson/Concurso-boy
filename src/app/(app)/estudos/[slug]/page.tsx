import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, ListChecks, Plus, RotateCcw } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { db, hoje } from "@/lib/db";
import { desempenhoPorAssunto } from "@/lib/estatisticas";
import { progressoAssuntos } from "@/lib/estudos";
import { arvoreAssuntos, disciplinaPorSlug, listarAssuntos, type AssuntoNo } from "@/lib/taxonomia";
import { cn, formatarData, pct } from "@/lib/utils";
import { concluirRevisao } from "@/app/actions/estudos";
import { StatusAssuntoSelect } from "@/components/estudos/status-assunto";
import { BarraProgresso, Estatistica, LinkBotao, Vazio } from "@/components/ui";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  return { title: disciplinaPorSlug((await params).slug)?.nome ?? "Disciplina" };
}

export default async function PaginaDisciplina({ params }: { params: Promise<{ slug: string }> }) {
  const usuario = await exigirUsuario();
  const disciplina = disciplinaPorSlug((await params).slug);
  if (!disciplina) notFound();

  const assuntos = listarAssuntos(disciplina.id);
  const arvore = arvoreAssuntos(assuntos);
  const progresso = progressoAssuntos(usuario.id, disciplina.id);
  const desempenho = new Map(desempenhoPorAssunto(usuario.id, disciplina.id).map((d) => [d.id, d]));
  const materiais = db()
    .prepare(
      `SELECT id, titulo, assunto_id, publico FROM materiais
       WHERE disciplina_id = ? AND (publico = 1 OR autor_id = ?) ORDER BY titulo`,
    )
    .all(disciplina.id, usuario.id) as { id: number; titulo: string; assunto_id: number | null; publico: number }[];
  const materiaisPorAssunto = new Map<number, typeof materiais>();
  for (const m of materiais) if (m.assunto_id) materiaisPorAssunto.set(m.assunto_id, [...(materiaisPorAssunto.get(m.assunto_id) ?? []), m]);
  const gerais = materiais.filter((m) => !m.assunto_id);

  const concluidos = assuntos.filter((a) => progresso.get(a.id)?.status === "concluido").length;
  const totalRespostas = [...desempenho.values()].reduce((s, d) => s + d.total, 0);
  const totalAcertos = [...desempenho.values()].reduce((s, d) => s + d.acertos, 0);
  const questoesDisciplina = (db().prepare("SELECT count(*) AS n FROM questoes WHERE disciplina_id = ?").get(disciplina.id) as { n: number }).n;
  const dataHoje = hoje();

  const Linha = ({ no, nivel }: { no: AssuntoNo; nivel: number }) => {
    const p = progresso.get(no.id);
    const d = desempenho.get(no.id);
    const mats = materiaisPorAssunto.get(no.id) ?? [];
    const revisaoVencida = p?.proxima_revisao && p.proxima_revisao <= dataHoje;
    return (
      <>
        <tr className="border-t border-slate-100 dark:border-slate-800">
          <td className="py-2.5 pr-3" style={{ paddingLeft: `${0.75 + nivel * 1.25}rem` }}>
            <div className={cn("text-sm", nivel === 0 && "font-semibold")}>{no.nome}</div>
            {mats.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                {mats.map((m) => (
                  <Link key={m.id} href={`/estudos/material/${m.id}`} className="flex items-center gap-1 text-xs text-marca-600 hover:underline">
                    <FileText className="h-3 w-3" /> {m.titulo}
                  </Link>
                ))}
              </div>
            )}
          </td>
          <td className="px-2 py-2.5">
            <StatusAssuntoSelect assuntoId={no.id} status={p?.status ?? "nao_iniciado"} />
          </td>
          <td className="hidden px-2 py-2.5 text-xs sm:table-cell">
            {p?.status === "concluido" ? (
              <div className="flex items-center gap-2">
                <span className={cn(revisaoVencida ? "font-semibold text-rose-600" : "text-slate-500")}>
                  {p.revisoes}ª rev. · {formatarData(p.proxima_revisao)}
                </span>
                {revisaoVencida && (
                  <form action={concluirRevisao}>
                    <input type="hidden" name="assunto" value={no.id} />
                    <button className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-emerald-600 dark:hover:bg-slate-800" title="Marcar revisão como feita">
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  </form>
                )}
              </div>
            ) : (
              <span className="text-slate-400">—</span>
            )}
          </td>
          <td className="px-2 py-2.5 text-right text-xs">
            {no.totalComFilhos > 0 ? (
              <Link href={`/questoes?a=${no.id}`} className="inline-flex items-center gap-1 text-marca-600 hover:underline">
                <ListChecks className="h-3.5 w-3.5" /> {no.totalComFilhos}
              </Link>
            ) : (
              <span className="text-slate-400">0</span>
            )}
          </td>
          <td className="hidden py-2.5 pl-2 pr-3 text-right text-xs md:table-cell">
            {d ? (
              <span className={pct(d.acertos, d.total) >= 70 ? "text-emerald-600" : pct(d.acertos, d.total) >= 50 ? "text-amber-600" : "text-rose-600"}>
                {pct(d.acertos, d.total)}% <span className="text-slate-400">({d.total})</span>
              </span>
            ) : (
              <span className="text-slate-400">—</span>
            )}
          </td>
        </tr>
        {no.filhos.map((f) => (
          <Linha key={f.id} no={f} nivel={nivel + 1} />
        ))}
      </>
    );
  };

  return (
    <>
      <Link href="/estudos" className="mb-4 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
        <ArrowLeft className="h-4 w-4" /> Disciplinas
      </Link>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="h-10 w-1.5 rounded-full" style={{ backgroundColor: disciplina.cor }} />
          <div>
            <h1 className="text-2xl font-bold">{disciplina.nome}</h1>
            <p className="text-sm text-slate-500">Edital verticalizado e materiais de estudo</p>
          </div>
        </div>
        <div className="flex gap-2">
          <LinkBotao href={`/estudos/material/novo?disciplina=${disciplina.id}`} variante="secundario" tamanho="sm">
            <Plus className="h-4 w-4" /> Resumo
          </LinkBotao>
          <LinkBotao href={`/questoes?d=${disciplina.id}`} tamanho="sm">
            <ListChecks className="h-4 w-4" /> Resolver questões
          </LinkBotao>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Estatistica
          rotulo="Edital concluído"
          valor={`${pct(concluidos, assuntos.length)}%`}
          detalhe={<BarraProgresso valor={pct(concluidos, assuntos.length)} cor={disciplina.cor} className="mt-1" />}
        />
        <Estatistica rotulo="Questões disponíveis" valor={questoesDisciplina} />
        <Estatistica rotulo="Seu aproveitamento" valor={totalRespostas ? `${pct(totalAcertos, totalRespostas)}%` : "—"} detalhe={`${totalRespostas} respostas`} />
      </div>

      {gerais.length > 0 && (
        <div className="cartao mb-6 p-4">
          <h2 className="mb-2 text-sm font-semibold">Materiais gerais</h2>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {gerais.map((m) => (
              <Link key={m.id} href={`/estudos/material/${m.id}`} className="flex items-center gap-1 text-sm text-marca-600 hover:underline">
                <FileText className="h-3.5 w-3.5" /> {m.titulo}
              </Link>
            ))}
          </div>
        </div>
      )}

      {arvore.length === 0 ? (
        <Vazio titulo="Nenhum assunto cadastrado" descricao="Os assuntos são criados automaticamente ao importar questões ou pelo administrador." />
      ) : (
        <div className="cartao overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2.5 font-medium">Assunto</th>
                <th className="px-2 py-2.5 font-medium">Status</th>
                <th className="hidden px-2 py-2.5 font-medium sm:table-cell">Revisão</th>
                <th className="px-2 py-2.5 text-right font-medium">Questões</th>
                <th className="hidden py-2.5 pl-2 pr-3 text-right font-medium md:table-cell">Acerto</th>
              </tr>
            </thead>
            <tbody>
              {arvore.map((no) => (
                <Linha key={no.id} no={no} nivel={0} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-slate-500">
        Ao marcar um assunto como <strong>concluído</strong>, revisões são agendadas automaticamente (1, 7, 15, 30, 60 e 120 dias) e aparecem em{" "}
        <Link href="/revisoes" className="text-marca-600 underline">
          Revisões
        </Link>
        .
      </p>
    </>
  );
}
