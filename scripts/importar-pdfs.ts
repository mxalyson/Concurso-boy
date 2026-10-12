// Importa várias provas em PDF de uma vez.
//
// Estrutura esperada (uma pasta por prova):
//   provas/
//     cebraspe-pf-2021-agente/
//       prova.pdf
//       gabarito.pdf        (ou gabarito.txt com "1 C 2 E ...")
//       info.json
//
// info.json:
//   {
//     "banca": "CEBRASPE", "orgao": "PF", "orgao_nome": "Polícia Federal",
//     "cargo": "Agente de Polícia", "ano": 2021, "escolaridade": "superior",
//     "disciplinas": { "1-20": "Língua Portuguesa", "21-40": "Direito Constitucional" }
//   }
// Em vez de "disciplinas", pode-se usar "disciplina": "Nome" para a prova toda.
//
// Uso: npm run importar-pdfs -- [pasta] [--ia] [--comentarios] [--simular]
//   --ia           usa a IA (ANTHROPIC_API_KEY) em vez do leitor automático
//   --comentarios  com --ia, também gera comentários
//   --simular      só mostra o que seria importado, sem gravar

import fs from "node:fs";
import path from "node:path";
import { extrairQuestoesComIA, iaDisponivel } from "../src/lib/ia";
import { importarLote, type QuestaoImportacao } from "../src/lib/importacao";
import { aplicarGabarito, extrairGabarito, extrairQuestoesDoTexto } from "../src/lib/pdf-parser";
import { textoDoPdf } from "../src/lib/pdf-texto";
import { listarDisciplinas } from "../src/lib/taxonomia";

type Info = {
  banca?: string;
  orgao?: string;
  orgao_nome?: string;
  cargo?: string;
  ano?: number | string;
  escolaridade?: string;
  disciplina?: string;
  disciplinas?: Record<string, string>;
  url_prova?: string;
  url_gabarito?: string;
};

const args = process.argv.slice(2);
const usarIa = args.includes("--ia");
const comentarios = args.includes("--comentarios");
const simular = args.includes("--simular");
const raiz = args.find((a) => !a.startsWith("--")) ?? "provas";

function disciplinaDoNumero(info: Info, numero: number | null | undefined): string | undefined {
  if (info.disciplinas && numero) {
    for (const [faixa, nome] of Object.entries(info.disciplinas)) {
      const [ini, fim] = faixa.split("-").map((n) => Number(n.trim()));
      if (numero >= ini && numero <= (fim || ini)) return nome;
    }
  }
  return info.disciplina;
}

async function processar(pasta: string) {
  const arquivo = (nome: string) => path.join(pasta, nome);
  if (!fs.existsSync(arquivo("prova.pdf"))) return console.log(`- ${pasta}: sem prova.pdf, ignorada`);
  const info: Info = fs.existsSync(arquivo("info.json")) ? JSON.parse(fs.readFileSync(arquivo("info.json"), "utf8")) : {};
  const gabaritoTexto = [
    fs.existsSync(arquivo("gabarito.pdf")) ? await textoDoPdf(fs.readFileSync(arquivo("gabarito.pdf"))) : "",
    fs.existsSync(arquivo("gabarito.txt")) ? fs.readFileSync(arquivo("gabarito.txt"), "utf8") : "",
  ].join("\n");

  let questoes: QuestaoImportacao[];
  if (usarIa) {
    const r = await extrairQuestoesComIA({
      prova: fs.readFileSync(arquivo("prova.pdf")),
      gabarito: fs.existsSync(arquivo("gabarito.pdf")) ? fs.readFileSync(arquivo("gabarito.pdf")) : null,
      gabaritoTexto: fs.existsSync(arquivo("gabarito.txt")) ? fs.readFileSync(arquivo("gabarito.txt"), "utf8") : null,
      disciplinasExistentes: listarDisciplinas().map((d) => d.nome),
      gerarComentarios: comentarios,
    });
    info.banca ??= r.prova.banca ?? undefined;
    info.orgao ??= r.prova.orgao ?? undefined;
    info.cargo ??= r.prova.cargo ?? undefined;
    info.ano ??= r.prova.ano ?? undefined;
    info.escolaridade ??= r.prova.escolaridade ?? undefined;
    questoes = r.questoes.map((q) => ({ ...q, disciplina: disciplinaDoNumero(info, Number(q.numero)) ?? q.disciplina }));
  } else {
    const texto = await textoDoPdf(fs.readFileSync(arquivo("prova.pdf")));
    if (texto.replace(/\s/g, "").length < 200) return console.log(`- ${pasta}: PDF sem texto (escaneado). Use --ia.`);
    const extraidas = aplicarGabarito(extrairQuestoesDoTexto(texto).questoes, extrairGabarito(gabaritoTexto));
    questoes = extraidas.map((q) => ({ ...q, disciplina: disciplinaDoNumero(info, q.numero) }));
  }

  const semGabarito = questoes.filter((q) => !q.gabarito).length;
  const semDisciplina = questoes.filter((q) => !q.disciplina).length;
  const nome = path.basename(pasta);
  if (simular) {
    console.log(`- ${nome}: ${questoes.length} questões reconhecidas (${semGabarito} sem gabarito, ${semDisciplina} sem disciplina)`);
    return;
  }
  const { disciplina: _d, disciplinas: _ds, ...prova } = info;
  const r = importarLote({ prova, questoes });
  console.log(
    `- ${nome}: ${questoes.length} reconhecidas → ${r.inseridas} importadas, ${r.duplicadas} já existiam, ${r.erros.length} com erro` +
      (semGabarito ? ` (${semGabarito} sem gabarito)` : ""),
  );
  for (const e of r.erros.slice(0, 10)) console.log(`    questão ${questoes[e.indice]?.numero ?? e.indice + 1}: ${e.mensagem}`);
}

async function main() {
  if (usarIa && !iaDisponivel()) throw new Error("Defina ANTHROPIC_API_KEY para usar --ia.");
  if (!fs.existsSync(raiz)) throw new Error(`Pasta "${raiz}" não encontrada.`);
  const pastas = fs
    .readdirSync(raiz, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("_"))
    .map((e) => path.join(raiz, e.name))
    .sort();
  if (!pastas.length) throw new Error(`Nenhuma subpasta de prova em "${raiz}".`);
  console.log(`${pastas.length} provas encontradas em ${raiz}${simular ? " (simulação)" : ""}`);
  for (const p of pastas) {
    try {
      await processar(p);
    } catch (e) {
      console.log(`- ${path.basename(p)}: falhou — ${e instanceof Error ? e.message : e}`);
    }
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
