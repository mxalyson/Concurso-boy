import { areaPorRegras } from "./areas";
import { db } from "./db";
import { slugify } from "./utils";

export type Disciplina = { id: number; nome: string; slug: string; cor: string; total: number };
export type Assunto = {
  id: number;
  disciplina_id: number;
  parent_id: number | null;
  nome: string;
  ordem: number;
  total: number;
};
export type AssuntoNo = Assunto & { filhos: AssuntoNo[]; totalComFilhos: number };
export type Banca = { id: number; sigla: string; nome: string; total: number };
export type Orgao = { id: number; sigla: string; nome: string; esfera: string | null; uf: string | null; total: number };

const PALETA = [
  "#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#14b8a6", "#f97316", "#ec4899", "#84cc16", "#06b6d4", "#a855f7",
];

export function listarDisciplinas(): Disciplina[] {
  return db()
    .prepare(
      `SELECT d.id, d.nome, d.slug, d.cor,
         (SELECT count(*) FROM questoes q WHERE q.disciplina_id = d.id) AS total
       FROM disciplinas d ORDER BY d.nome`,
    )
    .all() as Disciplina[];
}

export function disciplinaPorSlug(slug: string) {
  return db().prepare("SELECT id, nome, slug, cor FROM disciplinas WHERE slug = ?").get(slug) as
    | Omit<Disciplina, "total">
    | undefined;
}

export function listarAssuntos(disciplinaId?: number): Assunto[] {
  const where = disciplinaId ? "WHERE a.disciplina_id = ?" : "";
  return db()
    .prepare(
      `SELECT a.id, a.disciplina_id, a.parent_id, a.nome, a.ordem,
         (SELECT count(*) FROM questoes q WHERE q.assunto_id = a.id) AS total
       FROM assuntos a ${where}
       ORDER BY a.ordem, a.nome`,
    )
    .all(...(disciplinaId ? [disciplinaId] : [])) as Assunto[];
}

/** Monta a árvore de assuntos (tópicos e subtópicos). */
export function arvoreAssuntos(assuntos: Assunto[]): AssuntoNo[] {
  const nos = new Map<number, AssuntoNo>();
  for (const a of assuntos) nos.set(a.id, { ...a, filhos: [], totalComFilhos: a.total });
  const raizes: AssuntoNo[] = [];
  for (const no of nos.values()) {
    const pai = no.parent_id ? nos.get(no.parent_id) : undefined;
    if (pai) pai.filhos.push(no);
    else raizes.push(no);
  }
  const somar = (no: AssuntoNo): number => {
    no.totalComFilhos = no.total + no.filhos.reduce((s, f) => s + somar(f), 0);
    return no.totalComFilhos;
  };
  raizes.forEach(somar);
  return raizes;
}

/** Lista plana com indentação, útil para selects. */
export function assuntosIndentados(assuntos: Assunto[]) {
  const saida: { id: number; disciplina_id: number; nome: string; nivel: number; caminho: string }[] = [];
  const visitar = (nos: AssuntoNo[], nivel: number, prefixo: string) => {
    for (const no of nos) {
      const caminho = prefixo ? `${prefixo} > ${no.nome}` : no.nome;
      saida.push({ id: no.id, disciplina_id: no.disciplina_id, nome: no.nome, nivel, caminho });
      visitar(no.filhos, nivel + 1, caminho);
    }
  };
  visitar(arvoreAssuntos(assuntos), 0, "");
  return saida;
}

export function listarBancas(): Banca[] {
  return db()
    .prepare(
      `SELECT b.id, b.sigla, b.nome,
         (SELECT count(*) FROM questoes q JOIN provas p ON p.id = q.prova_id WHERE p.banca_id = b.id) AS total
       FROM bancas b ORDER BY b.sigla`,
    )
    .all() as Banca[];
}

export function listarOrgaos(): Orgao[] {
  return db()
    .prepare(
      `SELECT o.id, o.sigla, o.nome, o.esfera, o.uf,
         (SELECT count(*) FROM questoes q JOIN provas p ON p.id = q.prova_id WHERE p.orgao_id = o.id) AS total
       FROM orgaos o ORDER BY o.sigla`,
    )
    .all() as Orgao[];
}

export function listarAnos(): number[] {
  return (
    db()
      .prepare("SELECT DISTINCT ano FROM provas WHERE ano IS NOT NULL ORDER BY ano DESC")
      .all() as { ano: number }[]
  ).map((r) => r.ano);
}

export function listarCargos(): string[] {
  return (
    db()
      .prepare("SELECT DISTINCT cargo FROM provas WHERE cargo IS NOT NULL AND cargo <> '' ORDER BY cargo")
      .all() as { cargo: string }[]
  ).map((r) => r.cargo);
}

// --- "Obter ou criar", usados na importação e no cadastro ------------------

export function obterOuCriarDisciplina(nome: string): number {
  const limpo = nome.trim();
  const existente = db().prepare("SELECT id FROM disciplinas WHERE nome = ? COLLATE NOCASE").get(limpo) as
    | { id: number }
    | undefined;
  if (existente) return existente.id;
  const qtd = (db().prepare("SELECT count(*) AS n FROM disciplinas").get() as { n: number }).n;
  let slug = slugify(limpo) || `disciplina-${qtd + 1}`;
  if (db().prepare("SELECT 1 FROM disciplinas WHERE slug = ?").get(slug)) slug = `${slug}-${qtd + 1}`;
  return Number(
    db()
      .prepare("INSERT INTO disciplinas (nome, slug, cor) VALUES (?, ?, ?)")
      .run(limpo, slug, PALETA[qtd % PALETA.length]).lastInsertRowid,
  );
}

/** Aceita caminho hierárquico: "Atos administrativos > Atributos". */
export function obterOuCriarAssunto(disciplinaId: number, caminho: string): number | null {
  const partes = caminho
    .split(">")
    .map((p) => p.trim())
    .filter(Boolean);
  let pai: number | null = null;
  for (const nome of partes) {
    const existente = db()
      .prepare(
        "SELECT id FROM assuntos WHERE disciplina_id = ? AND ifnull(parent_id, 0) = ? AND nome = ? COLLATE NOCASE",
      )
      .get(disciplinaId, pai ?? 0, nome) as { id: number } | undefined;
    if (existente) {
      pai = existente.id;
      continue;
    }
    const ordem: number = (
      db()
        .prepare("SELECT count(*) AS n FROM assuntos WHERE disciplina_id = ? AND ifnull(parent_id, 0) = ?")
        .get(disciplinaId, pai ?? 0) as { n: number }
    ).n;
    pai = Number(
      db()
        .prepare("INSERT INTO assuntos (disciplina_id, parent_id, nome, ordem) VALUES (?, ?, ?, ?)")
        .run(disciplinaId, pai, nome, ordem).lastInsertRowid,
    );
  }
  return pai;
}

export function obterOuCriarBanca(sigla: string, nome?: string): number {
  const s = sigla.trim();
  const existente = db().prepare("SELECT id FROM bancas WHERE sigla = ? COLLATE NOCASE").get(s) as
    | { id: number }
    | undefined;
  if (existente) return existente.id;
  return Number(db().prepare("INSERT INTO bancas (sigla, nome) VALUES (?, ?)").run(s, nome?.trim() || s).lastInsertRowid);
}

export function obterOuCriarOrgao(
  sigla: string,
  dados: { nome?: string; esfera?: string | null; uf?: string | null } = {},
): number {
  const s = sigla.trim();
  const existente = db().prepare("SELECT id FROM orgaos WHERE sigla = ? COLLATE NOCASE").get(s) as
    | { id: number }
    | undefined;
  if (existente) return existente.id;
  return Number(
    db()
      .prepare("INSERT INTO orgaos (sigla, nome, esfera, uf) VALUES (?, ?, ?, ?)")
      .run(s, dados.nome?.trim() || s, dados.esfera ?? null, dados.uf ?? null).lastInsertRowid,
  );
}

/** De onde veio a prova: cadastro manual ou coleta automática dos PDFs das bancas. */
export type OrigemProva = "manual" | "automatica";

export function obterOuCriarProva(dados: {
  bancaId: number | null;
  orgaoId: number | null;
  cargo?: string | null;
  ano?: number | null;
  escolaridade?: string | null;
  urlProva?: string | null;
  urlGabarito?: string | null;
  origem?: OrigemProva;
  /** Área/carreira; sem ela, é deduzida do órgão e do cargo. */
  area?: string | null;
}): number {
  const existente = db()
    .prepare(
      `SELECT id FROM provas WHERE ifnull(banca_id, 0) = ? AND ifnull(orgao_id, 0) = ?
         AND ifnull(cargo, '') = ? AND ifnull(ano, 0) = ?`,
    )
    .get(dados.bancaId ?? 0, dados.orgaoId ?? 0, dados.cargo ?? "", dados.ano ?? 0) as { id: number } | undefined;
  if (existente) {
    if (dados.area) db().prepare("UPDATE provas SET area = ? WHERE id = ? AND area IS NULL").run(dados.area, existente.id);
    return existente.id;
  }
  const orgao = dados.orgaoId
    ? (db().prepare("SELECT sigla, nome FROM orgaos WHERE id = ?").get(dados.orgaoId) as { sigla: string; nome: string } | undefined)
    : undefined;
  const area = dados.area || areaPorRegras(orgao?.sigla, orgao?.nome, dados.cargo);
  return Number(
    db()
      .prepare(
        `INSERT INTO provas (banca_id, orgao_id, cargo, ano, escolaridade, url_prova, url_gabarito, origem, area)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        dados.bancaId,
        dados.orgaoId,
        dados.cargo || null,
        dados.ano ?? null,
        dados.escolaridade ?? null,
        dados.urlProva ?? null,
        dados.urlGabarito ?? null,
        dados.origem ?? "manual",
        area,
      ).lastInsertRowid,
  );
}
