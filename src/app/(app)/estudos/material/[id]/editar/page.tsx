import { notFound } from "next/navigation";
import { exigirUsuario } from "@/lib/auth";
import { obterMaterial } from "@/lib/materiais";
import { assuntosIndentados, listarAssuntos, listarDisciplinas } from "@/lib/taxonomia";
import { EditorMaterial } from "@/components/estudos/editor-material";
import { CabecalhoPagina } from "@/components/ui";

export const metadata = { title: "Editar resumo" };

export default async function EditarMaterial({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirUsuario();
  const m = obterMaterial(Number((await params).id), usuario.id);
  if (!m || (m.autor_id !== usuario.id && usuario.papel !== "admin")) notFound();
  return (
    <>
      <CabecalhoPagina titulo="Editar resumo" />
      <EditorMaterial
        material={{ id: m.id, titulo: m.titulo, conteudo: m.conteudo, disciplina_id: m.disciplina_id, assunto_id: m.assunto_id, publico: !!m.publico }}
        disciplinas={listarDisciplinas()}
        assuntos={assuntosIndentados(listarAssuntos())}
        admin={usuario.papel === "admin"}
      />
    </>
  );
}
