// Importa questões a partir de arquivos JSON ou CSV.
// Uso: npm run import -- caminho/arquivo.json [outro.csv ...] [--disciplina "Nome padrão"]
import fs from "node:fs";
import path from "node:path";
import { csvParaQuestoes, importarLote, lerCsv } from "../src/lib/importacao";

const args = process.argv.slice(2);
const iDisc = args.indexOf("--disciplina");
const disciplina = iDisc >= 0 ? args[iDisc + 1] : undefined;
const arquivos = args.filter((a, i) => !a.startsWith("--") && i !== iDisc + 1);

if (!arquivos.length) {
  console.log('Uso: npm run import -- arquivo.json [arquivo.csv ...] [--disciplina "Nome"]');
  process.exit(1);
}

let total = 0;
for (const arquivo of arquivos) {
  const conteudo = fs.readFileSync(arquivo, "utf8");
  const dados = path.extname(arquivo).toLowerCase() === ".csv" ? csvParaQuestoes(lerCsv(conteudo)) : JSON.parse(conteudo);
  const r = importarLote(dados, { disciplina });
  total += r.inseridas;
  console.log(`${arquivo}: ${r.inseridas} inseridas, ${r.duplicadas} duplicadas, ${r.erros.length} erros`);
  for (const e of r.erros.slice(0, 50)) console.error(`  questão ${e.indice + 1}: ${e.mensagem}`);
}
console.log(`Total importado: ${total}`);
