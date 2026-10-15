import { db } from "./db";
import { dataSqlite } from "./utils";

export type Simulado = {
  id: number;
  usuario_id: number;
  titulo: string;
  duracao_min: number;
  filtros: string;
  iniciado_em: string;
  finalizado_em: string | null;
  acertos: number | null;
  total: number;
};

export function obterSimulado(id: number, usuarioId: number): Simulado | null {
  return (db().prepare("SELECT * FROM simulados WHERE id = ? AND usuario_id = ?").get(id, usuarioId) as Simulado | undefined) ?? null;
}

export function itensSimulado(id: number) {
  return db()
    .prepare("SELECT ordem, questao_id, resposta FROM simulado_questoes WHERE simulado_id = ? ORDER BY ordem")
    .all(id) as { ordem: number; questao_id: number; resposta: string | null }[];
}

export function prazoSimulado(s: Simulado): number {
  return dataSqlite(s.iniciado_em).getTime() + s.duracao_min * 60_000;
}

/** Corrige o simulado, grava as respostas no histórico e retorna o placar. */
export function corrigirSimulado(s: Simulado) {
  if (s.finalizado_em) return;
  const itens = db()
    .prepare(
      `SELECT sq.questao_id, sq.resposta, q.gabarito FROM simulado_questoes sq
       JOIN questoes q ON q.id = sq.questao_id WHERE sq.simulado_id = ?`,
    )
    .all(s.id) as { questao_id: number; resposta: string | null; gabarito: string | null }[];
  const inserir = db().prepare(
    "INSERT INTO respostas (usuario_id, questao_id, resposta, correta, origem, criado_em) VALUES (?, ?, ?, ?, 'simulado', datetime('now'))",
  );
  let acertos = 0;
  db().transaction(() => {
    for (const i of itens) {
      if (!i.resposta || !i.gabarito) continue;
      const correta = i.resposta === i.gabarito;
      if (correta) acertos++;
      inserir.run(s.usuario_id, i.questao_id, i.resposta, correta ? 1 : 0);
    }
    db().prepare("UPDATE simulados SET finalizado_em = datetime('now'), acertos = ? WHERE id = ?").run(acertos, s.id);
  })();
}
