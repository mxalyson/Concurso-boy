import { db } from "./db";

export type Material = {
  id: number;
  disciplina_id: number;
  assunto_id: number | null;
  titulo: string;
  conteudo: string;
  autor_id: number | null;
  publico: number;
  atualizado_em: string;
  disciplina: string;
  slug: string;
  cor: string;
  assunto: string | null;
  autor: string | null;
};

export function obterMaterial(id: number, usuarioId: number): Material | null {
  return (
    (db()
      .prepare(
        `SELECT m.*, d.nome AS disciplina, d.slug, d.cor, a.nome AS assunto, u.nome AS autor
         FROM materiais m JOIN disciplinas d ON d.id = m.disciplina_id
         LEFT JOIN assuntos a ON a.id = m.assunto_id LEFT JOIN usuarios u ON u.id = m.autor_id
         WHERE m.id = ? AND (m.publico = 1 OR m.autor_id = ?)`,
      )
      .get(id, usuarioId) as Material | undefined) ?? null
  );
}
