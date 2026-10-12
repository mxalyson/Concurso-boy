// Recursos opcionais com IA (Claude): extração de questões de PDFs e geração
// de comentários. Só ficam ativos quando ANTHROPIC_API_KEY está configurada.

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { QuestaoImportacao } from "./importacao";

const MODELO = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

export function iaDisponivel() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

function cliente() {
  if (!iaDisponivel()) throw new Error("Configure ANTHROPIC_API_KEY para usar os recursos de IA.");
  return new Anthropic();
}

const QuestaoIA = z.object({
  numero: z.number().int().nullable(),
  disciplina: z.string().describe("Disciplina, ex.: Língua Portuguesa, Direito Constitucional"),
  assunto: z
    .string()
    .nullable()
    .describe("Assunto específico; use 'Tópico > Subtópico' quando fizer sentido, ex.: 'Atos administrativos > Atributos'"),
  tipo: z.enum(["multipla", "certo_errado"]),
  texto_base: z.string().nullable().describe("Texto de apoio compartilhado com outras questões, se houver"),
  enunciado: z.string(),
  alternativas: z.array(z.object({ letra: z.string(), texto: z.string() })),
  gabarito: z
    .string()
    .nullable()
    .describe("Letra correta (A-E), 'C' ou 'E' para certo/errado, 'X' se anulada, null se desconhecido"),
  comentario: z.string().nullable(),
});

const RespostaExtracao = z.object({
  prova: z.object({
    banca: z.string().nullable(),
    orgao: z.string().nullable(),
    cargo: z.string().nullable(),
    ano: z.number().int().nullable(),
    escolaridade: z.enum(["fundamental", "medio", "superior"]).nullable(),
  }),
  questoes: z.array(QuestaoIA),
});

export type ResultadoExtracaoIA = {
  prova: z.infer<typeof RespostaExtracao>["prova"];
  questoes: QuestaoImportacao[];
};

const INSTRUCOES_EXTRACAO = `Você transcreve provas de concursos públicos brasileiros para um banco de questões.

Regras:
- Transcreva TODAS as questões do PDF da prova, na ordem, sem resumir nem corrigir o texto original.
- Questões de "julgue os itens" (Cebraspe e similares) são do tipo "certo_errado", uma por item, sem alternativas.
- Quando várias questões dependem do mesmo texto, repita esse texto em "texto_base" de cada uma.
- Classifique cada questão em uma disciplina e em um assunto. Prefira os nomes da lista de disciplinas existentes quando couber.
- Se um gabarito for fornecido, use-o. Caso contrário, deixe "gabarito" como null: nunca invente gabaritos.
- Questões com imagens, gráficos ou tabelas: descreva o conteúdo essencial entre colchetes no enunciado.
- "comentario": quando solicitado, explique em 2 a 5 frases por que o gabarito está correto (cite a base legal ou teórica); caso contrário, null.
- Preencha os dados da prova (banca, órgão, cargo, ano, escolaridade) a partir da capa, se disponíveis.`;

export async function extrairQuestoesComIA(opcoes: {
  prova: Buffer;
  gabarito?: Buffer | null;
  gabaritoTexto?: string | null;
  disciplinasExistentes: string[];
  gerarComentarios: boolean;
}): Promise<ResultadoExtracaoIA> {
  const conteudo: Anthropic.Beta.BetaContentBlockParam[] = [
    {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: opcoes.prova.toString("base64") },
      title: "Prova",
    },
  ];
  if (opcoes.gabarito) {
    conteudo.push({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: opcoes.gabarito.toString("base64") },
      title: "Gabarito",
    });
  }
  conteudo.push({
    type: "text",
    text: [
      `Disciplinas já cadastradas: ${opcoes.disciplinasExistentes.join("; ") || "(nenhuma)"}.`,
      opcoes.gabaritoTexto ? `Gabarito informado pelo usuário:\n${opcoes.gabaritoTexto}` : "",
      opcoes.gerarComentarios ? "Escreva um comentário curto para cada questão que tiver gabarito." : "Não escreva comentários.",
      "Transcreva as questões da prova.",
    ]
      .filter(Boolean)
      .join("\n\n"),
  });

  const stream = cliente().beta.messages.stream({
    model: MODELO,
    max_tokens: 128000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: zodOutputFormat(RespostaExtracao) },
    system: INSTRUCOES_EXTRACAO,
    messages: [{ role: "user", content: conteudo }],
  });
  const mensagem = await stream.finalMessage();

  if (mensagem.stop_reason === "refusal") throw new Error("A IA recusou processar este documento.");
  if (mensagem.stop_reason === "max_tokens")
    throw new Error("A prova é longa demais para uma única extração. Divida o PDF em partes menores.");
  const texto = mensagem.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const dados = RespostaExtracao.parse(JSON.parse(texto));

  return {
    prova: dados.prova,
    questoes: dados.questoes.map((q) => ({
      numero: q.numero,
      disciplina: q.disciplina,
      assunto: q.assunto,
      tipo: q.tipo,
      texto_base: q.texto_base,
      enunciado: q.enunciado,
      alternativas: q.tipo === "multipla" ? q.alternativas : [],
      gabarito: q.gabarito,
      comentario: q.comentario,
    })),
  };
}

export async function gerarComentarioIA(q: {
  enunciado: string;
  texto_base: string | null;
  alternativas: { letra: string; texto: string }[];
  tipo: "multipla" | "certo_errado";
  gabarito: string;
  disciplina: string;
  assunto: string | null;
}): Promise<string> {
  const alternativas =
    q.tipo === "multipla"
      ? q.alternativas.map((a) => `(${a.letra}) ${a.texto}`).join("\n")
      : "Julgue o item como CERTO ou ERRADO.";
  const resposta = await cliente().beta.messages.create({
    model: MODELO,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium" },
    system:
      "Você é professor de cursinho preparatório para concursos públicos. Escreva comentários didáticos em português, em Markdown, sem títulos de nível 1.",
    messages: [
      {
        role: "user",
        content: `Disciplina: ${q.disciplina}${q.assunto ? ` — ${q.assunto}` : ""}

${q.texto_base ? `Texto base:\n${q.texto_base}\n\n` : ""}Questão:
${q.enunciado}

${alternativas}

Gabarito oficial: ${q.gabarito}

Explique por que o gabarito está correto e, se for múltipla escolha, por que cada alternativa incorreta está errada. Cite a base legal, a regra gramatical ou o conceito teórico. Seja objetivo (até 250 palavras).`,
      },
    ],
  });
  if (resposta.stop_reason === "refusal") throw new Error("A IA não conseguiu comentar esta questão.");
  return resposta.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
}
