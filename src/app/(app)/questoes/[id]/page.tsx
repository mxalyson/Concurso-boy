import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { obterQuestao, resumir } from "@/lib/questoes";
import { CartaoQuestao } from "@/components/questao/cartao-questao";
import { LinkBotao } from "@/components/ui";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  return { title: `Questão ${(await params).id}` };
}

export default async function PaginaQuestao({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirUsuario();
  const id = Number((await params).id);
  const questao = Number.isFinite(id) ? obterQuestao(id, usuario.id) : null;
  if (!questao) notFound();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/questoes" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
          <ArrowLeft className="h-4 w-4" /> Banco de questões
        </Link>
        {usuario.papel === "admin" && (
          <LinkBotao href={`/admin/questoes/${id}`} variante="secundario" tamanho="sm">
            <Pencil className="h-3.5 w-3.5" /> Editar
          </LinkBotao>
        )}
      </div>
      <CartaoQuestao questao={resumir(questao)} />
      <div className="flex flex-wrap gap-2 text-sm">
        <Link href={`/questoes?d=${questao.disciplina_id}`} className="text-marca-600 hover:underline">
          Mais questões de {questao.disciplina_nome}
        </Link>
        {questao.assunto_id && (
          <>
            <span className="text-slate-400">·</span>
            <Link href={`/questoes?a=${questao.assunto_id}`} className="text-marca-600 hover:underline">
              Mais questões de {questao.assunto_nome}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
