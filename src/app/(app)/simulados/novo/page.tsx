import Link from "next/link";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { db } from "@/lib/db";
import { filtrosParaParams, lerFiltros, type Filtros } from "@/lib/filtros";
import { carregarOpcoesFiltro } from "@/lib/opcoes-filtro";
import { montarFiltro } from "@/lib/questoes";
import { PainelFiltros } from "@/components/questao/painel-filtros";
import { FormSimulado } from "@/components/simulado/form-simulado";
import { CabecalhoPagina } from "@/components/ui";

export const metadata = { title: "Novo simulado" };

function contarPorDisciplina(filtros: Filtros, usuarioId: number) {
  const { where, params } = montarFiltro({ ...filtros, disciplinas: [] }, usuarioId);
  where.push("q.gabarito IS NOT NULL");
  return db()
    .prepare(
      `SELECT d.id, d.nome, d.cor, count(*) AS total FROM questoes q
       LEFT JOIN provas p ON p.id = q.prova_id JOIN disciplinas d ON d.id = q.disciplina_id
       WHERE ${where.join(" AND ")} GROUP BY d.id ORDER BY d.nome`,
    )
    .all(params) as { id: number; nome: string; cor: string; total: number }[];
}

export default async function NovoSimulado({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const usuario = await exigirUsuario();
  const filtros = lerFiltros(await searchParams);
  const params = filtrosParaParams({ ...filtros, ordem: "recentes", semente: undefined }).toString();
  const porDisciplina = contarPorDisciplina(filtros, usuario.id);
  const disciplinasFiltradas = filtros.disciplinas.length ? porDisciplina.filter((d) => filtros.disciplinas.includes(d.id)) : porDisciplina;
  const total = disciplinasFiltradas.reduce((s, d) => s + d.total, 0);

  return (
    <>
      <Link href="/simulados" className="mb-4 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
        <ArrowLeft className="h-4 w-4" /> Simulados
      </Link>
      <CabecalhoPagina
        titulo="Novo simulado"
        descricao="1) Escolha os filtros  2) Defina quantidade e tempo  3) Comece! As questões são sorteadas entre as que atendem aos filtros."
        icone={<ClipboardList className="h-5 w-5" />}
      />
      <div className="space-y-4">
        <PainelFiltros key={params} opcoes={carregarOpcoesFiltro(usuario.id)} filtros={filtros} base="/simulados/novo" />
        <FormSimulado params={params} disciplinas={disciplinasFiltradas} totalDisponivel={total} />
      </div>
    </>
  );
}
