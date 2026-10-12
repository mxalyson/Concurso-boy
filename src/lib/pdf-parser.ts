// Extração heurística de questões a partir do texto de provas em PDF.
// Funciona bem com o layout mais comum das bancas (itens numerados em sequência,
// alternativas A–E). O resultado sempre passa por uma tela de revisão.

import type { Alternativa } from "./questoes";

export type QuestaoExtraida = {
  numero: number;
  texto_base: string | null;
  enunciado: string;
  alternativas: Alternativa[];
  tipo: "multipla" | "certo_errado";
  gabarito: string | null;
};

const INICIO_TEXTO_BASE =
  /^(texto\b|texto para|leia\b|considere\b|julgue\b|com base\b|com relação\b|com referência\b|considerando\b|acerca d|a respeito d|no que (se refere|concerne)|em relação\b|tendo em vista|a partir d|nos itens|no item|observe\b|analise\b)/i;

const RE_QUESTAO = [
  /^QUEST[ÃA]O\s*(\d{1,3})\s*[.:)\-–]?\s*(.*)$/i,
  /^(\d{1,3})\s*[.)\-–]\s*(.*)$/,
  /^(\d{1,3})\s+(\S.*)$/,
  /^(\d{1,3})$/,
];

const RE_ALTERNATIVA = [/^\(([A-Ea-e])\)\s*(.*)$/, /^([A-Ea-e])\)\s*(.*)$/, /^([A-E])\s*[.\-–]\s+(.*)$/, /^([A-E])\s{2,}(.*)$/];

function limparLinhas(texto: string): string[] {
  const linhas = texto
    .replace(/\r/g, "")
    .replace(/[  -​]/g, " ")
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim());

  // Cabeçalhos e rodapés se repetem em todas as páginas: descartamos linhas
  // curtas que aparecem muitas vezes.
  const contagem = new Map<string, number>();
  for (const l of linhas) if (l) contagem.set(l, (contagem.get(l) ?? 0) + 1);
  return linhas.filter((l) => {
    if (!l) return true;
    if (/^(p[áa]gina\s*)?\d+\s*(\/|de)\s*\d+$/i.test(l)) return false;
    if (/www\.|https?:\/\//i.test(l) && l.length < 100) return false;
    const n = contagem.get(l) ?? 0;
    return !(n >= 3 && l.length < 120 && !/^\d{1,3}\b/.test(l) && !/^\(?[A-E]\)/.test(l));
  });
}

/** Junta linhas quebradas do PDF, preservando parágrafos. */
function juntar(linhas: string[]): string {
  const paragrafos: string[] = [];
  let atual = "";
  for (const l of linhas) {
    if (!l) {
      if (atual) paragrafos.push(atual);
      atual = "";
      continue;
    }
    if (!atual) atual = l;
    else if (/[-‐]$/.test(atual) && /^[a-zà-ú]/.test(l)) atual = atual.slice(0, -1) + l;
    else atual += " " + l;
  }
  if (atual) paragrafos.push(atual);
  return paragrafos.join("\n\n").trim();
}

function casarQuestao(linha: string): { numero: number; resto: string } | null {
  for (const re of RE_QUESTAO) {
    const m = re.exec(linha);
    if (m) return { numero: Number(m[1]), resto: (m[2] ?? "").trim() };
  }
  return null;
}

function casarAlternativa(linha: string): { letra: string; texto: string } | null {
  for (const re of RE_ALTERNATIVA) {
    const m = re.exec(linha);
    if (m) return { letra: m[1].toUpperCase(), texto: (m[2] ?? "").trim() };
  }
  return null;
}

type Bloco = { numero: number; linhas: string[] };
type TextoBase = { texto: string; ate: number | null; usos: number };

/** Lê intervalos como "questões de 1 a 5" ou "itens 21 e 22" no texto introdutório. */
function intervalo(texto: string): number | null {
  const m = /(?:quest[õo]es|itens)\s*(?:de\s*)?(?:n[úu]meros?\s*)?(\d{1,3})\s*(?:a|e|até|-|–)\s*(\d{1,3})/i.exec(texto);
  return m ? Number(m[2]) : null;
}

function novoTextoBase(texto: string): TextoBase | null {
  return texto ? { texto, ate: intervalo(texto), usos: 0 } : null;
}

export function extrairQuestoesDoTexto(texto: string): { questoes: QuestaoExtraida[]; preambulo: string } {
  const linhas = limparLinhas(texto);
  const blocos: Bloco[] = [];
  const preambulo: string[] = [];
  let esperado: number | null = null;

  for (const linha of linhas) {
    const q = linha ? casarQuestao(linha) : null;
    const ehInicio =
      q !== null &&
      (esperado === null ? q.numero >= 1 && q.numero <= 200 && (q.resto.length > 0 || q.numero === 1) : q.numero === esperado);
    if (q && ehInicio) {
      blocos.push({ numero: q.numero, linhas: q.resto ? [q.resto] : [] });
      esperado = q.numero + 1;
    } else if (blocos.length) {
      blocos[blocos.length - 1].linhas.push(linha);
    } else {
      preambulo.push(linha);
    }
  }

  // Texto base anterior à primeira questão (ex.: "Texto para os itens de 1 a 10").
  let textoBase: TextoBase | null = null;
  const idxIntro = preambulo.findIndex((l) => INICIO_TEXTO_BASE.test(l));
  if (idxIntro >= 0) textoBase = novoTextoBase(juntar(preambulo.slice(idxIntro)));

  const questoes: QuestaoExtraida[] = [];
  for (const bloco of blocos) {
    // Separa alternativas (precisam aparecer em ordem: A, B, C...).
    const alternativas: Alternativa[] = [];
    let corpo: string[] = [];
    let depois: string[] = [];
    let i = 0;
    for (; i < bloco.linhas.length; i++) {
      const alt = bloco.linhas[i] ? casarAlternativa(bloco.linhas[i]) : null;
      if (alt && alt.letra === "A") break;
      corpo.push(bloco.linhas[i]);
    }
    let atual: Alternativa | null = null;
    const proximaLetra = () => (atual ? String.fromCharCode(atual.letra.charCodeAt(0) + 1) : "A");
    for (; i < bloco.linhas.length; i++) {
      const l = bloco.linhas[i];
      const alt = l ? casarAlternativa(l) : null;
      if (alt && alt.letra === proximaLetra()) {
        if (atual) alternativas.push(atual);
        atual = { letra: alt.letra, texto: alt.texto };
        continue;
      }
      if (!atual) continue;
      if (!l) {
        // Linha em branco depois da alternativa D ou E: se a próxima linha não for
        // a alternativa seguinte, o restante não pertence a esta questão.
        const seguinte = bloco.linhas.slice(i + 1).find((x) => x);
        const altSeguinte = seguinte ? casarAlternativa(seguinte) : null;
        if (atual.letra >= "D" && altSeguinte?.letra !== proximaLetra()) {
          depois = bloco.linhas.slice(i + 1);
          break;
        }
        continue;
      }
      atual.texto += " " + l;
    }
    if (atual) alternativas.push(atual);

    // Em provas de "certo ou errado", o texto introdutório do próximo grupo de
    // itens aparece grudado no fim do item anterior.
    let textoBaseSeguinte: string | null = null;
    const ehMultipla = alternativas.length >= 2;
    const fonteIntro = ehMultipla ? depois : corpo;
    const idx = fonteIntro.findIndex((l, j) => (ehMultipla || j > 0) && INICIO_TEXTO_BASE.test(l));
    if (idx >= 0) {
      textoBaseSeguinte = juntar(fonteIntro.slice(idx));
      if (!ehMultipla) corpo = corpo.slice(0, idx);
    }

    // O texto base vale até o fim do intervalo informado; sem intervalo, vale para
    // o grupo de itens de certo/errado ou apenas para a próxima questão de múltipla escolha.
    if (textoBase && textoBase.ate !== null && bloco.numero > textoBase.ate) textoBase = null;
    if (textoBase && textoBase.ate === null && ehMultipla && textoBase.usos >= 1) textoBase = null;
    const enunciado = juntar(corpo);
    if (enunciado.length >= 3) {
      if (textoBase) textoBase.usos++;
      questoes.push({
        numero: bloco.numero,
        texto_base: textoBase?.texto ?? null,
        enunciado,
        alternativas: ehMultipla
          ? alternativas.map((a) => ({ letra: a.letra, texto: a.texto.replace(/\s+/g, " ").trim() }))
          : [],
        tipo: ehMultipla ? "multipla" : "certo_errado",
        gabarito: null,
      });
    }
    if (textoBaseSeguinte) textoBase = novoTextoBase(textoBaseSeguinte);
  }

  return { questoes, preambulo: juntar(preambulo) };
}

/**
 * Lê gabaritos em formato de lista ("1-C 2-E", "01 A") ou de tabela
 * (uma linha com números e outra com as respostas).
 */
export function extrairGabarito(texto: string): Map<number, string> {
  const mapa = new Map<number, string>();
  const tokens = texto
    .replace(/[|;,]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const RESP = /^(?:[A-E]|X|\*|ANULAD[AO]|CERTO|ERRADO)$/i;
  const NUM = /^\d{1,3}$/;
  const PAR = /^(\d{1,3})[-–.:)]?([A-E]|X|\*)$/i;
  const registrar = (n: number, r: string) => {
    if (mapa.has(n)) return;
    const v = r.toUpperCase();
    mapa.set(n, v.startsWith("ANUL") || v === "*" ? "X" : v === "CERTO" ? "C" : v === "ERRADO" ? "E" : v);
  };

  let i = 0;
  while (i < tokens.length) {
    const par = PAR.exec(tokens[i]);
    if (par && !NUM.test(tokens[i])) {
      registrar(Number(par[1]), par[2]);
      i++;
      continue;
    }
    if (!NUM.test(tokens[i])) {
      i++;
      continue;
    }
    const numeros: number[] = [];
    while (i < tokens.length && NUM.test(tokens[i])) numeros.push(Number(tokens[i++]));
    // Permite rótulos entre a linha de números e a de respostas ("Gabarito").
    let pulos = 0;
    while (i < tokens.length && !RESP.test(tokens[i]) && !NUM.test(tokens[i]) && pulos < 2 && numeros.length > 2) {
      i++;
      pulos++;
    }
    const respostas: string[] = [];
    while (i < tokens.length && RESP.test(tokens[i]) && respostas.length < numeros.length) respostas.push(tokens[i++]);
    if (!respostas.length) continue;
    if (numeros.length === respostas.length) numeros.forEach((n, k) => registrar(n, respostas[k]));
    else registrar(numeros[numeros.length - 1], respostas[0]);
  }
  return mapa;
}

export function aplicarGabarito(questoes: QuestaoExtraida[], gabarito: Map<number, string>) {
  for (const q of questoes) {
    const r = gabarito.get(q.numero);
    if (r) q.gabarito = r;
  }
  return questoes;
}
