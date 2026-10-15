import { opcoesFormQuestao } from "@/lib/admin-form";
import { FormQuestao } from "@/components/admin/form-questao";

export const metadata = { title: "Nova questão" };

export default function NovaQuestao() {
  return (
    <>
      <h2 className="mb-4 text-lg font-semibold">Nova questão</h2>
      <FormQuestao
        dados={{
          disciplina: "",
          assunto: "",
          tipo: "multipla",
          texto_base: "",
          enunciado: "",
          alternativas: [],
          gabarito: "",
          comentario: "",
          dificuldade: "",
          anulada: false,
          desatualizada: false,
          banca: "",
          orgao: "",
          orgao_nome: "",
          cargo: "",
          ano: "",
          escolaridade: "",
          fonte: "",
          numero: "",
        }}
        {...opcoesFormQuestao()}
      />
    </>
  );
}
