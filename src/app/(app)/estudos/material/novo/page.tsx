import { exigirUsuario } from "@/lib/auth";
import { assuntosIndentados, listarAssuntos, listarDisciplinas } from "@/lib/taxonomia";
import { EditorMaterial } from "@/components/estudos/editor-material";
import { CabecalhoPagina } from "@/components/ui";

export const metadata = { title: "Novo resumo" };

export default async function NovoMaterial({ searchParams }: { searchParams: Promise<{ disciplina?: string; assunto?: string }> }) {
  const usuario = await exigirUsuario();
  const sp = await searchParams;
  return (
    <>
      <CabecalhoPagina titulo="Novo resumo" descricao="Escreva sua teoria, mapas mentais em lista, tabelas de comparação e mnemônicos." />
      <EditorMaterial
        material={{
          titulo: "",
          conteudo: "",
          disciplina_id: Number(sp.disciplina) || null,
          assunto_id: Number(sp.assunto) || null,
          publico: usuario.papel === "admin",
        }}
        disciplinas={listarDisciplinas()}
        assuntos={assuntosIndentados(listarAssuntos())}
        admin={usuario.papel === "admin"}
      />
    </>
  );
}
