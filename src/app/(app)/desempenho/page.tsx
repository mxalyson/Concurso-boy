import Link from "next/link";
import { BarChart3, Target, Timer, TrendingUp, Trophy } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { db } from "@/lib/db";
import { desempenhoPorAssunto, desempenhoPorDisciplina, mapaAtividade, minutosPorDisciplina, respostasPorDia, resumoUsuario } from "@/lib/estatisticas";
import { formatarMinutos, pct } from "@/lib/utils";
import { GraficoDiario, MapaCalor, Rosca } from "@/components/graficos";
import { BarraProgresso, CabecalhoPagina, Cartao, Estatistica, Vazio } from "@/components/ui";

export const metadata = { title: "Desempenho" };

function corPct(p: number) {
  return p >= 70 ? "text-emerald-600" : p >= 50 ? "text-amber-600" : "text-rose-600";
}

export default async function PaginaDesempenho() {
  const usuario = await exigirUsuario();
  const resumo = resumoUsuario(usuario.id);
  const disciplinas = desempenhoPorDisciplina(usuario.id);
  const assuntos = desempenhoPorAssunto(usuario.id).filter((a) => a.total >= 3);
  const fracos = [...assuntos].sort((a, b) => a.acertos / a.total - b.acertos / b.total).slice(0, 8);
  const fortes = [...assuntos].sort((a, b) => b.acertos / b.total - a.acertos / a.total).slice(0, 5);
  const simulados = db()
    .prepare("SELECT id, titulo, acertos, total FROM simulados WHERE usuario_id = ? AND finalizado_em IS NOT NULL ORDER BY id DESC LIMIT 12")
    .all(usuario.id)
    .reverse() as { id: number; titulo: string; acertos: number; total: number }[];
  const minutosTotal = (db().prepare("SELECT ifnull(sum(minutos), 0) AS n FROM sessoes_estudo WHERE usuario_id = ?").get(usuario.id) as { n: number }).n;

  return (
    <>
      <CabecalhoPagina
        titulo="Desempenho"
        descricao="Acompanhe sua evolução, descubra seus pontos fracos e direcione o estudo para onde dá mais resultado."
        icone={<BarChart3 className="h-5 w-5" />}
      />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Estatistica rotulo="Questões resolvidas" valor={resumo.total.toLocaleString("pt-BR")} detalhe={`${resumo.questoesDistintas} questões diferentes`} icone={<Target className="h-4 w-4" />} />
        <Estatistica
          rotulo="Aproveitamento geral"
          valor={<span className={corPct(pct(resumo.acertos, resumo.total))}>{pct(resumo.acertos, resumo.total)}%</span>}
          detalhe={`${resumo.acertos} acertos`}
          icone={<TrendingUp className="h-4 w-4" />}
        />
        <Estatistica rotulo="Tempo de estudo" valor={formatarMinutos(minutosTotal)} detalhe={`${formatarMinutos(resumo.minutosSemana)} nos últimos 7 dias`} icone={<Timer className="h-4 w-4" />} />
        <Estatistica rotulo="Sequência" valor={`${resumo.sequencia} dia${resumo.sequencia === 1 ? "" : "s"}`} detalhe="dias seguidos estudando" icone={<Trophy className="h-4 w-4" />} />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Cartao className="p-5">
          <h2 className="mb-4 font-semibold">Questões nos últimos 30 dias</h2>
          <GraficoDiario dados={respostasPorDia(usuario.id, 30)} />
        </Cartao>
        <Cartao className="p-5">
          <h2 className="mb-4 font-semibold">Tempo por disciplina (30 dias)</h2>
          <Rosca dados={minutosPorDisciplina(usuario.id, 30)} />
        </Cartao>
      </div>

      <Cartao className="mb-6 p-5">
        <h2 className="mb-4 font-semibold">Constância</h2>
        <MapaCalor dados={mapaAtividade(usuario.id, 26)} />
      </Cartao>

      <Cartao className="mb-6 overflow-x-auto">
        <h2 className="px-5 pt-5 font-semibold">Por disciplina</h2>
        {disciplinas.length === 0 ? (
          <div className="p-5">
            <Vazio titulo="Sem dados ainda" descricao="Resolva questões para ver seu desempenho por disciplina." />
          </div>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500 dark:border-slate-800">
                <th className="px-5 py-2 font-medium">Disciplina</th>
                <th className="px-3 py-2 text-right font-medium">Resolvidas</th>
                <th className="px-3 py-2 text-right font-medium">Acertos</th>
                <th className="hidden w-48 px-3 py-2 font-medium sm:table-cell">Aproveitamento</th>
                <th className="hidden px-5 py-2 text-right font-medium md:table-cell">Tempo médio</th>
              </tr>
            </thead>
            <tbody>
              {disciplinas.map((d) => (
                <tr key={d.id} className="border-b border-slate-50 last:border-0 dark:border-slate-800/50">
                  <td className="px-5 py-2.5">
                    <Link href={`/estudos/${d.slug}`} className="flex items-center gap-2 hover:text-marca-600">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.cor }} />
                      {d.nome}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-right">{d.total}</td>
                  <td className="px-3 py-2.5 text-right">{d.acertos}</td>
                  <td className="hidden px-3 py-2.5 sm:table-cell">
                    <div className="flex items-center gap-2">
                      <BarraProgresso valor={pct(d.acertos, d.total)} cor={d.cor} />
                      <span className={`w-10 text-right text-xs font-semibold ${corPct(pct(d.acertos, d.total))}`}>{pct(d.acertos, d.total)}%</span>
                    </div>
                  </td>
                  <td className="hidden px-5 py-2.5 text-right text-slate-500 md:table-cell">{d.tempo_medio ? `${Math.round(d.tempo_medio)}s` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Cartao>

      <div className="grid gap-6 lg:grid-cols-2">
        <Cartao className="p-5">
          <h2 className="mb-1 font-semibold">Assuntos para reforçar</h2>
          <p className="mb-4 text-xs text-slate-500">Menor índice de acerto (mínimo de 3 respostas).</p>
          {fracos.length === 0 ? (
            <p className="text-sm text-slate-500">Resolva mais questões para identificar seus pontos fracos.</p>
          ) : (
            <ul className="space-y-3">
              {fracos.map((a) => (
                <li key={a.id}>
                  <div className="mb-1 flex justify-between gap-2 text-sm">
                    <Link href={`/questoes?a=${a.id}`} className="truncate hover:text-marca-600">
                      {a.nome} <span className="text-xs text-slate-400">· {a.disciplina}</span>
                    </Link>
                    <span className={`shrink-0 font-semibold ${corPct(pct(a.acertos, a.total))}`}>
                      {pct(a.acertos, a.total)}% <span className="text-xs font-normal text-slate-400">({a.total})</span>
                    </span>
                  </div>
                  <BarraProgresso valor={pct(a.acertos, a.total)} cor="#f43f5e" />
                </li>
              ))}
            </ul>
          )}
          {fortes.length > 0 && (
            <>
              <h3 className="mb-2 mt-6 text-sm font-semibold">Seus pontos fortes</h3>
              <ul className="space-y-1 text-sm">
                {fortes.map((a) => (
                  <li key={a.id} className="flex justify-between">
                    <span className="truncate">{a.nome}</span>
                    <span className="font-semibold text-emerald-600">{pct(a.acertos, a.total)}%</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Cartao>
        <Cartao className="p-5">
          <h2 className="mb-4 font-semibold">Evolução nos simulados</h2>
          {simulados.length === 0 ? (
            <p className="text-sm text-slate-500">
              Nenhum simulado finalizado. <Link href="/simulados/novo" className="text-marca-600 underline">Faça um agora</Link>.
            </p>
          ) : (
            <div className="flex h-48 items-end gap-2">
              {simulados.map((s) => {
                const nota = pct(s.acertos, s.total);
                return (
                  <Link key={s.id} href={`/simulados/${s.id}/resultado`} className="group flex h-full flex-1 flex-col items-center justify-end gap-1" title={s.titulo}>
                    <span className="text-[10px] font-semibold text-slate-500">{nota}%</span>
                    <div
                      className={`w-full rounded-t ${nota >= 70 ? "bg-emerald-500" : nota >= 50 ? "bg-amber-500" : "bg-rose-500"} group-hover:opacity-80`}
                      style={{ height: `${Math.max(4, nota)}%` }}
                    />
                  </Link>
                );
              })}
            </div>
          )}
        </Cartao>
      </div>
    </>
  );
}
