import Link from "next/link";
import { ClipboardList, Plus, Trash2 } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { db } from "@/lib/db";
import { corrigirSimulado, prazoSimulado, type Simulado } from "@/lib/simulados";
import { formatarMinutos, pct, tempoRelativo, dataSqlite } from "@/lib/utils";
import { excluirSimulado } from "@/app/actions/simulados";
import { CabecalhoPagina, LinkBotao, Selo, Vazio } from "@/components/ui";

export const metadata = { title: "Simulados" };

export default async function PaginaSimulados() {
  const usuario = await exigirUsuario();
  let simulados = db().prepare("SELECT * FROM simulados WHERE usuario_id = ? ORDER BY id DESC").all(usuario.id) as Simulado[];
  // Simulados cujo tempo acabou são corrigidos automaticamente.
  const expirados = simulados.filter((s) => !s.finalizado_em && Date.now() > prazoSimulado(s) + 60_000);
  if (expirados.length) {
    expirados.forEach(corrigirSimulado);
    simulados = db().prepare("SELECT * FROM simulados WHERE usuario_id = ? ORDER BY id DESC").all(usuario.id) as Simulado[];
  }
  const andamento = simulados.filter((s) => !s.finalizado_em);
  const finalizados = simulados.filter((s) => s.finalizado_em);

  return (
    <>
      <CabecalhoPagina
        titulo="Simulados"
        descricao="Treine com tempo cronometrado, como no dia da prova. O resultado entra nas suas estatísticas."
        icone={<ClipboardList className="h-5 w-5" />}
        acoes={
          <LinkBotao href="/simulados/novo">
            <Plus className="h-4 w-4" /> Novo simulado
          </LinkBotao>
        }
      />
      {andamento.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 font-semibold">Em andamento</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {andamento.map((s) => (
              <Link key={s.id} href={`/simulados/${s.id}`} className="cartao flex items-center justify-between p-4 hover:border-marca-300">
                <div>
                  <p className="font-semibold">{s.titulo}</p>
                  <p className="text-sm text-slate-500">
                    {s.total} questões · termina às {new Date(prazoSimulado(s)).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <Selo cor="amarelo">Continuar</Selo>
              </Link>
            ))}
          </div>
        </section>
      )}
      <h2 className="mb-3 font-semibold">Histórico</h2>
      {finalizados.length === 0 ? (
        <Vazio
          titulo="Nenhum simulado realizado"
          descricao="Monte um simulado escolhendo disciplinas, banca e quantidade de questões."
          acao={<LinkBotao href="/simulados/novo">Criar meu primeiro simulado</LinkBotao>}
        />
      ) : (
        <div className="cartao divide-y divide-slate-100 dark:divide-slate-800">
          {finalizados.map((s) => {
            const nota = pct(s.acertos ?? 0, s.total);
            const minutos = Math.max(1, Math.round((dataSqlite(s.finalizado_em!).getTime() - dataSqlite(s.iniciado_em).getTime()) / 60000));
            return (
              <div key={s.id} className="flex items-center gap-4 px-4 py-3">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    nota >= 70 ? "bg-emerald-100 text-emerald-700" : nota >= 50 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"
                  }`}
                >
                  {nota}%
                </div>
                <Link href={`/simulados/${s.id}/resultado`} className="min-w-0 flex-1">
                  <p className="truncate font-medium hover:text-marca-600">{s.titulo}</p>
                  <p className="text-xs text-slate-500">
                    {s.acertos}/{s.total} acertos · {formatarMinutos(Math.min(minutos, s.duracao_min))} · {tempoRelativo(s.iniciado_em)}
                  </p>
                </Link>
                <form action={excluirSimulado}>
                  <input type="hidden" name="id" value={s.id} />
                  <button className="rounded p-2 text-slate-400 hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-slate-800" title="Excluir">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
