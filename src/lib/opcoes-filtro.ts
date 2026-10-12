import { db } from "./db";
import { assuntosIndentados, listarAnos, listarAssuntos, listarBancas, listarDisciplinas, listarOrgaos } from "./taxonomia";
import type { OpcoesFiltro } from "@/components/questao/painel-filtros";

type Contagem = { valor: string; total: number };

/** Valores distintos de uma coluna de provas, com o número de questões. */
function contar(expr: string, extraJoin = ""): Contagem[] {
  return db()
    .prepare(
      `SELECT ${expr} AS valor, count(*) AS total FROM questoes q JOIN provas p ON p.id = q.prova_id ${extraJoin}
       WHERE ${expr} IS NOT NULL AND ${expr} <> '' GROUP BY 1 ORDER BY 1`,
    )
    .all() as Contagem[];
}

export function carregarOpcoesFiltro(usuarioId: number): OpcoesFiltro {
  const contagemAssuntos = new Map(
    (db().prepare("SELECT assunto_id AS id, count(*) AS n FROM questoes WHERE assunto_id IS NOT NULL GROUP BY 1").all() as { id: number; n: number }[]).map(
      (r) => [r.id, r.n],
    ),
  );
  return {
    disciplinas: listarDisciplinas(),
    assuntos: assuntosIndentados(listarAssuntos()).map(({ id, disciplina_id, nome, nivel }) => ({
      id,
      disciplina_id,
      nome,
      nivel,
      total: contagemAssuntos.get(id) ?? 0,
    })),
    bancas: listarBancas(),
    orgaos: listarOrgaos(),
    anos: listarAnos(),
    provas: db()
      .prepare(
        `SELECT p.id, b.sigla AS banca, o.sigla AS orgao, p.cargo, p.ano, count(q.id) AS total
         FROM provas p JOIN questoes q ON q.prova_id = p.id
         LEFT JOIN bancas b ON b.id = p.banca_id LEFT JOIN orgaos o ON o.id = p.orgao_id
         GROUP BY p.id ORDER BY p.ano DESC, o.sigla, p.cargo`,
      )
      .all() as OpcoesFiltro["provas"],
    areas: contar("p.area"),
    cargos: contar("p.cargo"),
    esferas: contar("o.esfera", "JOIN orgaos o ON o.id = p.orgao_id"),
    ufs: contar("o.uf", "JOIN orgaos o ON o.id = p.orgao_id"),
    cadernos: db().prepare("SELECT id, nome FROM cadernos WHERE usuario_id = ? ORDER BY nome").all(usuarioId) as { id: number; nome: string }[],
  };
}
