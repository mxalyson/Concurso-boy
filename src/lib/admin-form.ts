import { db } from "./db";
import { assuntosIndentados, listarAssuntos, listarBancas, listarDisciplinas, listarOrgaos } from "./taxonomia";

export function opcoesFormQuestao() {
  const disciplinas = listarDisciplinas();
  const nomes = new Map(disciplinas.map((d) => [d.id, d.nome]));
  return {
    disciplinas: disciplinas.map((d) => d.nome),
    assuntos: assuntosIndentados(listarAssuntos()).map((a) => ({ disciplina: nomes.get(a.disciplina_id) ?? "", caminho: a.caminho })),
    bancas: listarBancas().map((b) => b.sigla),
    orgaos: listarOrgaos().map((o) => o.sigla),
  };
}

export function caminhoAssunto(id: number | null): string {
  if (!id) return "";
  const linhas = db()
    .prepare(
      `WITH RECURSIVE cadeia(id, parent_id, nome, nivel) AS (
         SELECT id, parent_id, nome, 0 FROM assuntos WHERE id = ?
         UNION ALL SELECT a.id, a.parent_id, a.nome, c.nivel + 1 FROM assuntos a JOIN cadeia c ON a.id = c.parent_id
       ) SELECT nome FROM cadeia ORDER BY nivel DESC`,
    )
    .all(id) as { nome: string }[];
  return linhas.map((l) => l.nome).join(" > ");
}
