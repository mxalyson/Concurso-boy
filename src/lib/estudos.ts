import { db, diaLocal, hoje } from "./db";

export { calcularRevisao, previsaoIntervalos, type NotaFlashcard } from "./srs";

// --- Plano de estudos e ciclo ------------------------------------------------

export type Plano = {
  objetivo: string | null;
  data_prova: string | null;
  horas_semana: number[]; // domingo..sábado
  ciclo_iniciado_em: string;
};

export type ItemCiclo = {
  disciplina_id: number;
  nome: string;
  slug: string;
  cor: string;
  peso: number;
  dominio: number;
  metaMin: number;
  estudadoMin: number;
  progresso: number;
};

export function obterPlano(usuarioId: number): Plano | null {
  const linha = db()
    .prepare("SELECT objetivo, data_prova, horas_semana, ciclo_iniciado_em FROM planos WHERE usuario_id = ?")
    .get(usuarioId) as (Omit<Plano, "horas_semana"> & { horas_semana: string }) | undefined;
  if (!linha) return null;
  return { ...linha, horas_semana: JSON.parse(linha.horas_semana) as number[] };
}

export function disciplinasDoPlano(usuarioId: number) {
  return db()
    .prepare(
      `SELECT pd.disciplina_id, d.nome, d.slug, d.cor, pd.peso, pd.dominio
       FROM plano_disciplinas pd JOIN disciplinas d ON d.id = pd.disciplina_id
       WHERE pd.usuario_id = ? ORDER BY pd.peso DESC, d.nome`,
    )
    .all(usuarioId) as Omit<ItemCiclo, "metaMin" | "estudadoMin" | "progresso">[];
}

/**
 * Ciclo de estudos: as horas semanais são divididas entre as disciplinas de
 * acordo com o peso na prova e a dificuldade do aluno (menor domínio = mais tempo).
 */
export function calcularCiclo(usuarioId: number): { itens: ItemCiclo[]; totalMin: number; plano: Plano | null } {
  const plano = obterPlano(usuarioId);
  const disciplinas = disciplinasDoPlano(usuarioId);
  if (!plano || !disciplinas.length) return { itens: [], totalMin: 0, plano };
  const totalMin = Math.max(60, plano.horas_semana.reduce((s, h) => s + h, 0) * 60);
  const fator = disciplinas.map((d) => d.peso * (6 - d.dominio));
  const somaFatores = fator.reduce((s, f) => s + f, 0) || 1;
  const estudado = new Map(
    (
      db()
        .prepare(
          `SELECT disciplina_id, sum(minutos) AS minutos FROM sessoes_estudo
           WHERE usuario_id = ? AND criado_em >= ? AND disciplina_id IS NOT NULL GROUP BY disciplina_id`,
        )
        .all(usuarioId, plano.ciclo_iniciado_em) as { disciplina_id: number; minutos: number }[]
    ).map((r) => [r.disciplina_id, r.minutos]),
  );
  const itens = disciplinas.map((d, i) => {
    const metaMin = Math.max(30, Math.round((totalMin * fator[i]) / somaFatores / 30) * 30);
    const estudadoMin = estudado.get(d.disciplina_id) ?? 0;
    return { ...d, metaMin, estudadoMin, progresso: Math.min(100, Math.round((estudadoMin / metaMin) * 100)) };
  });
  return { itens, totalMin: itens.reduce((s, i) => s + i.metaMin, 0), plano };
}

/** Próxima disciplina do ciclo: a que está com menor percentual concluído. */
export function proximaDoCiclo(itens: ItemCiclo[]): ItemCiclo | null {
  const pendentes = itens.filter((i) => i.progresso < 100);
  if (!pendentes.length) return null;
  return pendentes.reduce((menor, i) => (i.progresso < menor.progresso || (i.progresso === menor.progresso && i.peso > menor.peso) ? i : menor));
}

/** Distribui o ciclo em blocos ao longo da semana, alternando disciplinas. */
export function gradeSemanal(itens: ItemCiclo[], horasSemana: number[]) {
  const restante = new Map(itens.map((i) => [i.disciplina_id, i.metaMin]));
  const dias = horasSemana.map((horas) => ({ minutos: Math.round(horas * 60), blocos: [] as { item: ItemCiclo; minutos: number }[] }));
  let ultimo: number | null = null;
  for (const dia of dias) {
    let livre = dia.minutos;
    while (livre >= 30) {
      const candidatos = itens
        .filter((i) => (restante.get(i.disciplina_id) ?? 0) > 0)
        .sort((a, b) => (restante.get(b.disciplina_id) ?? 0) - (restante.get(a.disciplina_id) ?? 0));
      if (!candidatos.length) break;
      const escolhido = candidatos.find((c) => c.disciplina_id !== ultimo) ?? candidatos[0];
      const minutos = Math.min(livre >= 60 ? 60 : 30, restante.get(escolhido.disciplina_id) ?? 0, livre);
      if (minutos <= 0) break;
      const anterior = dia.blocos[dia.blocos.length - 1];
      if (anterior && anterior.item.disciplina_id === escolhido.disciplina_id) anterior.minutos += minutos;
      else dia.blocos.push({ item: escolhido, minutos });
      restante.set(escolhido.disciplina_id, (restante.get(escolhido.disciplina_id) ?? 0) - minutos);
      livre -= minutos;
      ultimo = escolhido.disciplina_id;
    }
  }
  return dias;
}

// --- Progresso por assunto (edital verticalizado) e revisões ------------------

/** Intervalos (em dias) das revisões depois de concluir um assunto. */
export const INTERVALOS_REVISAO = [1, 7, 15, 30, 60, 120];

export type StatusAssunto = "nao_iniciado" | "estudando" | "concluido";

export function progressoAssuntos(usuarioId: number, disciplinaId?: number) {
  return new Map(
    (
      db()
        .prepare(
          `SELECT pa.assunto_id, pa.status, pa.revisoes, pa.ultima_revisao, pa.proxima_revisao
           FROM progresso_assuntos pa JOIN assuntos a ON a.id = pa.assunto_id
           WHERE pa.usuario_id = ? ${disciplinaId ? "AND a.disciplina_id = ?" : ""}`,
        )
        .all(...(disciplinaId ? [usuarioId, disciplinaId] : [usuarioId])) as {
        assunto_id: number;
        status: StatusAssunto;
        revisoes: number;
        ultima_revisao: string | null;
        proxima_revisao: string | null;
      }[]
    ).map((p) => [p.assunto_id, p]),
  );
}

export function definirStatusAssunto(usuarioId: number, assuntoId: number, status: StatusAssunto) {
  const proxima = status === "concluido" ? hoje(INTERVALOS_REVISAO[0]) : null;
  db()
    .prepare(
      `INSERT INTO progresso_assuntos (usuario_id, assunto_id, status, ultima_revisao, proxima_revisao)
       VALUES (@u, @a, @s, @ultima, @proxima)
       ON CONFLICT(usuario_id, assunto_id) DO UPDATE SET
         status = @s,
         ultima_revisao = CASE WHEN @s = 'concluido' THEN @ultima ELSE ultima_revisao END,
         proxima_revisao = CASE WHEN @s = 'concluido' THEN ifnull(proxima_revisao, @proxima) ELSE NULL END,
         revisoes = CASE WHEN @s = 'concluido' THEN revisoes ELSE 0 END`,
    )
    .run({ u: usuarioId, a: assuntoId, s: status, ultima: status === "concluido" ? hoje() : null, proxima });
}

/** Registra uma revisão feita e agenda a próxima. */
export function registrarRevisaoAssunto(usuarioId: number, assuntoId: number) {
  const atual = db()
    .prepare("SELECT revisoes FROM progresso_assuntos WHERE usuario_id = ? AND assunto_id = ?")
    .get(usuarioId, assuntoId) as { revisoes: number } | undefined;
  const revisoes = (atual?.revisoes ?? 0) + 1;
  const intervalo = INTERVALOS_REVISAO[Math.min(revisoes, INTERVALOS_REVISAO.length - 1)];
  db()
    .prepare(
      `INSERT INTO progresso_assuntos (usuario_id, assunto_id, status, revisoes, ultima_revisao, proxima_revisao)
       VALUES (@u, @a, 'concluido', @r, @hoje, @proxima)
       ON CONFLICT(usuario_id, assunto_id) DO UPDATE SET
         status = 'concluido', revisoes = @r, ultima_revisao = @hoje, proxima_revisao = @proxima`,
    )
    .run({ u: usuarioId, a: assuntoId, r: revisoes, hoje: hoje(), proxima: hoje(intervalo) });
}

export function revisoesPendentes(usuarioId: number, limite = 50) {
  return db()
    .prepare(
      `SELECT pa.assunto_id, a.nome AS assunto, d.nome AS disciplina, d.slug, d.cor, pa.revisoes, pa.proxima_revisao,
         (SELECT count(*) FROM questoes q WHERE q.assunto_id = a.id) AS questoes,
         (SELECT m.id FROM materiais m WHERE m.assunto_id = a.id AND (m.publico = 1 OR m.autor_id = pa.usuario_id) LIMIT 1) AS material_id
       FROM progresso_assuntos pa
       JOIN assuntos a ON a.id = pa.assunto_id
       JOIN disciplinas d ON d.id = a.disciplina_id
       WHERE pa.usuario_id = ? AND pa.proxima_revisao IS NOT NULL AND pa.proxima_revisao <= ?
       ORDER BY pa.proxima_revisao, d.nome LIMIT ?`,
    )
    .all(usuarioId, hoje(), limite) as {
    assunto_id: number;
    assunto: string;
    disciplina: string;
    slug: string;
    cor: string;
    revisoes: number;
    proxima_revisao: string;
    questoes: number;
    material_id: number | null;
  }[];
}

export function registrarSessaoEstudo(
  usuarioId: number,
  dados: { disciplinaId: number | null; assuntoId: number | null; minutos: number; tipo: string; observacao?: string | null },
) {
  db()
    .prepare(
      `INSERT INTO sessoes_estudo (usuario_id, disciplina_id, assunto_id, minutos, tipo, observacao)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(usuarioId, dados.disciplinaId, dados.assuntoId, Math.round(dados.minutos), dados.tipo, dados.observacao ?? null);
}

export function sessoesDeHoje(usuarioId: number) {
  return db()
    .prepare(
      `SELECT s.id, s.minutos, s.tipo, s.observacao, s.criado_em, d.nome AS disciplina, d.cor, a.nome AS assunto
       FROM sessoes_estudo s
       LEFT JOIN disciplinas d ON d.id = s.disciplina_id
       LEFT JOIN assuntos a ON a.id = s.assunto_id
       WHERE s.usuario_id = ? AND ${diaLocal("s.criado_em")} = ?
       ORDER BY s.id DESC`,
    )
    .all(usuarioId, hoje()) as {
    id: number;
    minutos: number;
    tipo: string;
    observacao: string | null;
    criado_em: string;
    disciplina: string | null;
    cor: string | null;
    assunto: string | null;
  }[];
}
