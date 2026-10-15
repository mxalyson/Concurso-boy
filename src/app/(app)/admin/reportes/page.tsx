import Link from "next/link";
import { db } from "@/lib/db";
import { tempoRelativo } from "@/lib/utils";
import { resolverReporte } from "@/app/actions/admin";
import { Botao, Selo, Vazio } from "@/components/ui";
import { semMarcadores } from "@/lib/marcadores";

export const metadata = { title: "Notificações de erro" };

export default async function Reportes({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const status = (await searchParams).status === "resolvido" ? "resolvido" : "aberto";
  const reportes = db()
    .prepare(
      `SELECT r.id, r.questao_id, r.motivo, r.detalhes, r.criado_em, u.nome, q.enunciado
       FROM reportes r JOIN usuarios u ON u.id = r.usuario_id JOIN questoes q ON q.id = r.questao_id
       WHERE r.status = ? ORDER BY r.id DESC LIMIT 200`,
    )
    .all(status) as { id: number; questao_id: number; motivo: string; detalhes: string | null; criado_em: string; nome: string; enunciado: string }[];
  return (
    <>
      <div className="mb-4 flex gap-2 text-sm">
        <Link href="/admin/reportes" className={status === "aberto" ? "font-semibold text-marca-600" : "text-slate-500"}>
          Abertas
        </Link>
        <span className="text-slate-300">|</span>
        <Link href="/admin/reportes?status=resolvido" className={status === "resolvido" ? "font-semibold text-marca-600" : "text-slate-500"}>
          Resolvidas
        </Link>
      </div>
      {reportes.length === 0 ? (
        <Vazio titulo="Nenhuma notificação" descricao="Quando um aluno reportar um problema em uma questão, ele aparece aqui." />
      ) : (
        <div className="cartao divide-y divide-slate-100 dark:divide-slate-800">
          {reportes.map((r) => (
            <div key={r.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Selo cor="vermelho">{r.motivo}</Selo>
                  <Link href={`/questoes/${r.questao_id}`} className="font-mono text-xs text-marca-600 hover:underline">
                    Q{r.questao_id}
                  </Link>
                  <span className="text-xs text-slate-400">
                    {r.nome} · {tempoRelativo(r.criado_em)}
                  </span>
                </div>
                <p className="mt-1 line-clamp-1 text-sm text-slate-500">{semMarcadores(r.enunciado)}</p>
                {r.detalhes && <p className="mt-1 whitespace-pre-line text-sm">{r.detalhes}</p>}
              </div>
              <div className="flex gap-2">
                <Link href={`/admin/questoes/${r.questao_id}`} className="text-sm text-marca-600 hover:underline">
                  Editar questão
                </Link>
                {status === "aberto" && (
                  <form action={resolverReporte}>
                    <input type="hidden" name="id" value={r.id} />
                    <Botao tamanho="sm" variante="secundario">
                      Marcar como resolvida
                    </Botao>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
