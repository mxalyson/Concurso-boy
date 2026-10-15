import { db } from "./db";
import { assuntosIndentados, listarAnos, listarAssuntos, listarBancas, listarDisciplinas, listarOrgaos } from "./taxonomia";
import type { OpcoesFiltro } from "@/components/questao/painel-filtros";

type Contagem = { valor: string; total: number };
type Globais = Omit<OpcoesFiltro, "assuntos" | "cadernos" | "salvos">;

/** Valores distintos de uma coluna de provas, com o número de questões. */
function contar(expr: string, extraJoin = ""): Contagem[] {
  return db()
    .prepare(
      `SELECT ${expr} AS valor, count(DISTINCT qp.questao_id) AS total FROM questao_provas qp JOIN provas p ON p.id = qp.prova_id ${extraJoin}
       WHERE ${expr} IS NOT NULL AND ${expr} <> '' GROUP BY 1 ORDER BY 1`,
    )
    .all() as Contagem[];
}

// As opções gerais (bancas, órgãos, provas, cargos... com contagens) mudam só quando entram
// questões novas: ficam em memória e são recalculadas quando o banco muda.
let cache: { versao: string; dados: Globais } | null = null;

function versaoDoBanco() {
  const r = db().prepare("SELECT (SELECT max(id) FROM questoes) AS q, (SELECT count(*) FROM questao_provas) AS v, (SELECT max(id) FROM provas) AS p").get() as Record<string, number>;
  return `${r.q}:${r.v}:${r.p}`;
}

function globais(): Globais {
  const versao = versaoDoBanco();
  if (cache?.versao === versao) return cache.dados;
  const dados: Globais = {
    disciplinas: listarDisciplinas(),
    bancas: listarBancas(),
    orgaos: listarOrgaos(),
    anos: listarAnos(),
    provas: db()
      .prepare(
        `SELECT p.id, b.sigla AS banca, o.sigla AS orgao, p.cargo, p.ano, c.total
         FROM provas p JOIN (SELECT prova_id, count(*) AS total FROM questao_provas GROUP BY prova_id) c ON c.prova_id = p.id
         LEFT JOIN bancas b ON b.id = p.banca_id LEFT JOIN orgaos o ON o.id = p.orgao_id
         ORDER BY p.ano DESC, o.sigla, p.cargo`,
      )
      .all() as OpcoesFiltro["provas"],
    areas: contar("p.area"),
    cargos: contar("p.cargo"),
    esferas: contar("o.esfera", "JOIN orgaos o ON o.id = p.orgao_id"),
    ufs: contar("o.uf", "JOIN orgaos o ON o.id = p.orgao_id"),
  };
  cache = { versao, dados };
  return dados;
}

/** Assuntos (com subtópicos e contagens) das disciplinas informadas. */
export function assuntosDasDisciplinas(disciplinas: number[]): OpcoesFiltro["assuntos"] {
  if (!disciplinas.length) return [];
  const contagem = new Map(
    (
      db()
        .prepare(
          `SELECT assunto_id AS id, count(*) AS n FROM questoes WHERE assunto_id IS NOT NULL
             AND disciplina_id IN (${disciplinas.map(() => "?").join(",")}) GROUP BY 1`,
        )
        .all(...disciplinas) as { id: number; n: number }[]
    ).map((r) => [r.id, r.n]),
  );
  return disciplinas
    .flatMap((d) => assuntosIndentados(listarAssuntos(d)))
    .map(({ id, disciplina_id, nome, nivel }) => ({ id, disciplina_id, nome, nivel, total: contagem.get(id) ?? 0 }));
}

/**
 * Opções do painel de filtros. Os assuntos vêm só das disciplinas escolhidas (e os já
 * selecionados), para não enviar dezenas de milhares de assuntos ao navegador.
 */
export function carregarOpcoesFiltro(usuarioId: number, disciplinas: number[] = [], assuntosSelecionados: number[] = []): OpcoesFiltro {
  const assuntos = assuntosDasDisciplinas(disciplinas);
  const faltam = assuntosSelecionados.filter((id) => !assuntos.some((a) => a.id === id));
  if (faltam.length) {
    const extras = db()
      .prepare(`SELECT id, disciplina_id, nome FROM assuntos WHERE id IN (${faltam.map(() => "?").join(",")})`)
      .all(...faltam) as { id: number; disciplina_id: number; nome: string }[];
    assuntos.push(...extras.map((a) => ({ ...a, nivel: 0, total: 0 })));
  }
  return {
    ...globais(),
    assuntos,
    cadernos: db().prepare("SELECT id, nome FROM cadernos WHERE usuario_id = ? ORDER BY nome").all(usuarioId) as { id: number; nome: string }[],
    salvos: db().prepare("SELECT id, nome, params FROM filtros_salvos WHERE usuario_id = ? ORDER BY nome").all(usuarioId) as {
      id: number;
      nome: string;
      params: string;
    }[],
  };
}
