import Link from "next/link";
import { FileStack, Plus, Star, XCircle } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { db } from "@/lib/db";
import { pct, tempoRelativo } from "@/lib/utils";
import { criarCadernoVazio } from "@/app/actions/cadernos";
import { BarraProgresso, Botao, CabecalhoPagina, Cartao, Vazio } from "@/components/ui";

export const metadata = { title: "Cadernos" };

export default async function PaginaCadernos() {
  const usuario = await exigirUsuario();
  const cadernos = db()
    .prepare(
      `SELECT c.id, c.nome, c.descricao, c.criado_em,
         (SELECT count(*) FROM caderno_questoes cq WHERE cq.caderno_id = c.id) AS total,
         (SELECT count(DISTINCT r.questao_id) FROM respostas r JOIN caderno_questoes cq ON cq.questao_id = r.questao_id
            WHERE cq.caderno_id = c.id AND r.usuario_id = c.usuario_id) AS resolvidas
       FROM cadernos c WHERE c.usuario_id = ? ORDER BY c.id DESC`,
    )
    .all(usuario.id) as { id: number; nome: string; descricao: string | null; criado_em: string; total: number; resolvidas: number }[];
  const especiais = db()
    .prepare(
      `SELECT
         (SELECT count(*) FROM favoritos WHERE usuario_id = @p1) AS favoritas,
         (SELECT count(*) FROM (SELECT questao_id, correta FROM respostas r WHERE usuario_id = @p1
            AND id = (SELECT max(id) FROM respostas r2 WHERE r2.usuario_id = @p1 AND r2.questao_id = r.questao_id)) WHERE correta = 0) AS erradas`,
    )
    .get({ p1: usuario.id }) as { favoritas: number; erradas: number };

  return (
    <>
      <CabecalhoPagina
        titulo="Cadernos"
        descricao="Organize questões em listas para resolver e revisar. Crie cadernos a partir dos filtros do banco de questões."
        icone={<FileStack className="h-5 w-5" />}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Link href="/questoes?st=errei" className="cartao flex items-center gap-4 p-4 transition hover:border-rose-300">
          <XCircle className="h-8 w-8 text-rose-500" />
          <div>
            <p className="font-semibold">Caderno de erros</p>
            <p className="text-sm text-slate-500">{especiais.erradas} questões que você errou na última tentativa</p>
          </div>
        </Link>
        <Link href="/questoes?fav=1" className="cartao flex items-center gap-4 p-4 transition hover:border-amber-300">
          <Star className="h-8 w-8 text-amber-500" />
          <div>
            <p className="font-semibold">Favoritas</p>
            <p className="text-sm text-slate-500">{especiais.favoritas} questões marcadas com estrela</p>
          </div>
        </Link>
      </div>

      <Cartao className="mb-6 p-4">
        <form action={criarCadernoVazio} className="flex flex-col gap-2 sm:flex-row">
          <input name="nome" required className="campo" placeholder="Nome do novo caderno (ex.: Direito Administrativo — revisão)" />
          <input name="descricao" className="campo" placeholder="Descrição (opcional)" />
          <Botao type="submit">
            <Plus className="h-4 w-4" /> Criar
          </Botao>
        </form>
        <p className="mt-2 text-xs text-slate-500">
          Dica: no <Link href="/questoes" className="text-marca-600 underline">banco de questões</Link>, aplique filtros e clique em “Salvar caderno” para criar um caderno já preenchido.
        </p>
      </Cartao>

      {cadernos.length === 0 ? (
        <Vazio titulo="Você ainda não tem cadernos" descricao="Crie um caderno vazio acima ou gere um a partir dos filtros do banco de questões." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cadernos.map((c) => (
            <Link key={c.id} href={`/cadernos/${c.id}`} className="cartao block p-4 transition hover:border-marca-300 hover:shadow">
              <p className="font-semibold text-slate-900 dark:text-white">{c.nome}</p>
              {c.descricao && <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">{c.descricao}</p>}
              <div className="mt-4 flex justify-between text-xs text-slate-500">
                <span>
                  {c.resolvidas}/{c.total} resolvidas
                </span>
                <span>{tempoRelativo(c.criado_em)}</span>
              </div>
              <BarraProgresso valor={pct(c.resolvidas, c.total)} className="mt-1.5" />
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
