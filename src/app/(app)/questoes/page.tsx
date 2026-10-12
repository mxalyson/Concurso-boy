import Link from "next/link";
import { ClipboardList, FileStack, ListChecks, SearchX } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { contarFiltrosAtivos, filtrosParaParams, lerFiltros } from "@/lib/filtros";
import { carregarOpcoesFiltro } from "@/lib/opcoes-filtro";
import { buscarQuestoes, resumir } from "@/lib/questoes";
import { criarCadernoDeFiltros } from "@/app/actions/cadernos";
import { CartaoQuestao } from "@/components/questao/cartao-questao";
import { PainelFiltros, SeletorOrdem } from "@/components/questao/painel-filtros";
import { Paginacao } from "@/components/paginacao";
import { Botao, CabecalhoPagina, LinkBotao, Vazio } from "@/components/ui";

export const metadata = { title: "Banco de questões" };

const POR_PAGINA = 10;

export default async function PaginaQuestoes({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const usuario = await exigirUsuario();
  const params = await searchParams;
  const filtros = lerFiltros(params);
  const pagina = Math.max(1, Number(params.pg) || 1);
  const { total, questoes } = buscarQuestoes(filtros, usuario.id, pagina, POR_PAGINA);
  const opcoes = carregarOpcoesFiltro(usuario.id);
  const query = filtrosParaParams(filtros);
  const href = (p: number) => {
    const q = new URLSearchParams(query);
    if (p > 1) q.set("pg", String(p));
    return `/questoes?${q}`;
  };

  return (
    <>
      <CabecalhoPagina
        titulo="Banco de questões"
        descricao="Filtre por disciplina, assunto, banca, órgão e ano. Resolva, comente e acompanhe seu desempenho."
        icone={<ListChecks className="h-5 w-5" />}
      />
      <PainelFiltros key={query.toString()} opcoes={opcoes} filtros={filtros} />

      <div className="my-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          <strong className="text-slate-900 dark:text-white">{total.toLocaleString("pt-BR")}</strong> questões encontradas
          {contarFiltrosAtivos(filtros) > 0 && " com os filtros aplicados"}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <SeletorOrdem filtros={filtros} />
          {total > 0 && (
            <>
              <details className="relative">
                <summary className="flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800">
                  <FileStack className="h-4 w-4" /> Salvar caderno
                </summary>
                <form action={criarCadernoDeFiltros} className="cartao absolute right-0 z-20 mt-1 w-72 space-y-2 p-3">
                  <input type="hidden" name="params" value={query.toString()} />
                  <input name="nome" className="campo" placeholder="Nome do caderno" required />
                  <label className="flex items-center gap-2 text-xs text-slate-500">
                    Até <input name="limite" type="number" min={1} max={500} defaultValue={Math.min(total, 100)} className="campo w-20 py-1" /> questões
                  </label>
                  <Botao type="submit" tamanho="sm" className="w-full">
                    Criar caderno com estas questões
                  </Botao>
                </form>
              </details>
              <LinkBotao href={`/simulados/novo?${query}`} variante="secundario" tamanho="sm" className="h-9">
                <ClipboardList className="h-4 w-4" /> Gerar simulado
              </LinkBotao>
            </>
          )}
        </div>
      </div>

      {questoes.length === 0 ? (
        <Vazio
          icone={<SearchX className="h-10 w-10" />}
          titulo="Nenhuma questão encontrada"
          descricao={
            opcoes.disciplinas.length === 0 ? (
              <>
                O banco ainda está vazio. Rode <code>npm run db:seed</code> para carregar as questões de exemplo ou importe provas na{" "}
                <Link href="/admin/importar" className="text-marca-600 underline">
                  área administrativa
                </Link>
                .
              </>
            ) : (
              "Tente remover alguns filtros ou buscar por outros termos."
            )
          }
        />
      ) : (
        <div className="space-y-4">
          {questoes.map((q, i) => (
            <CartaoQuestao key={q.id} questao={resumir(q)} indice={(pagina - 1) * POR_PAGINA + i + 1} />
          ))}
        </div>
      )}
      <Paginacao total={total} pagina={pagina} porPagina={POR_PAGINA} href={href} />
    </>
  );
}
