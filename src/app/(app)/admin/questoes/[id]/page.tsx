import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { exigirAdmin } from "@/lib/auth";
import { caminhoAssunto, opcoesFormQuestao } from "@/lib/admin-form";
import { obterQuestao } from "@/lib/questoes";
import { excluirQuestao } from "@/app/actions/admin";
import { FormQuestao } from "@/components/admin/form-questao";
import { Botao } from "@/components/ui";

export const metadata = { title: "Editar questão" };

export default async function EditarQuestao({ params }: { params: Promise<{ id: string }> }) {
  const admin = await exigirAdmin();
  const q = obterQuestao(Number((await params).id), admin.id);
  if (!q) notFound();
  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Editar questão Q{q.id}</h2>
        <form action={excluirQuestao}>
          <input type="hidden" name="id" value={q.id} />
          <Botao variante="perigo" tamanho="sm">
            <Trash2 className="h-4 w-4" /> Excluir questão
          </Botao>
        </form>
      </div>
      <FormQuestao
        dados={{
          id: q.id,
          disciplina: q.disciplina_nome,
          assunto: caminhoAssunto(q.assunto_id),
          tipo: q.tipo,
          texto_base: q.texto_base ?? "",
          enunciado: q.enunciado,
          alternativas: q.alternativas,
          gabarito: q.gabarito ?? "",
          comentario: q.comentario ?? "",
          dificuldade: q.dificuldade ? String(q.dificuldade) : "",
          anulada: q.anulada,
          desatualizada: q.desatualizada,
          banca: q.banca ?? "",
          orgao: q.orgao ?? "",
          orgao_nome: q.orgao_nome ?? "",
          cargo: q.cargo ?? "",
          ano: q.ano ? String(q.ano) : "",
          escolaridade: q.escolaridade ?? "",
          fonte: q.fonte ?? "",
          numero: q.numero ? String(q.numero) : "",
        }}
        {...opcoesFormQuestao()}
      />
    </>
  );
}
