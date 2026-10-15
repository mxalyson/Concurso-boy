import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardList, Trash2 } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { db } from "@/lib/db";
import { lerFiltros } from "@/lib/filtros";
import { buscarQuestoes, resumir } from "@/lib/questoes";
import { pct } from "@/lib/utils";
import { atualizarCaderno, excluirCaderno, removerDoCaderno } from "@/app/actions/cadernos";
import { CartaoQuestao } from "@/components/questao/cartao-questao";
import { Paginacao } from "@/components/paginacao";
import { BarraProgresso, Botao, LinkBotao, Vazio } from "@/components/ui";

const POR_PAGINA = 10;

export default async function PaginaCaderno({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const usuario = await exigirUsuario();
  const id = Number((await params).id);
  const sp = await searchParams;
  const caderno = db().prepare("SELECT id, nome, descricao FROM cadernos WHERE id = ? AND usuario_id = ?").get(id, usuario.id) as
    | { id: number; nome: string; descricao: string | null }
    | undefined;
  if (!caderno) notFound();

  const status = typeof sp.st === "string" ? sp.st : undefined;
  const filtros = lerFiltros({ cad: String(id), st: status, anul: "1", desat: "1", ord: "antigas" });
  const pagina = Math.max(1, Number(sp.pg) || 1);
  const { total, questoes } = buscarQuestoes(filtros, usuario.id, pagina, POR_PAGINA);
  const stats = db()
    .prepare(
      `SELECT count(*) AS total,
         (SELECT count(DISTINCT r.questao_id) FROM respostas r JOIN caderno_questoes cq ON cq.questao_id = r.questao_id
            WHERE cq.caderno_id = @p1 AND r.usuario_id = @p2) AS resolvidas,
         (SELECT count(*) FROM respostas r JOIN caderno_questoes cq ON cq.questao_id = r.questao_id
            WHERE cq.caderno_id = @p1 AND r.usuario_id = @p2) AS respostas,
         (SELECT ifnull(sum(r.correta), 0) FROM respostas r JOIN caderno_questoes cq ON cq.questao_id = r.questao_id
            WHERE cq.caderno_id = @p1 AND r.usuario_id = @p2) AS acertos
       FROM caderno_questoes WHERE caderno_id = @p1`,
    )
    .get({ p1: id, p2: usuario.id }) as { total: number; resolvidas: number; respostas: number; acertos: number };

  const aba = (rotulo: string, valor?: string) => (
    <Link
      href={`/cadernos/${id}${valor ? `?st=${valor}` : ""}`}
      className={`rounded-md px-3 py-1.5 text-sm font-medium ${
        status === valor ? "bg-marca-600 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
      }`}
    >
      {rotulo}
    </Link>
  );

  return (
    <>
      <Link href="/cadernos" className="mb-4 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
        <ArrowLeft className="h-4 w-4" /> Cadernos
      </Link>
      <div className="cartao mb-6 p-5">
        <details>
          <summary className="cursor-pointer list-none">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{caderno.nome}</h1>
            {caderno.descricao && <p className="mt-1 text-sm text-slate-500">{caderno.descricao}</p>}
            <span className="mt-1 inline-block text-xs text-marca-600">Editar caderno</span>
          </summary>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <form action={atualizarCaderno} className="flex flex-1 flex-col gap-2 sm:flex-row">
              <input type="hidden" name="id" value={id} />
              <input name="nome" defaultValue={caderno.nome} className="campo" required />
              <input name="descricao" defaultValue={caderno.descricao ?? ""} className="campo" placeholder="Descrição" />
              <Botao type="submit" variante="secundario">
                Salvar
              </Botao>
            </form>
            <form action={excluirCaderno}>
              <input type="hidden" name="id" value={id} />
              <Botao type="submit" variante="perigo">
                <Trash2 className="h-4 w-4" /> Excluir
              </Botao>
            </form>
          </div>
        </details>
        <div className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-slate-500">Progresso</p>
            <p className="font-semibold">
              {stats.resolvidas} de {stats.total} questões
            </p>
            <BarraProgresso valor={pct(stats.resolvidas, stats.total)} className="mt-1" />
          </div>
          <div>
            <p className="text-slate-500">Aproveitamento</p>
            <p className="font-semibold">
              {pct(stats.acertos, stats.respostas)}% ({stats.acertos}/{stats.respostas} respostas)
            </p>
          </div>
          <div className="flex items-center sm:justify-end">
            <LinkBotao href={`/simulados/novo?cad=${id}&anul=1&desat=1`} variante="secundario" tamanho="sm">
              <ClipboardList className="h-4 w-4" /> Fazer como simulado
            </LinkBotao>
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1">
        {aba("Todas")}
        {aba("Não resolvidas", "nao_resolvidas")}
        {aba("Errei", "errei")}
        {aba("Acertei", "acertei")}
      </div>

      {questoes.length === 0 ? (
        <Vazio
          titulo="Nenhuma questão aqui"
          descricao={
            <>
              Adicione questões pelo botão “Caderno” em cada questão do <Link href="/questoes" className="text-marca-600 underline">banco de questões</Link>.
            </>
          }
        />
      ) : (
        <div className="space-y-4">
          {questoes.map((q, i) => (
            <div key={q.id} className="space-y-1">
              <CartaoQuestao questao={resumir(q)} indice={(pagina - 1) * POR_PAGINA + i + 1} />
              <form action={removerDoCaderno} className="text-right">
                <input type="hidden" name="caderno" value={id} />
                <input type="hidden" name="questao" value={q.id} />
                <button className="text-xs text-slate-400 hover:text-rose-600">Remover do caderno</button>
              </form>
            </div>
          ))}
        </div>
      )}
      <Paginacao
        total={total}
        pagina={pagina}
        porPagina={POR_PAGINA}
        href={(p) => `/cadernos/${id}?${new URLSearchParams({ ...(status ? { st: status } : {}), pg: String(p) })}`}
      />
    </>
  );
}
