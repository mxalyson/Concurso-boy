import { db, diaLocal, hoje } from "./db";

export function resumoUsuario(usuarioId: number) {
  const d = db();
  const geral = d
    .prepare("SELECT count(*) AS total, ifnull(sum(correta), 0) AS acertos FROM respostas WHERE usuario_id = ?")
    .get(usuarioId) as { total: number; acertos: number };
  const deHoje = d
    .prepare(
      `SELECT count(*) AS total, ifnull(sum(correta), 0) AS acertos FROM respostas
       WHERE usuario_id = ? AND ${diaLocal("criado_em")} = ?`,
    )
    .get(usuarioId, hoje()) as { total: number; acertos: number };
  const questoesDistintas = (
    d.prepare("SELECT count(DISTINCT questao_id) AS n FROM respostas WHERE usuario_id = ?").get(usuarioId) as { n: number }
  ).n;
  const minutosHoje = (
    d
      .prepare(`SELECT ifnull(sum(minutos), 0) AS n FROM sessoes_estudo WHERE usuario_id = ? AND ${diaLocal("criado_em")} = ?`)
      .get(usuarioId, hoje()) as { n: number }
  ).n;
  const minutosSemana = (
    d
      .prepare(`SELECT ifnull(sum(minutos), 0) AS n FROM sessoes_estudo WHERE usuario_id = ? AND ${diaLocal("criado_em")} > ?`)
      .get(usuarioId, hoje(-7)) as { n: number }
  ).n;
  const flashcardsVencidos = (
    d
      .prepare(
        `SELECT count(*) AS n FROM flashcards f JOIN flashcard_decks k ON k.id = f.deck_id
         WHERE k.usuario_id = ? AND f.vence_em <= ?`,
      )
      .get(usuarioId, hoje()) as { n: number }
  ).n;
  const revisoes = (
    d
      .prepare("SELECT count(*) AS n FROM progresso_assuntos WHERE usuario_id = ? AND proxima_revisao <= ?")
      .get(usuarioId, hoje()) as { n: number }
  ).n;
  return {
    total: geral.total,
    acertos: geral.acertos,
    hojeTotal: deHoje.total,
    hojeAcertos: deHoje.acertos,
    questoesDistintas,
    minutosHoje,
    minutosSemana,
    flashcardsVencidos,
    revisoes,
    sequencia: sequenciaDias(usuarioId),
  };
}

/** Dias seguidos (até hoje ou ontem) com alguma atividade de estudo. */
export function sequenciaDias(usuarioId: number): number {
  const dias = new Set(
    (
      db()
        .prepare(
          `SELECT ${diaLocal("criado_em")} AS dia FROM respostas WHERE usuario_id = @p1
           UNION SELECT ${diaLocal("criado_em")} FROM sessoes_estudo WHERE usuario_id = @p1
           UNION SELECT ${diaLocal("revisado_em")} FROM flashcard_revisoes WHERE usuario_id = @p1`,
        )
        .all({ p1: usuarioId }) as { dia: string }[]
    ).map((r) => r.dia),
  );
  const inicio = dias.has(hoje()) ? 0 : -1;
  let n = 0;
  while (dias.has(hoje(inicio - n))) n++;
  return n;
}

export function desempenhoPorDisciplina(usuarioId: number) {
  return db()
    .prepare(
      `SELECT d.id, d.nome, d.slug, d.cor, count(r.id) AS total, ifnull(sum(r.correta), 0) AS acertos,
         ifnull(avg(r.tempo_seg), 0) AS tempo_medio
       FROM respostas r JOIN questoes q ON q.id = r.questao_id JOIN disciplinas d ON d.id = q.disciplina_id
       WHERE r.usuario_id = ? GROUP BY d.id ORDER BY total DESC`,
    )
    .all(usuarioId) as { id: number; nome: string; slug: string; cor: string; total: number; acertos: number; tempo_medio: number }[];
}

export function desempenhoPorAssunto(usuarioId: number, disciplinaId?: number) {
  return db()
    .prepare(
      `SELECT a.id, a.nome, d.nome AS disciplina, d.cor, count(r.id) AS total, ifnull(sum(r.correta), 0) AS acertos
       FROM respostas r JOIN questoes q ON q.id = r.questao_id
       JOIN assuntos a ON a.id = q.assunto_id JOIN disciplinas d ON d.id = q.disciplina_id
       WHERE r.usuario_id = ? ${disciplinaId ? "AND d.id = ?" : ""}
       GROUP BY a.id ORDER BY total DESC`,
    )
    .all(...(disciplinaId ? [usuarioId, disciplinaId] : [usuarioId])) as {
    id: number;
    nome: string;
    disciplina: string;
    cor: string;
    total: number;
    acertos: number;
  }[];
}

/** Questões respondidas e acertos por dia, preenchendo dias sem atividade. */
export function respostasPorDia(usuarioId: number, dias = 30) {
  const linhas = db()
    .prepare(
      `SELECT ${diaLocal("criado_em")} AS dia, count(*) AS total, ifnull(sum(correta), 0) AS acertos
       FROM respostas WHERE usuario_id = ? AND ${diaLocal("criado_em")} > ? GROUP BY dia`,
    )
    .all(usuarioId, hoje(-dias)) as { dia: string; total: number; acertos: number }[];
  const mapa = new Map(linhas.map((l) => [l.dia, l]));
  return Array.from({ length: dias }, (_, i) => {
    const dia = hoje(i - dias + 1);
    return mapa.get(dia) ?? { dia, total: 0, acertos: 0 };
  });
}

export function minutosPorDisciplina(usuarioId: number, dias = 30) {
  return db()
    .prepare(
      `SELECT ifnull(d.nome, 'Sem disciplina') AS nome, ifnull(d.cor, '#94a3b8') AS cor, sum(s.minutos) AS minutos
       FROM sessoes_estudo s LEFT JOIN disciplinas d ON d.id = s.disciplina_id
       WHERE s.usuario_id = ? AND ${diaLocal("s.criado_em")} > ?
       GROUP BY d.id ORDER BY minutos DESC`,
    )
    .all(usuarioId, hoje(-dias)) as { nome: string; cor: string; minutos: number }[];
}

/** Mapa de calor de atividade (questões + minutos/2 por dia). */
export function mapaAtividade(usuarioId: number, semanas = 18) {
  const dias = semanas * 7;
  const linhas = db()
    .prepare(
      `SELECT dia, sum(pontos) AS pontos FROM (
         SELECT ${diaLocal("criado_em")} AS dia, count(*) AS pontos FROM respostas WHERE usuario_id = @p1 GROUP BY dia
         UNION ALL
         SELECT ${diaLocal("criado_em")} AS dia, sum(minutos) / 2 AS pontos FROM sessoes_estudo WHERE usuario_id = @p1 GROUP BY dia
         UNION ALL
         SELECT ${diaLocal("revisado_em")} AS dia, count(*) / 2 AS pontos FROM flashcard_revisoes WHERE usuario_id = @p1 GROUP BY dia
       ) WHERE dia > @p2 GROUP BY dia`,
    )
    .all({ p1: usuarioId, p2: hoje(-dias) }) as { dia: string; pontos: number }[];
  const mapa = new Map(linhas.map((l) => [l.dia, l.pontos]));
  // Alinha o início no domingo para formar colunas por semana.
  const hojeData = new Date(hoje() + "T12:00:00Z");
  const totalDias = (semanas - 1) * 7 + hojeData.getUTCDay() + 1;
  return Array.from({ length: totalDias }, (_, i) => {
    const dia = hoje(i - totalDias + 1);
    return { dia, pontos: mapa.get(dia) ?? 0 };
  });
}
