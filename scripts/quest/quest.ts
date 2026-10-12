// Baixa questões da Quest API (https://quest.api.br) para arquivos de lote em data/provas/
// (um JSON por prova) e as imagens para data/imagens/quest/. O site não acessa a API: os
// arquivos gerados são importados como as demais provas (npm run db:seed ou npm run import).
//
// Custos (créditos): listar provas = 1 por prova; questões = 3 por questão (6 com gabarito).
// /quota e os filtros são gratuitos. A chave fica em QUEST_API_KEY (.env.local, fora do git).
import fs from "node:fs";
import path from "node:path";

export const BASE = process.env.QUEST_API_URL || "https://api.quest.api.br";

export class ErroQuest extends Error {
  constructor(
    public status: number,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

type Parametros = Record<string, string | number | boolean | undefined | null>;

async function questGet<T>(rota: string, params: Parametros = {}, tentativas = 4): Promise<T> {
  const chave = process.env.QUEST_API_KEY;
  if (!chave) throw new ErroQuest(401, "QUEST_API_KEY não configurada");
  const url = new URL(BASE + rota);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  for (let i = 0; ; i++) {
    const r = await fetch(url, { headers: { "X-API-Key": chave, Accept: "application/json" }, signal: AbortSignal.timeout(60_000) });
    if (r.status === 429 && i < tentativas) {
      const espera = Number(r.headers.get("retry-after")) || 2 ** i * 5;
      await new Promise((ok) => setTimeout(ok, espera * 1000));
      continue;
    }
    const corpo = (await r.json().catch(() => null)) as { data?: T; message?: string } | null;
    if (!r.ok) throw new ErroQuest(r.status, corpo?.message || `HTTP ${r.status} em ${rota}`);
    return corpo?.data as T;
  }
}

// --- Tipos da API --------------------------------------------------------------

export type ProvaQuest = {
  id: string;
  orgao: string;
  cargo: string;
  ano: string;
  banca: string;
  alternative_type?: string;
  nivel_escolaridade?: string;
  uf?: string;
  esfera?: string;
  total_questoes?: number;
};

export type QuestaoQuest = {
  id: string;
  numero: string;
  enunciado: string;
  alternativas: { letra: string; texto: string; imagens?: string[] }[];
  gabarito?: string | null;
  provas: ProvaQuest[];
  classificacao?: { materia?: string | null; assunto?: string | null };
  textos_associados?: string[];
  anexos?: string[];
  dificuldade?: number | null;
  tipo?: string;
  anulada?: boolean;
};

export type Quota = { planCode: string | null; used: number; quotaPerCycle: number | null; remaining: number; percentUsed: number | null; periodEnd: string | null; unlimited: boolean };

export const obterQuota = () => questGet<Quota>("/quota");
export const obterEstatisticas = () => questGet<Record<string, number>>("/v2/stats");

export type FiltrosProva = { banca?: string; ano?: string; orgao?: string; cargo?: string; uf?: string; esfera?: string; nivel_escolaridade?: string };

export function listarProvas(filtros: FiltrosProva, page = 1, perPage = 20) {
  return questGet<{ total: number; page: number; per_page: number; items: ProvaQuest[] }>("/v2/provas", { ...filtros, page, per_page: perPage });
}

export function listarBancas(q?: string) {
  return questGet<{ items: string[] }>("/v2/filtros/bancas", { q, per_page: 100 });
}

// --- Conversão do HTML da API para o texto da plataforma ---------------------------

const ENTIDADES: Record<string, string> = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", ordm: "º", ordf: "ª", deg: "°", sect: "§",
  ndash: "–", mdash: "—", hellip: "…", laquo: "«", raquo: "»", ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’",
  middot: "·", times: "×", divide: "÷", plusmn: "±", le: "≤", ge: "≥", ne: "≠", minus: "−", bull: "•",
  sup2: "²", sup3: "³", frac12: "½", frac14: "¼", frac34: "¾", euro: "€", copy: "©", reg: "®", trade: "™",
};

function decodificar(t: string) {
  return t.replace(/&(#x?[0-9a-f]+|[a-z0-9]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1].toLowerCase() === "x" ? Number.parseInt(e.slice(2), 16) : Number.parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTIDADES[e.toLowerCase()] ?? m;
  });
}

const SOBRESCRITO: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻", "−": "⁻", "(": "⁽", ")": "⁾", n: "ⁿ", i: "ⁱ", o: "º", a: "ª" };
const SUBSCRITO: Record<string, string> = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉", "+": "₊", "-": "₋", "(": "₍", ")": "₎" };

function indice(t: string, mapa: Record<string, string>, prefixo: string) {
  const limpo = t.trim();
  if ([...limpo].every((c) => mapa[c])) return [...limpo].map((c) => mapa[c]).join("");
  return `${prefixo}(${limpo})`;
}

const LATEX: Record<string, string> = {
  times: "×", cdot: "·", div: "÷", pm: "±", leq: "≤", le: "≤", geq: "≥", ge: "≥", neq: "≠", ne: "≠", approx: "≈",
  infty: "∞", sum: "∑", prod: "∏", int: "∫", sqrt: "√", rightarrow: "→", to: "→", leftarrow: "←", Rightarrow: "⇒",
  Leftrightarrow: "⇔", in: "∈", notin: "∉", subset: "⊂", subseteq: "⊆", cup: "∪", cap: "∩", emptyset: "∅",
  forall: "∀", exists: "∃", neg: "¬", wedge: "∧", vee: "∨", alpha: "α", beta: "β", gamma: "γ", delta: "δ",
  Delta: "Δ", epsilon: "ε", theta: "θ", lambda: "λ", mu: "μ", pi: "π", rho: "ρ", sigma: "σ", Sigma: "Σ",
  tau: "τ", phi: "φ", omega: "ω", Omega: "Ω", ldots: "…", cdots: "⋯", circ: "°", "%": "%", ",": " ", ";": " ", " ": " ",
  quad: " ", qquad: " ", displaystyle: "", limits: "", nolimits: "", "!": "", mid: "|", lvert: "|", rvert: "|", vert: "|",
  sim: "~", equiv: "≡", cong: "≅", propto: "∝", partial: "∂", nabla: "∇", angle: "∠", perp: "⊥", parallel: "∥", star: "⋆",
};

/** Converte LaTeX simples (fórmulas do editor da API) em texto legível. */
export function latexParaTexto(tex: string): string {
  let t = tex;
  for (let i = 0; i < 6; i++) {
    const antes = t;
    t = t
      .replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, (_, a: string, b: string) => `${a.length > 1 ? `(${a})` : a}/${b.length > 1 ? `(${b})` : b}`)
      .replace(/\\sqrt\s*\[([^\]]*)\]\s*\{([^{}]*)\}/g, "$1√($2)")
      .replace(/\\sqrt\s*\{([^{}]*)\}/g, "√($1)")
      .replace(/\\(?:text|mathrm|mathbf|mathit|operatorname|textbf|overline|bar|hat|vec)\s*\{([^{}]*)\}/g, "$1")
      .replace(/\^\s*\{([^{}]*)\}/g, (_, a: string) => indice(a, SOBRESCRITO, "^"))
      .replace(/_\s*\{([^{}]*)\}/g, (_, a: string) => indice(a, SUBSCRITO, "_"));
    if (t === antes) break;
  }
  return t
    .replace(/\^\s*([0-9a-z+\-])/gi, (_, a: string) => indice(a, SOBRESCRITO, "^"))
    .replace(/_\s*([0-9])/g, (_, a: string) => indice(a, SUBSCRITO, "_"))
    .replace(/\\left|\\right|\\big|\\Big/g, "")
    .replace(/\\([a-zA-Z]+|[%,; !])/g, (m, c: string) => LATEX[c] ?? c)
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

type No = { tag: string; attrs: Record<string, string>; filhos: (No | string)[] };

const VAZIAS = new Set(["img", "br", "hr", "input", "meta", "link", "col", "wbr"]);
const IGNORAR = new Set(["script", "style", "annotation", "semantics", "math", "svg", "head", "title"]);
const BLOCOS = new Set(["p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "li", "ul", "ol", "blockquote", "pre", "table", "section"]);

/** Parser de HTML tolerante (o suficiente para o HTML gerado pelo editor da API). */
function arvoreHtml(html: string): No {
  const raiz: No = { tag: "#raiz", attrs: {}, filhos: [] };
  const pilha: No[] = [raiz];
  const re = /<!--[\s\S]*?-->|<\/?([a-zA-Z][\w-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*\/?>|[^<]+|</g;
  for (const m of html.matchAll(re)) {
    const t = m[0];
    const atual = pilha[pilha.length - 1];
    if (t.startsWith("<!--")) continue;
    if (!m[1]) {
      atual.filhos.push(t);
      continue;
    }
    const tag = m[1].toLowerCase();
    if (t.startsWith("</")) {
      const k = pilha.map((n) => n.tag).lastIndexOf(tag);
      if (k > 0) pilha.length = k;
      continue;
    }
    const attrs: Record<string, string> = {};
    for (const a of (m[2] ?? "").matchAll(/([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))
      attrs[a[1].toLowerCase()] = decodificar(a[2] ?? a[3] ?? a[4] ?? "");
    const no: No = { tag, attrs, filhos: [] };
    atual.filhos.push(no);
    if (!VAZIAS.has(tag) && !t.endsWith("/>")) pilha.push(no);
  }
  return raiz;
}

/**
 * Converte o HTML da API em texto simples. Imagens viram marcadores [[img:N]], com N o
 * índice da URL em `imagens` (lista compartilhada entre as partes da questão); tabelas
 * viram linhas "| a | b |"; fórmulas LaTeX viram texto com símbolos Unicode.
 */
export function htmlParaTexto(html: string, imagens: string[]): string {
  const marcarImagem = (src: string) => {
    let i = imagens.indexOf(src);
    if (i < 0) i = imagens.push(src) - 1;
    return `\n[[img:${i}]]\n`;
  };
  const plano = (t: string) => t.replace(/\s*\n\s*/g, " ").replace(/\s+/g, " ").trim();
  const visitar = (no: No | string): string => {
    if (typeof no === "string") return decodificar(no).replace(/[\u200b\u200c\u200d\ufeff]/g, "").replace(/\s+/g, " ");
    const { tag, attrs } = no;
    if (IGNORAR.has(tag)) return "";
    if (tag === "img") return attrs.src ? marcarImagem(attrs.src) : "";
    if (tag === "br") return "\n";
    if ((attrs.class ?? "").includes("ql-formula") || (attrs.class ?? "").includes("katex")) {
      const tex = attrs["data-value"] ?? "";
      return tex ? ` ${latexParaTexto(tex)} ` : no.filhos.map(visitar).join("");
    }
    const dentro = () => no.filhos.map(visitar).join("");
    if (tag === "sup") return indice(plano(dentro()), SOBRESCRITO, "^");
    if (tag === "sub") return indice(plano(dentro()), SUBSCRITO, "_");
    if (tag === "table") {
      const linhas: string[] = [];
      const coletar = (n: No) => {
        for (const f of n.filhos) {
          if (typeof f === "string") continue;
          if (f.tag === "tr") {
            const celulas = f.filhos.filter((c): c is No => typeof c !== "string" && (c.tag === "td" || c.tag === "th"));
            linhas.push(`| ${celulas.map((c) => plano(c.filhos.map(visitar).join(" ")).replace(/\|/g, "/") || " ").join(" | ")} |`);
          } else coletar(f);
        }
      };
      coletar(no);
      return `\n${linhas.join("\n")}\n`;
    }
    if (tag === "li") return `\n• ${dentro().trim()}\n`;
    if (BLOCOS.has(tag)) return `\n${dentro()}\n`;
    return dentro();
  };
  return visitar(arvoreHtml(html))
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\n\n•/g, "\n•")
    .trim();
}

// --- Conversão de questões -------------------------------------------------------

const BANCAS: Record<string, string> = {
  "CESPE CEBRASPE": "CEBRASPE",
  "Instituto AOCP": "AOCP",
  "Instituto Consulplan": "CONSULPLAN",
  "Instituto CONSULPAM": "CONSULPAM",
};

function siglaBanca(b: string) {
  return BANCAS[b] ?? b;
}

function escolaridade(n?: string) {
  if (!n) return undefined;
  const s = n.toLowerCase();
  return s.startsWith("fund") ? "fundamental" : s.startsWith("m") ? "medio" : s.startsWith("sup") ? "superior" : undefined;
}

/** Questão no formato de importação da plataforma (ver src/lib/importacao.ts). */
export type QuestaoLote = {
  numero: string;
  disciplina: string;
  assunto?: string;
  tipo: "certo_errado" | "multipla";
  texto_base?: string;
  enunciado: string;
  alternativas: { letra: string; texto: string }[];
  gabarito?: string;
  anulada: boolean;
  dificuldade?: string;
  fonte?: string;
  imagens?: { src: string; parte: "inline" }[];
};

export type CamposProvaLote = { banca?: string; banca_nome?: string; orgao?: string; cargo?: string; ano?: string; uf?: string; esfera?: string; escolaridade?: string };

type Convertida = { questao: QuestaoLote; prova: CamposProvaLote; urls: string[] };

export function converterQuestao(q: QuestaoQuest, gabarito?: string | null): Convertida {
  const urls: string[] = [];
  const prova = q.provas?.[0];
  const ce = (prova?.alternative_type ?? q.tipo ?? "").toUpperCase().replace(/\s/g, "_").includes("CERTO");
  const textoBase = (q.textos_associados ?? []).map((h) => htmlParaTexto(h, urls)).filter(Boolean).join("\n\n");
  let enunciado = htmlParaTexto(q.enunciado || "", urls);
  const alternativas = ce
    ? []
    : q.alternativas.map((a) => {
        let texto = htmlParaTexto(a.texto || "", urls);
        for (const img of a.imagens ?? []) {
          if (!urls.includes(img)) urls.push(img);
          texto += `${texto ? " " : ""}[[img:${urls.indexOf(img)}]]`;
        }
        return { letra: a.letra, texto: texto || "(imagem)" };
      });
  // anexos que não aparecem no HTML ficam ao final do enunciado
  for (const a of q.anexos ?? []) {
    if (!urls.includes(a)) enunciado += `\n[[img:${urls.push(a) - 1}]]`;
  }
  const g = gabarito ?? q.gabarito;
  const dif = q.dificuldade ?? null;
  const ano = prova?.ano;
  return {
    urls,
    questao: {
      numero: q.numero,
      disciplina: q.classificacao?.materia || "Conhecimentos Gerais",
      assunto: q.classificacao?.assunto || undefined,
      tipo: ce ? "certo_errado" : "multipla",
      texto_base: textoBase || undefined,
      enunciado: enunciado || "(questão em imagem)",
      alternativas,
      gabarito: q.anulada ? "X" : (g ?? undefined),
      anulada: !!q.anulada,
      dificuldade: dif ? String(dif <= 2 ? 1 : dif === 3 ? 2 : 3) : undefined,
      fonte: prova ? `${siglaBanca(prova.banca)} ${ano ?? ""} – ${prova.orgao} – ${prova.cargo}, questão ${q.numero}`.replace(/\s+/g, " ") : undefined,
    },
    prova: {
      banca: prova ? siglaBanca(prova.banca) : undefined,
      banca_nome: prova?.banca,
      orgao: prova?.orgao,
      cargo: prova?.cargo,
      ano,
      uf: prova?.uf && prova.uf !== "BR" ? prova.uf : undefined,
      esfera: prova?.esfera?.toLowerCase(),
      escolaridade: escolaridade(prova?.nivel_escolaridade),
    },
  };
}

// --- Gravação dos lotes ---------------------------------------------------------------

const RAIZ = process.cwd();
export const PASTA_PROVAS = path.join(RAIZ, "data/provas");
export const PASTA_IMAGENS = path.join(RAIZ, "data/imagens");

function slug(t: string) {
  return t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

export function arquivoProva(p: ProvaQuest) {
  return path.join(PASTA_PROVAS, `${slug(siglaBanca(p.banca))}-${p.ano}-${slug(p.orgao)}-${slug(p.cargo)}-q${p.id}.json`);
}

/** Baixa as imagens da questão para data/imagens/quest/<id>/ e devolve os caminhos relativos. */
async function baixarImagens(idQuestao: string, urls: string[]): Promise<string[]> {
  const pasta = path.join(PASTA_IMAGENS, "quest", idQuestao.replace(/\W/g, ""));
  const saida: string[] = [];
  for (const [i, url] of urls.entries()) {
    const ext = (/\.(png|jpe?g|webp|gif)(?:\?|$)/i.exec(url)?.[1] ?? "webp").toLowerCase();
    const destino = path.join(pasta, `${String(i + 1).padStart(2, "0")}.${ext}`);
    if (!fs.existsSync(destino)) {
      const r = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      if (!r.ok) throw new Error(`Falha ao baixar imagem ${url}: HTTP ${r.status}`);
      fs.mkdirSync(pasta, { recursive: true });
      fs.writeFileSync(destino, Buffer.from(await r.arrayBuffer()));
    }
    saida.push(path.relative(PASTA_IMAGENS, destino).split(path.sep).join("/"));
  }
  return saida;
}

/**
 * Converte as questões, baixa as imagens e grava/atualiza um lote por prova em data/provas.
 * Questões já presentes no arquivo (mesmo número) são substituídas. Retorna os arquivos alterados.
 */
export async function gravarQuestoes(itens: { q: QuestaoQuest; gabarito?: string | null; prova?: ProvaQuest }[]) {
  const porArquivo = new Map<string, { prova: CamposProvaLote; questoes: Map<string, QuestaoLote> }>();
  for (const { q, gabarito, prova } of itens) {
    const qq = prova && !q.provas?.length ? { ...q, provas: [prova] } : q;
    const p = qq.provas?.[0];
    if (!p) continue;
    const { questao, prova: campos, urls } = converterQuestao(qq, gabarito);
    if (!questao.gabarito && !questao.anulada) continue; // sem gabarito oficial não entra
    if (urls.length) questao.imagens = (await baixarImagens(q.id, urls)).map((src) => ({ src, parte: "inline" as const }));
    const arquivo = arquivoProva(p);
    let lote = porArquivo.get(arquivo);
    if (!lote) {
      const existente = fs.existsSync(arquivo) ? (JSON.parse(fs.readFileSync(arquivo, "utf8")) as { questoes: QuestaoLote[] }) : null;
      lote = { prova: campos, questoes: new Map((existente?.questoes ?? []).map((x) => [x.numero, x])) };
      porArquivo.set(arquivo, lote);
    }
    lote.questoes.set(questao.numero, questao);
  }
  fs.mkdirSync(PASTA_PROVAS, { recursive: true });
  for (const [arquivo, lote] of porArquivo) {
    const questoes = [...lote.questoes.values()].sort((a, b) => Number(a.numero) - Number(b.numero));
    fs.writeFileSync(arquivo, JSON.stringify({ prova: lote.prova, questoes }, null, 1) + "\n");
  }
  return [...porArquivo.keys()];
}

// Respostas brutas da API ficam em .cache/quest (fora do git) para permitir reconverter
// os lotes depois (ex.: melhorias no conversor) sem gastar créditos.
const PASTA_CACHE = path.join(RAIZ, ".cache/quest");

function guardarBruto(nome: string, dados: unknown) {
  fs.mkdirSync(PASTA_CACHE, { recursive: true });
  fs.writeFileSync(path.join(PASTA_CACHE, nome), JSON.stringify(dados));
}

/** Refaz os lotes a partir das respostas guardadas em .cache/quest (não gasta créditos). */
export async function reconverter() {
  if (!fs.existsSync(PASTA_CACHE)) return [];
  const arquivos = new Set<string>();
  for (const nome of fs.readdirSync(PASTA_CACHE).sort()) {
    const d = JSON.parse(fs.readFileSync(path.join(PASTA_CACHE, nome), "utf8"));
    if (nome.startsWith("prova-")) {
      const mapa = new Map((d.gabarito.gabaritos as { questao_id: string; gabarito: string }[]).map((g) => [g.questao_id, g.gabarito]));
      for (const a of await gravarQuestoes((d.prova.items as QuestaoQuest[]).map((q) => ({ q, gabarito: mapa.get(q.id), prova: d.prova.prova })))) arquivos.add(a);
    } else {
      for (const a of await gravarQuestoes((d.items as QuestaoQuest[]).map((q) => ({ q })))) arquivos.add(a);
    }
  }
  return [...arquivos];
}

/** Baixa uma prova inteira (questões + gabarito). Custo: 6 créditos por questão. */
export async function baixarProva(idProva: string) {
  const id = encodeURIComponent(idProva);
  const dados = await questGet<{ prova: ProvaQuest; total_questoes: number; items: QuestaoQuest[] }>(`/v2/provas/${id}`);
  const gab = await questGet<{ gabaritos: { questao_id: string; gabarito: string }[] }>(`/v2/provas/${id}/gabarito`);
  guardarBruto(`prova-${idProva.replace(/\W/g, "")}.json`, { prova: dados, gabarito: gab });
  const mapa = new Map(gab.gabaritos.map((g) => [g.questao_id, g.gabarito]));
  const arquivos = await gravarQuestoes(dados.items.map((q) => ({ q, gabarito: mapa.get(q.id), prova: dados.prova })));
  return { prova: dados.prova, questoes: dados.items.length, comGabarito: mapa.size, arquivos };
}

// --- Busca incremental de provas novas ---------------------------------------------

export type FiltrosBusca = { banca?: string; ano?: string; materia?: string; uf?: string; esfera?: string; nivel_escolaridade?: string; orgao?: string; cargo?: string };

const ARQUIVO_ESTADO = path.join(RAIZ, "data/quest-estado.json");

type Estado = { cursores: Record<string, string | null> };

function lerEstado(): Estado {
  return fs.existsSync(ARQUIVO_ESTADO) ? JSON.parse(fs.readFileSync(ARQUIVO_ESTADO, "utf8")) : { cursores: {} };
}

/**
 * Percorre o acervo em ordem de id (questões novas entram com ids maiores), continuando
 * do cursor salvo em data/quest-estado.json para cada filtro, até gastar o orçamento.
 * Rodar de novo depois traz só o que entrou desde a última vez (provas novas).
 */
export async function baixarNovas(filtros: FiltrosBusca[], maxCreditos: number, log: (m: string) => void = console.log) {
  const estado = lerEstado();
  let orcamento = maxCreditos;
  let total = 0;
  const arquivos = new Set<string>();
  for (const f of filtros) {
    const chave = JSON.stringify(f);
    let cursor = estado.cursores[chave] ?? null;
    let fim = false;
    while (orcamento >= 6 && !fim) {
      const pagina = await questGet<{ items: QuestaoQuest[]; next_cursor: string | null; has_more: boolean }>("/v2/questoes", {
        ...f,
        include_gabarito: true,
        include_total: false,
        per_page: Math.min(50, Math.floor(orcamento / 6)),
        after_id: cursor ?? undefined,
      });
      orcamento -= pagina.items.length * 6;
      if (pagina.items.length) guardarBruto(`questoes-${pagina.items[0].id.replace(/\W/g, "")}.json`, pagina);
      total += pagina.items.length;
      for (const a of await gravarQuestoes(pagina.items.map((q) => ({ q })))) arquivos.add(a);
      if (pagina.items.length) cursor = pagina.next_cursor ?? pagina.items[pagina.items.length - 1].id;
      estado.cursores[chave] = cursor;
      fs.writeFileSync(ARQUIVO_ESTADO, JSON.stringify(estado, null, 1) + "\n");
      fim = !pagina.has_more || !pagina.items.length;
    }
    log(`Filtro ${chave}: ${fim ? "em dia" : "continua na próxima execução"}`);
  }
  return { questoes: total, creditos: maxCreditos - orcamento, arquivos: [...arquivos] };
}
