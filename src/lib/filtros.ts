// Filtros do banco de questões. Este módulo não acessa o banco de dados e pode
// ser usado tanto no servidor quanto no navegador.

export type StatusFiltro = "nao_resolvidas" | "resolvidas" | "acertei" | "errei";
export type OrdemFiltro = "recentes" | "antigas" | "aleatoria" | "mais_respondidas" | "dificeis";

export type ComFiltro = "comentario" | "imagem" | "texto";
export type OrigemFiltro = "oficial" | "autoral";

export type Filtros = {
  q?: string;
  disciplinas: number[];
  assuntos: number[];
  bancas: number[];
  orgaos: number[];
  /** Provas específicas (concurso + cargo + ano). */
  provas?: number[];
  anos: number[];
  escolaridades: string[];
  dificuldades: number[];
  /** Área/carreira (Segurança Pública, Tribunais...). */
  areas?: string[];
  cargos?: string[];
  esferas?: string[];
  ufs?: string[];
  /** Só questões com comentário, com imagem ou com texto associado. */
  com?: ComFiltro[];
  origem?: OrigemFiltro;
  tipo?: "multipla" | "certo_errado";
  cargo?: string;
  status?: StatusFiltro;
  caderno?: number;
  favoritas?: boolean;
  incluirAnuladas?: boolean;
  incluirDesatualizadas?: boolean;
  ordem: OrdemFiltro;
  semente?: number;
};

type Params = Record<string, string | string[] | undefined> | URLSearchParams;

function pegar(params: Params, chave: string): string | undefined {
  if (params instanceof URLSearchParams) return params.get(chave) ?? undefined;
  const v = params[chave];
  return Array.isArray(v) ? v[0] : v;
}

function lista(params: Params, chave: string): string[] {
  const v = pegar(params, chave);
  return v ? v.split(",").map((s) => s.trim()).filter(Boolean) : [];
}

/** Listas de textos livres (cargos, áreas) usam "|" como separador. */
function textos(params: Params, chave: string): string[] {
  const v = pegar(params, chave);
  return v ? v.split("|").map((s) => s.trim()).filter(Boolean).slice(0, 50) : [];
}

function numeros(params: Params, chave: string): number[] {
  return lista(params, chave)
    .map((s) => Number.parseInt(s, 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}

const STATUS: StatusFiltro[] = ["nao_resolvidas", "resolvidas", "acertei", "errei"];
const ORDENS: OrdemFiltro[] = ["recentes", "antigas", "aleatoria", "mais_respondidas", "dificeis"];

export function lerFiltros(params: Params): Filtros {
  const tipo = pegar(params, "tipo");
  const status = pegar(params, "st") as StatusFiltro | undefined;
  const ordem = pegar(params, "ord") as OrdemFiltro | undefined;
  const caderno = Number.parseInt(pegar(params, "cad") ?? "", 10);
  const semente = Number.parseInt(pegar(params, "seed") ?? "", 10);
  return {
    q: pegar(params, "q")?.trim() || undefined,
    disciplinas: numeros(params, "d"),
    assuntos: numeros(params, "a"),
    bancas: numeros(params, "b"),
    orgaos: numeros(params, "o"),
    provas: numeros(params, "pv"),
    anos: numeros(params, "ano"),
    areas: textos(params, "ar"),
    cargos: textos(params, "cg"),
    esferas: lista(params, "esf").filter((e) => ["federal", "estadual", "municipal", "distrital"].includes(e)),
    ufs: lista(params, "uf").filter((u) => /^[A-Z]{2}$/.test(u)),
    com: lista(params, "com").filter((c): c is ComFiltro => ["comentario", "imagem", "texto"].includes(c)),
    origem: ((o) => (o === "oficial" || o === "autoral" ? o : undefined))(pegar(params, "orig")),
    escolaridades: lista(params, "esc").filter((e) => ["fundamental", "medio", "superior"].includes(e)),
    dificuldades: numeros(params, "dif").filter((n) => n <= 3),
    tipo: tipo === "multipla" || tipo === "certo_errado" ? tipo : undefined,
    cargo: pegar(params, "cargo")?.trim() || undefined,
    status: status && STATUS.includes(status) ? status : undefined,
    caderno: Number.isFinite(caderno) && caderno > 0 ? caderno : undefined,
    favoritas: pegar(params, "fav") === "1",
    incluirAnuladas: pegar(params, "anul") === "1",
    incluirDesatualizadas: pegar(params, "desat") === "1",
    ordem: ordem && ORDENS.includes(ordem) ? ordem : "recentes",
    semente: Number.isFinite(semente) && semente > 0 ? semente : undefined,
  };
}

export function filtrosParaParams(f: Partial<Filtros>): URLSearchParams {
  const p = new URLSearchParams();
  const definir = (chave: string, valor: string | number | undefined | false) => {
    if (valor !== undefined && valor !== false && valor !== "") p.set(chave, String(valor));
  };
  definir("q", f.q);
  if (f.disciplinas?.length) p.set("d", f.disciplinas.join(","));
  if (f.assuntos?.length) p.set("a", f.assuntos.join(","));
  if (f.bancas?.length) p.set("b", f.bancas.join(","));
  if (f.orgaos?.length) p.set("o", f.orgaos.join(","));
  if (f.provas?.length) p.set("pv", f.provas.join(","));
  if (f.anos?.length) p.set("ano", f.anos.join(","));
  if (f.areas?.length) p.set("ar", f.areas.join("|"));
  if (f.cargos?.length) p.set("cg", f.cargos.join("|"));
  if (f.esferas?.length) p.set("esf", f.esferas.join(","));
  if (f.ufs?.length) p.set("uf", f.ufs.join(","));
  if (f.com?.length) p.set("com", f.com.join(","));
  definir("orig", f.origem);
  if (f.escolaridades?.length) p.set("esc", f.escolaridades.join(","));
  if (f.dificuldades?.length) p.set("dif", f.dificuldades.join(","));
  definir("tipo", f.tipo);
  definir("cargo", f.cargo);
  definir("st", f.status);
  definir("cad", f.caderno);
  if (f.favoritas) p.set("fav", "1");
  if (f.incluirAnuladas) p.set("anul", "1");
  if (f.incluirDesatualizadas) p.set("desat", "1");
  if (f.ordem && f.ordem !== "recentes") p.set("ord", f.ordem);
  definir("seed", f.semente);
  return p;
}

export function contarFiltrosAtivos(f: Filtros): number {
  return (
    (f.q ? 1 : 0) +
    f.disciplinas.length +
    f.assuntos.length +
    f.bancas.length +
    f.orgaos.length +
    f.anos.length +
    (f.provas?.length ?? 0) +
    (f.areas?.length ?? 0) +
    (f.cargos?.length ?? 0) +
    (f.esferas?.length ?? 0) +
    (f.ufs?.length ?? 0) +
    (f.com?.length ?? 0) +
    (f.origem ? 1 : 0) +
    f.escolaridades.length +
    f.dificuldades.length +
    (f.tipo ? 1 : 0) +
    (f.cargo ? 1 : 0) +
    (f.status ? 1 : 0) +
    (f.caderno ? 1 : 0) +
    (f.favoritas ? 1 : 0)
  );
}
