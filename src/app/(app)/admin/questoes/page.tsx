import Link from "next/link";
import { Pencil, Plus, Search } from "lucide-react";
import { exigirAdmin } from "@/lib/auth";
import { lerFiltros } from "@/lib/filtros";
import { buscarQuestoes } from "@/lib/questoes";
import { listarDisciplinas } from "@/lib/taxonomia";
import { Paginacao } from "@/components/paginacao";
import { LinkBotao, Selo } from "@/components/ui";

export const metadata = { title: "Questões — admin" };

export default async function AdminQuestoes({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const admin = await exigirAdmin();
  const sp = await searchParams;
  const filtros = lerFiltros({ ...sp, anul: "1", desat: "1" });
  const pagina = Math.max(1, Number(sp.pg) || 1);
  const { total, questoes } = buscarQuestoes(filtros, admin.id, pagina, 30);
  const disciplinas = listarDisciplinas();
  return (
    <>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <form className="flex flex-1 gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input name="q" defaultValue={sp.q} className="campo pl-9" placeholder="Buscar por texto ou #ID" />
          </div>
          <select name="d" defaultValue={sp.d ?? ""} className="campo w-48">
            <option value="">Todas as disciplinas</option>
            {disciplinas.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nome}
              </option>
            ))}
          </select>
          <button className="rounded-lg bg-slate-800 px-4 text-sm text-white dark:bg-slate-700">Buscar</button>
        </form>
        <LinkBotao href="/admin/questoes/nova">
          <Plus className="h-4 w-4" /> Nova questão
        </LinkBotao>
      </div>
      <p className="mb-2 text-sm text-slate-500">{total} questões</p>
      <div className="cartao overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500 dark:border-slate-800">
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Enunciado</th>
              <th className="px-3 py-2">Disciplina / assunto</th>
              <th className="px-3 py-2">Prova</th>
              <th className="px-3 py-2">Gab.</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {questoes.map((q) => (
              <tr key={q.id} className="border-b border-slate-50 align-top last:border-0 dark:border-slate-800/50">
                <td className="px-3 py-2 font-mono text-xs">
                  <Link href={`/questoes/${q.id}`} className="hover:text-marca-600">
                    {q.id}
                  </Link>
                </td>
                <td className="max-w-md px-3 py-2">
                  <p className="line-clamp-2">{q.enunciado}</p>
                  <div className="mt-1 flex gap-1">
                    {q.anulada && <Selo cor="amarelo">anulada</Selo>}
                    {q.desatualizada && <Selo cor="amarelo">desatualizada</Selo>}
                    {!q.comentario && <Selo>sem comentário</Selo>}
                  </div>
                </td>
                <td className="px-3 py-2 text-xs">
                  {q.disciplina_nome}
                  <br />
                  <span className="text-slate-500">{q.assunto_nome ?? "—"}</span>
                </td>
                <td className="px-3 py-2 text-xs text-slate-500">{[q.banca, q.orgao, q.ano].filter(Boolean).join(" · ") || "—"}</td>
                <td className="px-3 py-2 font-mono">{q.gabarito ?? <span className="text-rose-600">?</span>}</td>
                <td className="px-3 py-2">
                  <Link href={`/admin/questoes/${q.id}`} className="text-slate-400 hover:text-marca-600" title="Editar">
                    <Pencil className="h-4 w-4" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Paginacao
        total={total}
        pagina={pagina}
        porPagina={30}
        href={(p) => `/admin/questoes?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.d ? { d: sp.d } : {}), pg: String(p) })}`}
      />
    </>
  );
}
