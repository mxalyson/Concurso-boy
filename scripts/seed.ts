// Carrega o conteúdo de exemplo: questões autorais comentadas e resumos teóricos.
// Uso: npm run db:seed   (pode ser executado várias vezes; não duplica conteúdo)
import fs from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { db } from "../src/lib/db";
import { importarLote } from "../src/lib/importacao";
import { obterOuCriarAssunto, obterOuCriarDisciplina } from "../src/lib/taxonomia";
import { MATERIAIS } from "./dados/materiais";
import { QUESTOES_1 } from "./dados/questoes-1";
import { QUESTOES_2 } from "./dados/questoes-2";
import { QUESTOES_3 } from "./dados/questoes-3";

const questoes = [...QUESTOES_1, ...QUESTOES_2, ...QUESTOES_3];

for (const nivel of ["medio", "superior"] as const) {
  const lote = {
    prova: {
      banca: "AUTORAL",
      banca_nome: "Questões autorais de exemplo",
      cargo: nivel === "medio" ? "Exemplos — nível médio" : "Exemplos — nível superior",
      escolaridade: nivel,
      ano: 2026,
    },
    questoes: questoes
      .filter((q) => q.nivel === nivel)
      .map((q) => ({
        disciplina: q.d,
        assunto: q.a,
        tipo: q.t === "ce" ? "certo_errado" : "multipla",
        texto_base: q.base,
        enunciado: q.e,
        alternativas: q.alt ?? [],
        gabarito: q.g,
        comentario: q.c,
        dificuldade: q.dif,
        fonte: "Questão autoral de exemplo — não pertence a prova oficial",
      })),
  };
  const r = importarLote(lote);
  console.log(`Questões (${nivel}): ${r.inseridas} inseridas, ${r.duplicadas} já existiam, ${r.erros.length} erros`);
  for (const e of r.erros) console.error(`  #${e.indice}: ${e.mensagem}`);
}

// Provas reais (Cebraspe, FGV...), em data/provas/*.json — os lotes automáticos são .json.gz
const pastaProvas = path.resolve("data/provas");
if (fs.existsSync(pastaProvas)) {
  for (const arquivo of fs.readdirSync(pastaProvas).filter((a) => /\.json(\.gz)?$/.test(a)).sort()) {
    const bruto = fs.readFileSync(path.join(pastaProvas, arquivo));
    const r = importarLote(JSON.parse((arquivo.endsWith(".gz") ? gunzipSync(bruto) : bruto).toString("utf8")));
    console.log(`${arquivo}: ${r.inseridas} inseridas, ${r.duplicadas} já existiam, ${r.erros.length} erros`);
    for (const e of r.erros.slice(0, 10)) console.error(`  #${e.indice}: ${e.mensagem}`);
  }
}

let novos = 0;
for (const m of MATERIAIS) {
  const disciplinaId = obterOuCriarDisciplina(m.d);
  const assuntoId = m.a ? obterOuCriarAssunto(disciplinaId, m.a) : null;
  const existe = db().prepare("SELECT 1 FROM materiais WHERE titulo = ? AND disciplina_id = ?").get(m.titulo, disciplinaId);
  if (existe) continue;
  db()
    .prepare("INSERT INTO materiais (disciplina_id, assunto_id, titulo, conteudo, publico) VALUES (?, ?, ?, ?, 1)")
    .run(disciplinaId, assuntoId, m.titulo, m.conteudo);
  novos++;
}
console.log(`Resumos: ${novos} inseridos`);
