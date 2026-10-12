import { z } from "zod";
import { db } from "./db";
import { hashQuestao, type Alternativa } from "./questoes";
import {
  obterOuCriarAssunto,
  obterOuCriarBanca,
  obterOuCriarDisciplina,
  obterOuCriarOrgao,
  obterOuCriarProva,
} from "./taxonomia";

// Formato aceito na importação (JSON, CSV convertido, PDF processado ou IA).
// Campos da prova podem vir em "prova" (valem para todas) ou em cada questão.

const texto = z.string().trim();
const opcional = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((v) => (v === null || v === undefined || String(v).trim() === "" ? undefined : String(v).trim()));

const CamposProva = z.object({
  banca: opcional,
  banca_nome: opcional,
  orgao: opcional,
  orgao_nome: opcional,
  esfera: opcional,
  uf: opcional,
  cargo: opcional,
  ano: opcional,
  escolaridade: opcional,
  url_prova: opcional,
  url_gabarito: opcional,
});

export const QuestaoImportacao = CamposProva.extend({
  numero: opcional,
  disciplina: opcional,
  assunto: opcional,
  tipo: opcional,
  texto_base: opcional,
  enunciado: texto.min(3, "Enunciado vazio"),
  alternativas: z
    .array(z.union([z.string(), z.object({ letra: z.string().optional(), texto: z.string() })]))
    .optional()
    .default([]),
  gabarito: opcional,
  comentario: opcional,
  dificuldade: opcional,
  anulada: z.union([z.boolean(), z.number(), z.string()]).optional(),
  desatualizada: z.union([z.boolean(), z.number(), z.string()]).optional(),
  fonte: opcional,
});

export type QuestaoImportacao = z.input<typeof QuestaoImportacao>;
export type CamposProva = z.input<typeof CamposProva>;

export const LoteImportacao = z.union([
  z.array(z.unknown()),
  z.object({ prova: z.unknown().optional(), questoes: z.array(z.unknown()) }),
]);

export type ResultadoImportacao = {
  inseridas: number;
  duplicadas: number;
  erros: { indice: number; mensagem: string }[];
  ids: number[];
};

const LETRAS = "ABCDEFGHIJ";

function verdadeiro(v: unknown) {
  return v === true || v === 1 || (typeof v === "string" && ["1", "true", "sim", "s", "x"].includes(v.toLowerCase()));
}

export function normalizarGabarito(
  valor: string | undefined,
  tipo: "multipla" | "certo_errado",
): { gabarito: string | null; anulada: boolean } {
  if (!valor) return { gabarito: null, anulada: false };
  const v = valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toUpperCase();
  if (["X", "*", "ANULADA", "ANULADO", "NULA"].includes(v)) return { gabarito: null, anulada: true };
  if (tipo === "certo_errado") {
    if (["C", "CERTO", "CERTA", "V", "VERDADEIRO"].includes(v)) return { gabarito: "C", anulada: false };
    if (["E", "ERRADO", "ERRADA", "F", "FALSO"].includes(v)) return { gabarito: "E", anulada: false };
    return { gabarito: null, anulada: false };
  }
  const letra = v.replace(/[^A-J]/g, "").charAt(0);
  return { gabarito: letra || null, anulada: false };
}

function normalizarEscolaridade(v?: string) {
  if (!v) return null;
  const s = v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (s.startsWith("fund")) return "fundamental";
  if (s.startsWith("med")) return "medio";
  if (s.startsWith("sup")) return "superior";
  return null;
}

function normalizarAlternativas(lista: (string | { letra?: string; texto: string })[]): Alternativa[] {
  return lista
    .map((item, i) => {
      if (typeof item === "string") {
        const m = /^\s*\(?([A-Ja-j])[).\-–:]\s+([\s\S]*)$/.exec(item);
        return m ? { letra: m[1].toUpperCase(), texto: m[2].trim() } : { letra: LETRAS[i], texto: item.trim() };
      }
      return { letra: (item.letra || LETRAS[i]).trim().toUpperCase().charAt(0), texto: item.texto.trim() };
    })
    .filter((a) => a.texto.length > 0);
}

export type LinhaQuestao = {
  prova_id: number | null;
  disciplina_id: number;
  assunto_id: number | null;
  numero: number | null;
  tipo: "multipla" | "certo_errado";
  texto_base: string | null;
  enunciado: string;
  alternativas: string;
  gabarito: string | null;
  comentario: string | null;
  dificuldade: number | null;
  anulada: number;
  desatualizada: number;
  fonte: string | null;
  hash: string;
};

/**
 * Valida uma questão e resolve (criando se preciso) disciplina, assunto, banca,
 * órgão e prova. Retorna a linha pronta para gravar na tabela questoes.
 */
export function prepararQuestao(bruto: unknown, padrao: CamposProva & { disciplina?: string } = {}): { linha: LinhaQuestao } | { erro: string } {
  const analise = QuestaoImportacao.safeParse(bruto);
  if (!analise.success) return { erro: analise.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  const base = CamposProva.extend({ disciplina: opcional }).parse(padrao);
  const q = {
    ...base,
    ...Object.fromEntries(Object.entries(analise.data).filter(([, v]) => v !== undefined)),
  } as z.output<typeof QuestaoImportacao>;
  if (!q.disciplina) return { erro: "Disciplina não informada" };
  const alternativas = normalizarAlternativas(q.alternativas ?? []);
  const tipo: "multipla" | "certo_errado" =
    q.tipo === "multipla" || q.tipo === "certo_errado" ? q.tipo : alternativas.length >= 2 ? "multipla" : "certo_errado";
  if (tipo === "multipla" && alternativas.length < 2) return { erro: "Questão de múltipla escolha sem alternativas" };
  const gab = normalizarGabarito(q.gabarito, tipo);
  if (tipo === "multipla" && gab.gabarito && !alternativas.some((a) => a.letra === gab.gabarito))
    return { erro: `Gabarito ${gab.gabarito} não corresponde a nenhuma alternativa` };

  const disciplinaId = obterOuCriarDisciplina(q.disciplina);
  const assuntoId = q.assunto ? obterOuCriarAssunto(disciplinaId, q.assunto) : null;
  let provaId: number | null = null;
  if (q.banca || q.orgao || q.ano || q.cargo) {
    const ano = q.ano ? Number.parseInt(q.ano, 10) : null;
    provaId = obterOuCriarProva({
      bancaId: q.banca ? obterOuCriarBanca(q.banca, q.banca_nome) : null,
      orgaoId: q.orgao
        ? obterOuCriarOrgao(q.orgao, {
            nome: q.orgao_nome,
            esfera: ["federal", "estadual", "municipal"].includes(q.esfera ?? "") ? q.esfera : null,
            uf: q.uf ?? null,
          })
        : null,
      cargo: q.cargo ?? null,
      ano: ano !== null && Number.isFinite(ano) ? ano : null,
      escolaridade: normalizarEscolaridade(q.escolaridade),
      urlProva: q.url_prova ?? null,
      urlGabarito: q.url_gabarito ?? null,
    });
  }
  const dificuldade = q.dificuldade ? Number.parseInt(q.dificuldade, 10) : NaN;
  const numero = q.numero ? Number.parseInt(q.numero, 10) : NaN;
  const alternativasFinais = tipo === "multipla" ? alternativas : [];
  return {
    linha: {
      prova_id: provaId,
      disciplina_id: disciplinaId,
      assunto_id: assuntoId,
      numero: Number.isFinite(numero) ? numero : null,
      tipo,
      texto_base: q.texto_base ?? null,
      enunciado: q.enunciado,
      alternativas: JSON.stringify(alternativasFinais),
      gabarito: gab.gabarito,
      comentario: q.comentario ?? null,
      dificuldade: dificuldade >= 1 && dificuldade <= 3 ? dificuldade : null,
      anulada: gab.anulada || verdadeiro(q.anulada) ? 1 : 0,
      desatualizada: verdadeiro(q.desatualizada) ? 1 : 0,
      fonte: q.fonte ?? null,
      hash: hashQuestao(q.enunciado, alternativasFinais, q.texto_base),
    },
  };
}

/**
 * Importa um lote de questões. Cria automaticamente bancas, órgãos, provas,
 * disciplinas e assuntos que ainda não existem. Questões repetidas são ignoradas.
 */
export function importarLote(entrada: unknown, padrao: { disciplina?: string } = {}): ResultadoImportacao {
  const lote = LoteImportacao.parse(entrada);
  const itens = Array.isArray(lote) ? lote : lote.questoes;
  const provaComum = Array.isArray(lote) ? {} : CamposProva.parse(lote.prova ?? {});
  const resultado: ResultadoImportacao = { inseridas: 0, duplicadas: 0, erros: [], ids: [] };

  const inserir = db().prepare(
    `INSERT INTO questoes (prova_id, disciplina_id, assunto_id, numero, tipo, texto_base, enunciado,
       alternativas, gabarito, comentario, dificuldade, anulada, desatualizada, fonte, hash)
     VALUES (@prova_id, @disciplina_id, @assunto_id, @numero, @tipo, @texto_base, @enunciado,
       @alternativas, @gabarito, @comentario, @dificuldade, @anulada, @desatualizada, @fonte, @hash)
     ON CONFLICT(hash) DO NOTHING`,
  );

  db().transaction(() => {
    itens.forEach((bruto, indice) => {
      const r = prepararQuestao(bruto, { ...provaComum, disciplina: padrao.disciplina });
      if ("erro" in r) {
        resultado.erros.push({ indice, mensagem: r.erro });
        return;
      }
      const info = inserir.run(r.linha);
      if (info.changes === 0) resultado.duplicadas++;
      else {
        resultado.inseridas++;
        resultado.ids.push(Number(info.lastInsertRowid));
      }
    });
  })();

  return resultado;
}

// --- CSV --------------------------------------------------------------------

/** Parser de CSV com suporte a aspas, quebras de linha e separador ";" ou ",". */
export function lerCsv(conteudo: string): Record<string, string>[] {
  const textoLimpo = conteudo.replace(/^﻿/, "");
  const primeiraLinha = textoLimpo.split(/\r?\n/, 1)[0] ?? "";
  const separador = (primeiraLinha.match(/;/g)?.length ?? 0) > (primeiraLinha.match(/,/g)?.length ?? 0) ? ";" : ",";
  const linhas: string[][] = [];
  let campo = "";
  let linha: string[] = [];
  let aspas = false;
  for (let i = 0; i < textoLimpo.length; i++) {
    const c = textoLimpo[i];
    if (aspas) {
      if (c === '"' && textoLimpo[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === separador) {
      linha.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && textoLimpo[i + 1] === "\n") i++;
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = "";
    } else campo += c;
  }
  if (campo || linha.length) {
    linha.push(campo);
    linhas.push(linha);
  }
  const [cabecalho, ...dados] = linhas.filter((l) => l.some((c) => c.trim()));
  if (!cabecalho) return [];
  const chaves = cabecalho.map((c) => c.trim().toLowerCase());
  return dados.map((l) => Object.fromEntries(chaves.map((k, i) => [k, (l[i] ?? "").trim()])));
}

/** Converte linhas de CSV (colunas a, b, c, d, e para alternativas) no formato de importação. */
export function csvParaQuestoes(linhas: Record<string, string>[]): QuestaoImportacao[] {
  return linhas.map((l) => {
    const alternativas = ["a", "b", "c", "d", "e"]
      .filter((k) => l[k])
      .map((k) => ({ letra: k.toUpperCase(), texto: l[k] }));
    return {
      ...l,
      enunciado: l.enunciado ?? "",
      alternativas,
    };
  });
}
