import Link from "next/link";
import { BookOpen, CalendarClock, ClipboardList, Flame, Layers, ListChecks, RotateCcw, Shuffle, Target, Timer } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { db, hoje } from "@/lib/db";
import { desempenhoPorAssunto, respostasPorDia, resumoUsuario } from "@/lib/estatisticas";
import { calcularCiclo, proximaDoCiclo } from "@/lib/estudos";
import { contarQuestoes } from "@/lib/questoes";
import { formatarData, formatarMinutos, pct } from "@/lib/utils";
import { GraficoDiario } from "@/components/graficos";
import { BarraProgresso, Cartao, LinkBotao } from "@/components/ui";

export const metadata = { title: "Painel" };

function saudacao() {
  const h = new Date(Date.now() - 3 * 3600_000).getUTCHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

export default async function Painel() {
  const usuario = await exigirUsuario();
  const r = resumoUsuario(usuario.id);
  const { itens, plano } = calcularCiclo(usuario.id);
  const proxima = proximaDoCiclo(itens);
  const fracos = desempenhoPorAssunto(usuario.id)
    .filter((a) => a.total >= 3)
    .sort((a, b) => a.acertos / a.total - b.acertos / b.total)
    .slice(0, 3);
  const totalQuestoes = contarQuestoes();
  const simuladoAberto = db().prepare("SELECT id, titulo FROM simulados WHERE usuario_id = ? AND finalizado_em IS NULL ORDER BY id DESC LIMIT 1").get(usuario.id) as
    | { id: number; titulo: string }
    | undefined;
  const diasProva = plano?.data_prova
    ? Math.ceil((new Date(plano.data_prova + "T12:00:00Z").getTime() - new Date(hoje() + "T12:00:00Z").getTime()) / 86400000)
    : null;
  const metaPct = pct(r.hojeTotal, usuario.meta_diaria);
  const semente = Number(hoje().replaceAll("-", "")) % 99991;

  return (
    <>
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {saudacao()}, {usuario.nome.split(" ")[0]}!
          </h1>
          <p className="text-sm text-slate-500">
            {plano?.objetivo ? `Rumo a: ${plano.objetivo}` : "Defina seu objetivo no plano de estudos para um painel personalizado."}
          </p>
        </div>
        {diasProva !== null && diasProva >= 0 && (
          <div className="rounded-lg bg-slate-900 px-4 py-2 text-white dark:bg-slate-800">
            <span className="text-xl font-bold">{diasProva}</span> <span className="text-sm text-slate-300">dias para a prova ({formatarData(plano?.data_prova)})</span>
          </div>
        )}
      </div>

      {simuladoAberto && (
        <Link href={`/simulados/${simuladoAberto.id}`} className="mb-6 block rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Você tem um simulado em andamento: <strong>{simuladoAberto.titulo}</strong>. Clique para continuar →
        </Link>
      )}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Cartao className="p-4">
          <div className="flex items-center justify-between text-sm text-slate-500">
            Meta de hoje <Target className="h-4 w-4" />
          </div>
          <p className="mt-2 text-2xl font-bold">
            {r.hojeTotal}
            <span className="text-base font-normal text-slate-400">/{usuario.meta_diaria}</span>
          </p>
          <BarraProgresso valor={metaPct} className="mt-2" cor={metaPct >= 100 ? "#10b981" : undefined} />
          <p className="mt-1 text-xs text-slate-500">{r.hojeTotal ? `${pct(r.hojeAcertos, r.hojeTotal)}% de acerto hoje` : "Nenhuma questão hoje ainda"}</p>
        </Cartao>
        <Cartao className="p-4">
          <div className="flex items-center justify-between text-sm text-slate-500">
            Sequência <Flame className="h-4 w-4 text-orange-500" />
          </div>
          <p className="mt-2 text-2xl font-bold">
            {r.sequencia} <span className="text-base font-normal text-slate-400">dia{r.sequencia === 1 ? "" : "s"}</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">Estude todo dia para manter a chama acesa</p>
        </Cartao>
        <Cartao className="p-4">
          <div className="flex items-center justify-between text-sm text-slate-500">
            Estudo hoje <Timer className="h-4 w-4" />
          </div>
          <p className="mt-2 text-2xl font-bold">{formatarMinutos(r.minutosHoje)}</p>
          <p className="mt-1 text-xs text-slate-500">{formatarMinutos(r.minutosSemana)} nos últimos 7 dias</p>
        </Cartao>
        <Cartao className="p-4">
          <div className="flex items-center justify-between text-sm text-slate-500">
            Aproveitamento <ListChecks className="h-4 w-4" />
          </div>
          <p className="mt-2 text-2xl font-bold">{r.total ? `${pct(r.acertos, r.total)}%` : "—"}</p>
          <p className="mt-1 text-xs text-slate-500">
            {r.total.toLocaleString("pt-BR")} respostas · {totalQuestoes.toLocaleString("pt-BR")} questões no banco
          </p>
        </Cartao>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Cartao className="p-5 lg:col-span-2">
          <h2 className="mb-4 font-semibold">O que estudar agora</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {proxima ? (
              <Link href={`/foco?disciplina=${proxima.disciplina_id}`} className="rounded-lg border border-slate-200 p-4 hover:border-marca-300 dark:border-slate-800">
                <CalendarClock className="mb-2 h-5 w-5 text-marca-500" />
                <p className="font-medium">Ciclo: {proxima.nome}</p>
                <p className="text-xs text-slate-500">Faltam {formatarMinutos(Math.max(0, proxima.metaMin - proxima.estudadoMin))} neste ciclo</p>
              </Link>
            ) : (
              <Link href="/plano" className="rounded-lg border border-dashed border-slate-300 p-4 hover:border-marca-300 dark:border-slate-700">
                <CalendarClock className="mb-2 h-5 w-5 text-marca-500" />
                <p className="font-medium">Monte seu plano de estudos</p>
                <p className="text-xs text-slate-500">Ciclo por peso e dificuldade + grade semanal</p>
              </Link>
            )}
            <Link href="/revisoes" className="rounded-lg border border-slate-200 p-4 hover:border-marca-300 dark:border-slate-800">
              <RotateCcw className="mb-2 h-5 w-5 text-emerald-500" />
              <p className="font-medium">{r.revisoes ? `${r.revisoes} revisões pendentes` : "Revisões em dia"}</p>
              <p className="text-xs text-slate-500">Revisão espaçada dos assuntos concluídos</p>
            </Link>
            <Link href="/flashcards/revisar" className="rounded-lg border border-slate-200 p-4 hover:border-marca-300 dark:border-slate-800">
              <Layers className="mb-2 h-5 w-5 text-sky-500" />
              <p className="font-medium">{r.flashcardsVencidos ? `${r.flashcardsVencidos} flashcards para hoje` : "Flashcards em dia"}</p>
              <p className="text-xs text-slate-500">Memorização com repetição espaçada</p>
            </Link>
            <Link href={`/questoes?st=nao_resolvidas&ord=aleatoria&seed=${semente}`} className="rounded-lg border border-slate-200 p-4 hover:border-marca-300 dark:border-slate-800">
              <Shuffle className="mb-2 h-5 w-5 text-violet-500" />
              <p className="font-medium">Questões inéditas</p>
              <p className="text-xs text-slate-500">Resolva questões que você nunca viu, em ordem aleatória</p>
            </Link>
          </div>
        </Cartao>
        <Cartao className="p-5">
          <h2 className="mb-4 font-semibold">Pontos de atenção</h2>
          {fracos.length === 0 ? (
            <p className="text-sm text-slate-500">Resolva algumas questões para descobrirmos onde você precisa reforçar.</p>
          ) : (
            <ul className="space-y-3">
              {fracos.map((a) => (
                <li key={a.id}>
                  <Link href={`/questoes?a=${a.id}`} className="text-sm font-medium hover:text-marca-600">
                    {a.nome}
                  </Link>
                  <div className="mt-1 flex items-center gap-2">
                    <BarraProgresso valor={pct(a.acertos, a.total)} cor="#f43f5e" />
                    <span className="w-10 text-right text-xs text-rose-600">{pct(a.acertos, a.total)}%</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <LinkBotao href="/simulados/novo" variante="secundario" tamanho="sm">
              <ClipboardList className="h-4 w-4" /> Simulado
            </LinkBotao>
            <LinkBotao href="/estudos" variante="secundario" tamanho="sm">
              <BookOpen className="h-4 w-4" /> Teoria
            </LinkBotao>
          </div>
        </Cartao>
      </div>

      <Cartao className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Últimos 14 dias</h2>
          <Link href="/desempenho" className="text-sm text-marca-600 hover:underline">
            Ver desempenho completo
          </Link>
        </div>
        <GraficoDiario dados={respostasPorDia(usuario.id, 14)} />
      </Cartao>
    </>
  );
}
