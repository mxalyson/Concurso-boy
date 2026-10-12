import crypto from "node:crypto";
import { db } from "./db";
import type { Filtros } from "./filtros";

export type Alternativa = { letra: string; texto: string };
/** Imagem da questão. "inline" aparece no ponto do texto marcado com [[img:N]] (N = índice nesta lista);
 * "contexto"/"enunciado" são recortes da prova original (`substitui`: o recorte de contexto já contém
 * todo o texto associado); "figura" aparece após o enunciado. */
export type ImagemQuestao = {
  src: string;
  parte: "contexto" | "enunciado" | "figura" | "inline";
  legenda?: string;
  substitui?: boolean;
  /** Tamanho em pixels de recortes feitos a 150 dpi (usado para exibir na escala do texto). */
  largura?: number;
  altura?: number;
};

export type TipoQuestao = "multipla" | "certo_errado";

/** Questão como é enviada ao navegador (sem gabarito e sem comentário). */
export type QuestaoResumo = {
  id: number;
  numero: number | null;
  tipo: TipoQuestao;
  texto_base: string | null;
  enunciado: string;
  alternativas: Alternativa[];
  dificuldade: number | null;
  anulada: boolean;
  desatualizada: boolean;
  fonte: string | null;
  imagens: ImagemQuestao[];
  texto_confiavel: boolean;
  disciplina_id: number;
  disciplina_nome: string;
  disciplina_cor: string;
  assunto_id: number | null;
  assunto_nome: string | null;
  banca: string | null;
  orgao: string | null;
  orgao_nome: string | null;
  cargo: string | null;
  ano: number | null;
  escolaridade: string | null;
  // Dados do usuário
  tentativas: number;
  acertos: number;
  ultima_resposta: string | null;
  ultima_correta: boolean | null;
  favorita: boolean;
};

export type QuestaoCompleta = QuestaoResumo & {
  gabarito: string | null;
  comentario: string | null;
  prova_id: number | null;
  hash: string | null;
};

type Linha = Omit<
  QuestaoCompleta,
  "alternativas" | "anulada" | "desatualizada" | "favorita" | "ultima_correta" | "imagens" | "texto_confiavel"
> & {
  alternativas: string;
  imagens: string;
  texto_confiavel: number;
  anulada: number;
  desatualizada: number;
  favorita: number;
  ultima_correta: number | null;
};

const SELECT_BASE = `
  SELECT q.id, q.numero, q.tipo, q.texto_base, q.enunciado, q.alternativas, q.dificuldade,
    q.anulada, q.desatualizada, q.fonte, q.imagens, q.texto_confiavel, q.gabarito, q.comentario, q.prova_id, q.hash,
    d.id AS disciplina_id, d.nome AS disciplina_nome, d.cor AS disciplina_cor,
    a.id AS assunto_id, a.nome AS assunto_nome,
    b.sigla AS banca, o.sigla AS orgao, o.nome AS orgao_nome, p.cargo, p.ano, p.escolaridade,
    (SELECT count(*) FROM respostas r WHERE r.questao_id = q.id AND r.usuario_id = @usuario) AS tentativas,
    (SELECT count(*) FROM respostas r WHERE r.questao_id = q.id AND r.usuario_id = @usuario AND r.correta = 1) AS acertos,
    (SELECT r.resposta FROM respostas r WHERE r.questao_id = q.id AND r.usuario_id = @usuario ORDER BY r.id DESC LIMIT 1) AS ultima_resposta,
    (SELECT r.correta FROM respostas r WHERE r.questao_id = q.id AND r.usuario_id = @usuario ORDER BY r.id DESC LIMIT 1) AS ultima_correta,
    EXISTS (SELECT 1 FROM favoritos f WHERE f.questao_id = q.id AND f.usuario_id = @usuario) AS favorita
  FROM questoes q
  JOIN disciplinas d ON d.id = q.disciplina_id
  LEFT JOIN assuntos a ON a.id = q.assunto_id
  LEFT JOIN provas p ON p.id = q.prova_id
  LEFT JOIN bancas b ON b.id = p.banca_id
  LEFT JOIN orgaos o ON o.id = p.orgao_id
`;

function converter(l: Linha): QuestaoCompleta {
  return {
    ...l,
    alternativas: JSON.parse(l.alternativas || "[]") as Alternativa[],
    imagens: JSON.parse(l.imagens || "[]") as ImagemQuestao[],
    texto_confiavel: l.texto_confiavel !== 0,
    anulada: !!l.anulada,
    desatualizada: !!l.desatualizada,
    favorita: !!l.favorita,
    ultima_correta: l.ultima_correta === null ? null : !!l.ultima_correta,
  };
}

/** Remove os campos que revelam a resposta. */
export function resumir(q: QuestaoCompleta): QuestaoResumo {
  const { gabarito: _g, comentario: _c, prova_id: _p, hash: _h, ...resto } = q;
  return resto;
}

/** Converte o texto digitado em uma consulta FTS5 segura (prefixos, todos os termos). */
export function consultaFts(texto: string): string | null {
  const termos = texto
    .normalize("NFC")
    .replace(/["*^():{}[\]+\-]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1)
    .slice(0, 12);
  if (!termos.length) return null;
  return termos.map((t) => `"${t}"*`).join(" ");
}

type Clausula = { where: string[]; params: Record<string, unknown> };

export function montarFiltro(f: Filtros, usuarioId: number): Clausula {
  const where: string[] = [];
  const params: Record<string, unknown> = { usuario: usuarioId };
  let n = 0;
  const em = (valores: (string | number)[]) =>
    valores
      .map((v) => {
        const nome = `p${n++}`;
        params[nome] = v;
        return `@${nome}`;
      })
      .join(", ");

  if (f.q) {
    const id = /^#?(\d+)$/.exec(f.q);
    if (id) {
      where.push("q.id = @pid");
      params.pid = Number(id[1]);
    } else {
      const fts = consultaFts(f.q);
      if (fts) {
        where.push("q.id IN (SELECT rowid FROM questoes_fts WHERE questoes_fts MATCH @fts)");
        params.fts = fts;
      }
    }
  }
  if (f.disciplinas.length) where.push(`q.disciplina_id IN (${em(f.disciplinas)})`);
  if (f.assuntos.length) {
    // Inclui os subtópicos do assunto escolhido.
    where.push(`q.assunto_id IN (
      WITH RECURSIVE sub(id) AS (
        SELECT id FROM assuntos WHERE id IN (${em(f.assuntos)})
        UNION SELECT a.id FROM assuntos a JOIN sub ON a.parent_id = sub.id
      ) SELECT id FROM sub)`);
  }
  if (f.bancas.length) where.push(`p.banca_id IN (${em(f.bancas)})`);
  if (f.orgaos.length) where.push(`p.orgao_id IN (${em(f.orgaos)})`);
  if (f.anos.length) where.push(`p.ano IN (${em(f.anos)})`);
  if (f.escolaridades.length) where.push(`p.escolaridade IN (${em(f.escolaridades)})`);
  if (f.dificuldades.length) where.push(`q.dificuldade IN (${em(f.dificuldades)})`);
  if (f.tipo) where.push(`q.tipo = ${em([f.tipo])}`);
  if (f.cargo) where.push(`p.cargo LIKE ${em([`%${f.cargo}%`])}`);
  if (!f.incluirAnuladas) where.push("q.anulada = 0");
  if (!f.incluirDesatualizadas) where.push("q.desatualizada = 0");
  if (f.favoritas) where.push("EXISTS (SELECT 1 FROM favoritos f WHERE f.questao_id = q.id AND f.usuario_id = @usuario)");
  if (f.caderno) {
    where.push(`q.id IN (SELECT cq.questao_id FROM caderno_questoes cq JOIN cadernos c ON c.id = cq.caderno_id
      WHERE c.id = ${em([f.caderno])} AND c.usuario_id = @usuario)`);
  }
  const ultima = `(SELECT r.correta FROM respostas r WHERE r.questao_id = q.id AND r.usuario_id = @usuario ORDER BY r.id DESC LIMIT 1)`;
  switch (f.status) {
    case "nao_resolvidas":
      where.push("NOT EXISTS (SELECT 1 FROM respostas r WHERE r.questao_id = q.id AND r.usuario_id = @usuario)");
      break;
    case "resolvidas":
      where.push("EXISTS (SELECT 1 FROM respostas r WHERE r.questao_id = q.id AND r.usuario_id = @usuario)");
      break;
    case "acertei":
      where.push(`${ultima} = 1`);
      break;
    case "errei":
      where.push(`${ultima} = 0`);
      break;
  }
  return { where, params };
}

function ordenacao(f: Filtros): string {
  switch (f.ordem) {
    case "antigas":
      return "ORDER BY p.ano ASC NULLS LAST, q.id ASC";
    case "aleatoria": {
      // Pseudoaleatório determinístico: a paginação continua estável.
      const semente = f.semente ?? 7919;
      return `ORDER BY ((q.id * ${semente}) % 1000003), q.id`;
    }
    case "mais_respondidas":
      return "ORDER BY (SELECT count(*) FROM respostas r WHERE r.questao_id = q.id) DESC, q.id DESC";
    case "dificeis":
      return `ORDER BY (SELECT avg(r.correta) FROM respostas r WHERE r.questao_id = q.id) ASC NULLS LAST,
        q.dificuldade DESC NULLS LAST, q.id DESC`;
    default:
      return "ORDER BY p.ano DESC NULLS LAST, q.id DESC";
  }
}

export function buscarQuestoes(f: Filtros, usuarioId: number, pagina = 1, porPagina = 10) {
  const { where, params } = montarFiltro(f, usuarioId);
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = (
    db()
      .prepare(
        `SELECT count(*) AS n FROM questoes q
         LEFT JOIN provas p ON p.id = q.prova_id ${whereSql}`,
      )
      .get(params) as { n: number }
  ).n;
  const linhas = db()
    .prepare(`${SELECT_BASE} ${whereSql} ${ordenacao(f)} LIMIT @limite OFFSET @offset`)
    .all({ ...params, limite: porPagina, offset: (pagina - 1) * porPagina }) as Linha[];
  return { total, questoes: linhas.map(converter) };
}

/** IDs que atendem aos filtros (para simulados e cadernos). */
export function idsQuestoes(f: Filtros, usuarioId: number, limite: number, aleatorio = true): number[] {
  const { where, params } = montarFiltro(f, usuarioId);
  where.push("q.gabarito IS NOT NULL");
  const ordem = aleatorio ? "ORDER BY random()" : ordenacao(f);
  return (
    db()
      .prepare(
        `SELECT q.id FROM questoes q LEFT JOIN provas p ON p.id = q.prova_id
         WHERE ${where.join(" AND ")} ${ordem} LIMIT @limite`,
      )
      .all({ ...params, limite }) as { id: number }[]
  ).map((r) => r.id);
}

export function obterQuestao(id: number, usuarioId: number): QuestaoCompleta | null {
  const linha = db().prepare(`${SELECT_BASE} WHERE q.id = @id`).get({ id, usuario: usuarioId }) as Linha | undefined;
  return linha ? converter(linha) : null;
}

export function obterQuestoesPorIds(ids: number[], usuarioId: number): QuestaoCompleta[] {
  if (!ids.length) return [];
  const linhas = db()
    .prepare(`${SELECT_BASE} WHERE q.id IN (${ids.map(() => "?").join(",")})`)
    .all(...ids.map((id) => id), { usuario: usuarioId }) as Linha[];
  const porId = new Map(linhas.map((l) => [l.id, converter(l)]));
  return ids.map((id) => porId.get(id)).filter((q): q is QuestaoCompleta => !!q);
}

export function respostasValidas(q: Pick<QuestaoCompleta, "tipo" | "alternativas">): string[] {
  return q.tipo === "certo_errado" ? ["C", "E"] : q.alternativas.map((a) => a.letra);
}

export type EstatisticasQuestao = {
  total: number;
  acertos: number;
  distribuicao: { resposta: string; n: number }[];
};

export function estatisticasQuestao(questaoId: number): EstatisticasQuestao {
  const distribuicao = db()
    .prepare("SELECT resposta, count(*) AS n FROM respostas WHERE questao_id = ? GROUP BY resposta ORDER BY resposta")
    .all(questaoId) as { resposta: string; n: number }[];
  const { total, acertos } = db()
    .prepare("SELECT count(*) AS total, ifnull(sum(correta), 0) AS acertos FROM respostas WHERE questao_id = ?")
    .get(questaoId) as { total: number; acertos: number };
  return { total, acertos, distribuicao };
}

export function registrarResposta(
  usuarioId: number,
  questaoId: number,
  resposta: string,
  tempoSeg: number | null,
  origem: "livre" | "simulado" = "livre",
) {
  const q = db().prepare("SELECT gabarito FROM questoes WHERE id = ?").get(questaoId) as
    | { gabarito: string | null }
    | undefined;
  if (!q?.gabarito) throw new Error("Questão sem gabarito cadastrado.");
  const correta = q.gabarito.toUpperCase() === resposta.toUpperCase();
  db()
    .prepare(
      "INSERT INTO respostas (usuario_id, questao_id, resposta, correta, tempo_seg, origem) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(usuarioId, questaoId, resposta.toUpperCase(), correta ? 1 : 0, tempoSeg, origem);
  return { correta, gabarito: q.gabarito.toUpperCase() };
}

/** Hash usado para evitar questões duplicadas na importação. */
export function hashQuestao(enunciado: string, alternativas: Alternativa[], textoBase?: string | null) {
  const normalizar = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  const base = [normalizar(textoBase ?? ""), normalizar(enunciado), ...alternativas.map((a) => normalizar(a.texto))].join("|");
  return crypto.createHash("sha1").update(base).digest("hex");
}

export function contarQuestoes(): number {
  return (db().prepare("SELECT count(*) AS n FROM questoes").get() as { n: number }).n;
}
