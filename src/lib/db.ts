import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { MIGRACOES } from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __concursoDb: Database.Database | undefined;
}

function abrir(): Database.Database {
  const arquivo = path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.DATABASE_PATH || "data/concurso.db");
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  const conexao = new Database(arquivo);
  conexao.pragma("journal_mode = WAL");
  conexao.pragma("foreign_keys = ON");
  conexao.pragma("busy_timeout = 5000");
  migrar(conexao);
  return conexao;
}

function migrar(conexao: Database.Database) {
  const versao = conexao.pragma("user_version", { simple: true }) as number;
  for (let i = versao; i < MIGRACOES.length; i++) {
    conexao.transaction(() => {
      const m = MIGRACOES[i];
      if (typeof m === "string") conexao.exec(m);
      else m(conexao);
      conexao.pragma(`user_version = ${i + 1}`);
    })();
  }
}

/** Conexão única (reaproveitada entre recarregamentos em desenvolvimento). */
export function db(): Database.Database {
  if (!globalThis.__concursoDb) globalThis.__concursoDb = abrir();
  return globalThis.__concursoDb;
}

export { FUSO_HORAS, hoje } from "./tempo";
import { FUSO_HORAS } from "./tempo";

/** Expressão SQL que converte um datetime UTC na data local (YYYY-MM-DD). */
export function diaLocal(coluna: string) {
  return `date(${coluna}, '${FUSO_HORAS} hours')`;
}
