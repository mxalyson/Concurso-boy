import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Layers, ListChecks, Pencil, Trash2 } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { db } from "@/lib/db";
import { obterMaterial } from "@/lib/materiais";
import { formatarData } from "@/lib/utils";
import { excluirMaterial, marcarMaterialEstudado } from "@/app/actions/estudos";
import { Markdown } from "@/components/markdown";
import { Botao, LinkBotao, Selo } from "@/components/ui";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const t = db().prepare("SELECT titulo FROM materiais WHERE id = ?").get(Number((await params).id)) as { titulo: string } | undefined;
  return { title: t?.titulo ?? "Resumo" };
}

export default async function PaginaMaterial({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirUsuario();
  const material = obterMaterial(Number((await params).id), usuario.id);
  if (!material) notFound();
  const podeEditar = material.autor_id === usuario.id || usuario.papel === "admin";
  const status = material.assunto_id
    ? (db().prepare("SELECT status FROM progresso_assuntos WHERE usuario_id = ? AND assunto_id = ?").get(usuario.id, material.assunto_id) as
        | { status: string }
        | undefined)?.status
    : undefined;
  const questoes = material.assunto_id
    ? (db()
        .prepare(
          `WITH RECURSIVE sub(id) AS (SELECT ? UNION SELECT a.id FROM assuntos a JOIN sub ON a.parent_id = sub.id)
           SELECT count(*) AS n FROM questoes WHERE assunto_id IN (SELECT id FROM sub)`,
        )
        .get(material.assunto_id) as { n: number }).n
    : 0;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/estudos/${material.slug}`} className="mb-4 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
        <ArrowLeft className="h-4 w-4" /> {material.disciplina}
      </Link>
      <header className="mb-6">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
          <Selo style={{ backgroundColor: material.cor + "22", color: material.cor }}>{material.disciplina}</Selo>
          {material.assunto && <Selo>{material.assunto}</Selo>}
          {!material.publico && <Selo cor="amarelo">Privado</Selo>}
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{material.titulo}</h1>
        <p className="mt-2 text-sm text-slate-500">
          {material.autor ? `Por ${material.autor} · ` : ""}Atualizado em {formatarData(material.atualizado_em)}
        </p>
        {podeEditar && (
          <div className="mt-3 flex gap-2">
            <LinkBotao href={`/estudos/material/${material.id}/editar`} variante="secundario" tamanho="sm">
              <Pencil className="h-3.5 w-3.5" /> Editar
            </LinkBotao>
            <form action={excluirMaterial}>
              <input type="hidden" name="id" value={material.id} />
              <Botao variante="fantasma" tamanho="sm" className="text-rose-600">
                <Trash2 className="h-3.5 w-3.5" /> Excluir
              </Botao>
            </form>
          </div>
        )}
      </header>

      <article className="cartao p-6 sm:p-8">
        <Markdown>{material.conteudo}</Markdown>
      </article>

      <div className="cartao mt-6 space-y-4 p-5">
        <h2 className="font-semibold">Terminou a leitura?</h2>
        <form action={marcarMaterialEstudado} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="assunto" value={material.assunto_id ?? ""} />
          <input type="hidden" name="disciplina" value={material.disciplina_id} />
          <label className="text-sm">
            <span className="rotulo">Tempo de estudo (min)</span>
            <input name="minutos" type="number" min={0} max={600} defaultValue={30} className="campo w-28" />
          </label>
          <Botao type="submit" variante="sucesso">
            <CheckCircle2 className="h-4 w-4" />
            {material.assunto_id ? (status === "concluido" ? "Registrar estudo" : "Marcar assunto como estudado") : "Registrar estudo"}
          </Botao>
        </form>
        {status === "concluido" && <p className="text-xs text-emerald-600">Assunto concluído — as revisões já estão agendadas.</p>}
        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          {material.assunto_id && questoes > 0 && (
            <LinkBotao href={`/questoes?a=${material.assunto_id}`} tamanho="sm">
              <ListChecks className="h-4 w-4" /> Fixar com {questoes} questões
            </LinkBotao>
          )}
          <LinkBotao href="/flashcards" variante="secundario" tamanho="sm">
            <Layers className="h-4 w-4" /> Criar flashcards
          </LinkBotao>
        </div>
      </div>
    </div>
  );
}
