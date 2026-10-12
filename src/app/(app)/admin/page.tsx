import Link from "next/link";
import { FileUp, Flag, ListChecks, Plus, Sparkles } from "lucide-react";
import { db } from "@/lib/db";
import { iaDisponivel } from "@/lib/ia";
import { tempoRelativo } from "@/lib/utils";
import { Alerta, Cartao, Estatistica, LinkBotao } from "@/components/ui";

export const metadata = { title: "Administração" };

export default function AdminInicio() {
  const n = (sql: string) => (db().prepare(sql).get() as { n: number }).n;
  const reportes = db()
    .prepare(
      `SELECT r.id, r.questao_id, r.motivo, r.criado_em, u.nome FROM reportes r JOIN usuarios u ON u.id = r.usuario_id
       WHERE r.status = 'aberto' ORDER BY r.id DESC LIMIT 5`,
    )
    .all() as { id: number; questao_id: number; motivo: string; criado_em: string; nome: string }[];
  const semGabarito = n("SELECT count(*) AS n FROM questoes WHERE gabarito IS NULL AND anulada = 0");
  const semComentario = n("SELECT count(*) AS n FROM questoes WHERE comentario IS NULL OR comentario = ''");
  const semAssunto = n("SELECT count(*) AS n FROM questoes WHERE assunto_id IS NULL");

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Estatistica rotulo="Questões" valor={n("SELECT count(*) AS n FROM questoes").toLocaleString("pt-BR")} detalhe={`${n("SELECT count(*) AS n FROM provas")} provas`} />
        <Estatistica rotulo="Disciplinas / assuntos" valor={`${n("SELECT count(*) AS n FROM disciplinas")} / ${n("SELECT count(*) AS n FROM assuntos")}`} />
        <Estatistica rotulo="Usuários" valor={n("SELECT count(*) AS n FROM usuarios")} detalhe={`${n("SELECT count(*) AS n FROM respostas")} respostas registradas`} />
        <Estatistica rotulo="Resumos" valor={n("SELECT count(*) AS n FROM materiais WHERE publico = 1")} detalhe="materiais públicos" />
      </div>

      {!iaDisponivel() && (
        <Alerta tipo="info">
          <Sparkles className="mr-1 inline h-4 w-4" /> Para extrair questões de PDFs escaneados com IA e gerar comentários automáticos, defina a variável{" "}
          <code>ANTHROPIC_API_KEY</code> no servidor.
        </Alerta>
      )}

      <div className="flex flex-wrap gap-2">
        <LinkBotao href="/admin/importar">
          <FileUp className="h-4 w-4" /> Importar prova
        </LinkBotao>
        <LinkBotao href="/admin/questoes/nova" variante="secundario">
          <Plus className="h-4 w-4" /> Nova questão
        </LinkBotao>
        <LinkBotao href="/estudos/material/novo" variante="secundario">
          <Plus className="h-4 w-4" /> Novo resumo
        </LinkBotao>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Cartao className="p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <ListChecks className="h-4 w-4" /> Qualidade do banco
          </h2>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between">
              <span>Sem gabarito</span> <strong className={semGabarito ? "text-rose-600" : ""}>{semGabarito}</strong>
            </li>
            <li className="flex justify-between">
              <span>Sem assunto classificado</span> <strong className={semAssunto ? "text-amber-600" : ""}>{semAssunto}</strong>
            </li>
            <li className="flex justify-between">
              <span>Sem comentário</span> <strong>{semComentario}</strong>
            </li>
          </ul>
        </Cartao>
        <Cartao className="p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <Flag className="h-4 w-4" /> Notificações de erro abertas
          </h2>
          {reportes.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma notificação pendente.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {reportes.map((r) => (
                <li key={r.id} className="flex justify-between gap-2">
                  <Link href={`/questoes/${r.questao_id}`} className="truncate hover:text-marca-600">
                    Q{r.questao_id} — {r.motivo}
                  </Link>
                  <span className="shrink-0 text-xs text-slate-400">
                    {r.nome} · {tempoRelativo(r.criado_em)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/admin/reportes" className="mt-3 inline-block text-sm text-marca-600 hover:underline">
            Ver todas
          </Link>
        </Cartao>
      </div>
    </div>
  );
}
