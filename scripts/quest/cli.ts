// Baixa questões da Quest API para data/provas/*.json (+ imagens em data/imagens/quest/).
// Depois, importe com: npm run db:seed
//
//   npm run quest -- quota                                   créditos restantes (grátis)
//   npm run quest -- provas --banca FCC --ano 2025 [--orgao TRT] [--cargo analista] [--pagina 1] [--por-pagina 20]
//                                                            lista provas (1 crédito por prova listada)
//   npm run quest -- baixar <id-da-prova> [...]              baixa provas inteiras (6 créditos por questão)
//   npm run quest -- novas [--banca X] [--ano 2026] [--max-creditos 1200]
//                                                            continua de onde parou e traz o que entrou de novo
//   npm run quest -- reconverter                             refaz os lotes a partir do cache local (grátis)
import fs from "node:fs";
import { baixarNovas, baixarProva, listarProvas, obterQuota, reconverter, type FiltrosBusca } from "./quest";

if (fs.existsSync(".env.local")) process.loadEnvFile(".env.local");
if (fs.existsSync(".env")) process.loadEnvFile(".env");

const [comando, ...resto] = process.argv.slice(2);
const opcoes: Record<string, string> = {};
const posicionais: string[] = [];
for (let i = 0; i < resto.length; i++) {
  if (resto[i].startsWith("--")) opcoes[resto[i].slice(2)] = resto[++i] ?? "";
  else posicionais.push(resto[i]);
}

const FILTROS = ["banca", "ano", "orgao", "cargo", "uf", "esfera", "materia", "nivel_escolaridade"] as const;
const filtros = Object.fromEntries(FILTROS.filter((k) => opcoes[k]).map((k) => [k, opcoes[k]])) as FiltrosBusca;

async function main() {
  switch (comando) {
    case "quota": {
      const q = await obterQuota();
      console.log(`Plano ${q.planCode}: ${q.remaining} créditos restantes de ${q.quotaPerCycle ?? "∞"} (renova em ${q.periodEnd?.slice(0, 10)})`);
      break;
    }
    case "provas": {
      const r = await listarProvas(filtros, Number(opcoes.pagina ?? 1), Number(opcoes["por-pagina"] ?? 20));
      console.log(`${r.total} provas (página ${r.page})`);
      for (const p of r.items) console.log(`${p.id.padEnd(10)} ${p.banca} ${p.ano} | ${p.orgao} | ${p.cargo} | ${p.total_questoes ?? "?"} questões`);
      break;
    }
    case "baixar": {
      if (!posicionais.length) throw new Error("Informe o id de uma ou mais provas (veja: npm run quest -- provas ...)");
      for (const id of posicionais) {
        const r = await baixarProva(id);
        console.log(`${r.prova.banca} ${r.prova.ano} – ${r.prova.orgao} – ${r.prova.cargo}: ${r.questoes} questões (${r.comGabarito} com gabarito) → ${r.arquivos.join(", ")}`);
      }
      break;
    }
    case "novas": {
      const lista = Object.keys(filtros).length ? [filtros] : [{ ano: String(new Date().getFullYear()) }];
      const q = await obterQuota();
      const max = Math.min(Number(opcoes["max-creditos"] ?? 1200), q.unlimited ? Infinity : q.remaining);
      const r = await baixarNovas(lista, max);
      console.log(`${r.questoes} questões baixadas (${r.creditos} créditos) em ${r.arquivos.length} arquivo(s)`);
      for (const a of r.arquivos) console.log(`  ${a}`);
      break;
    }
    case "reconverter": {
      const arquivos = await reconverter();
      console.log(`${arquivos.length} arquivo(s) refeitos a partir de .cache/quest`);
      break;
    }
    default:
      console.log("Comandos: quota | provas | baixar <id...> | novas | reconverter  (veja o início de scripts/quest/cli.ts)");
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
