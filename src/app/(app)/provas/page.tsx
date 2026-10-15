import Link from "next/link";
import { ClipboardList, ListChecks, ScrollText, Search } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { db } from "@/lib/db";
import { CabecalhoPagina, LinkBotao, Selo, Vazio } from "@/components/ui";
import { ESCOLARIDADES } from "@/lib/utils";
import { Paginacao } from "@/components/paginacao";

export const metadata = { title: "Provas" };

type Linha = {
  id: number;
  banca: string | null;
  orgao: string | null;
  orgao_nome: string | null;
  cargo: string | null;
  ano: number | null;
  escolaridade: string | null;
  area: string | null;
  total: number;
  resolvidas: number;
  acertos: number;
};

export default async function PaginaProvas({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const usuario = await exigirUsuario();
  const { q = "", banca = "", ano = "", area = "", pg = "" } = await searchParams;
  const termo = q.trim();
  const where: string[] = ["(b.sigla IS NULL OR b.sigla <> 'AUTORAL')"];
  const params: Record<string, unknown> = {};
  if (termo) {
    where.push("(o.sigla LIKE @termo OR o.nome LIKE @termo OR p.cargo LIKE @termo OR b.sigla LIKE @termo)");
    params.termo = `%${termo}%`;
  }
  if (banca) (where.push("b.sigla = @banca"), (params.banca = banca));
  if (ano) (where.push("p.ano = @ano"), (params.ano = Number(ano)));
  if (area) (where.push("p.area = @area"), (params.area = area));
  const total = (
    db()
      .prepare(
        `SELECT count(*) AS n FROM provas p LEFT JOIN bancas b ON b.id = p.banca_id LEFT JOIN orgaos o ON o.id = p.orgao_id
         WHERE EXISTS (SELECT 1 FROM questao_provas qp WHERE qp.prova_id = p.id) AND ${where.join(" AND ")}`,
      )
      .get(params) as { n: number }
  ).n;
  const pagina = Math.max(1, Number(pg) || 1);
  const provas = db()
    .prepare(
      `SELECT p.id, b.sigla AS banca, o.sigla AS orgao, o.nome AS orgao_nome, p.cargo, p.ano, p.escolaridade, p.area,
         (SELECT count(*) FROM questao_provas qp WHERE qp.prova_id = p.id) AS total,
         0 AS resolvidas, 0 AS acertos
       FROM provas p
       LEFT JOIN bancas b ON b.id = p.banca_id
       LEFT JOIN orgaos o ON o.id = p.orgao_id
       WHERE EXISTS (SELECT 1 FROM questao_provas qp WHERE qp.prova_id = p.id) AND ${where.join(" AND ")}
       ORDER BY p.ano DESC, b.sigla, o.sigla, p.cargo
       LIMIT 30 OFFSET @offset`,
    )
    .all({ ...params, offset: (pagina - 1) * 30 }) as Linha[];
  // progresso do usuário só nas provas desta página
  if (provas.length) {
    const ids = provas.map((p) => p.id);
    const progresso = db()
      .prepare(
        `SELECT qp.prova_id AS id, count(DISTINCT r.questao_id) AS resolvidas,
           count(DISTINCT CASE WHEN r.correta = 1 THEN r.questao_id END) AS acertos
         FROM respostas r JOIN questao_provas qp ON qp.questao_id = r.questao_id
         WHERE r.usuario_id = ? AND qp.prova_id IN (${ids.map(() => "?").join(",")}) GROUP BY qp.prova_id`,
      )
      .all(usuario.id, ...ids) as { id: number; resolvidas: number; acertos: number }[];
    for (const p of progresso) Object.assign(provas.find((x) => x.id === p.id) ?? {}, p);
  }
  const opcoes = db()
    .prepare(
      `SELECT DISTINCT b.sigla AS banca, p.ano, p.area FROM provas p
       LEFT JOIN bancas b ON b.id = p.banca_id WHERE b.sigla IS NULL OR b.sigla <> 'AUTORAL'`,
    )
    .all() as { banca: string | null; ano: number | null; area: string | null }[];
  const unicos = <T,>(v: (T | null)[]) => [...new Set(v.filter((x): x is T => x !== null))];
  const bancas = unicos(opcoes.map((o) => o.banca)).sort();
  const anos = unicos(opcoes.map((o) => o.ano)).sort((a, b) => b - a);
  const areas = unicos(opcoes.map((o) => o.area)).sort();

  return (
    <>
      <CabecalhoPagina
        titulo="Provas"
        descricao="Provas de concursos completas, na ordem original. Resolva questão por questão ou faça como simulado cronometrado."
        icone={<ScrollText className="h-5 w-5" />}
      />
      <form className="cartao mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="relative sm:col-span-2">
          <span className="rotulo">Concurso, órgão ou cargo</span>
          <Search className="pointer-events-none absolute bottom-2.5 left-3 h-4 w-4 text-slate-400" />
          <input name="q" defaultValue={termo} className="campo pl-9" placeholder="Ex.: PF, TRT, Escrevente..." />
        </label>
        <label>
          <span className="rotulo">Banca</span>
          <select name="banca" defaultValue={banca} className="campo">
            <option value="">Todas</option>
            {bancas.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="rotulo">Ano</span>
          <select name="ano" defaultValue={ano} className="campo">
            <option value="">Todos</option>
            {anos.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="rotulo">Área / carreira</span>
          <select name="area" defaultValue={area} className="campo">
            <option value="">Todas</option>
            {areas.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        <div className="flex justify-end sm:col-span-2 lg:col-span-5">
          <button className="rounded-lg bg-marca-600 px-4 py-2 text-sm font-semibold text-white hover:bg-marca-700">Buscar provas</button>
        </div>
      </form>

      <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
        <strong className="text-slate-900 dark:text-white">{total.toLocaleString("pt-BR")}</strong> provas
      </p>

      {provas.length === 0 ? (
        <Vazio titulo="Nenhuma prova encontrada" descricao="Ajuste a busca ou importe mais provas no painel admin." icone={<ScrollText className="h-6 w-6" />} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {provas.map((p) => {
            const pct = p.total ? Math.round((p.resolvidas / p.total) * 100) : 0;
            return (
              <li key={p.id} className="cartao flex flex-col gap-3 p-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  {p.banca && <Selo cor="marca">{p.banca}</Selo>}
                  {p.ano && <Selo>{p.ano}</Selo>}
                  {p.area && <Selo>{p.area}</Selo>}
                  {p.escolaridade && <Selo>{ESCOLARIDADES[p.escolaridade as keyof typeof ESCOLARIDADES] ?? p.escolaridade}</Selo>}
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900 dark:text-white">
                    {p.orgao_nome && p.orgao_nome !== p.orgao ? `${p.orgao_nome} (${p.orgao})` : p.orgao}
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{p.cargo}</p>
                </div>
                <div className="text-xs text-slate-500">
                  {p.total} questões · {p.resolvidas ? `${pct}% resolvida · ${p.acertos} acertos` : "não iniciada"}
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-full bg-marca-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="mt-auto flex flex-wrap gap-2">
                  <LinkBotao href={`/questoes?pv=${p.id}&anul=1`} tamanho="sm">
                    <ListChecks className="h-4 w-4" /> Resolver
                  </LinkBotao>
                  <LinkBotao href={`/simulados/novo?pv=${p.id}`} tamanho="sm" variante="secundario">
                    <ClipboardList className="h-4 w-4" /> Fazer como simulado
                  </LinkBotao>
                  <Link href={`/questoes?pv=${p.id}&st=errei`} className="self-center text-xs font-medium text-marca-600 hover:underline">
                    Rever erros
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Paginacao
        total={total}
        pagina={pagina}
        porPagina={30}
        href={(n) => {
          const u = new URLSearchParams({ ...(termo && { q: termo }), ...(banca && { banca }), ...(ano && { ano }), ...(area && { area }) });
          if (n > 1) u.set("pg", String(n));
          return `/provas${u.size ? `?${u}` : ""}`;
        }}
      />
    </>
  );
}
