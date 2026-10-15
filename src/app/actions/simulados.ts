"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { exigirUsuario } from "@/lib/auth";
import { db } from "@/lib/db";
import { lerFiltros } from "@/lib/filtros";
import { idsQuestoes } from "@/lib/questoes";
import { corrigirSimulado, obterSimulado, prazoSimulado } from "@/lib/simulados";

export async function criarSimulado(_: { erro?: string } | undefined, form: FormData): Promise<{ erro?: string } | undefined> {
  const usuario = await exigirUsuario();
  const params = String(form.get("params") ?? "");
  const filtros = lerFiltros(new URLSearchParams(params));
  const titulo = String(form.get("titulo") ?? "").trim().slice(0, 120) || "Simulado";
  const duracao = Math.min(600, Math.max(5, Number(form.get("duracao")) || 60));

  // Quantidades por disciplina (opcional): campos "qtd_<id>".
  const porDisciplina = [...form.entries()]
    .filter(([k, v]) => k.startsWith("qtd_") && Number(v) > 0)
    .map(([k, v]) => ({ disciplina: Number(k.slice(4)), qtd: Math.min(100, Number(v)) }));

  let ids: number[] = [];
  if (porDisciplina.length) {
    for (const { disciplina, qtd } of porDisciplina) {
      ids.push(...idsQuestoes({ ...filtros, disciplinas: [disciplina], assuntos: [] }, usuario.id, qtd));
    }
  } else {
    const quantidade = Math.min(200, Math.max(1, Number(form.get("quantidade")) || 20));
    ids = idsQuestoes(filtros, usuario.id, quantidade);
  }
  ids = [...new Set(ids)];
  if (!ids.length) return { erro: "Nenhuma questão com gabarito atende a esses filtros." };

  const id = Number(
    db()
      .prepare("INSERT INTO simulados (usuario_id, titulo, duracao_min, filtros, total) VALUES (?, ?, ?, ?, ?)")
      .run(usuario.id, titulo, duracao, params, ids.length).lastInsertRowid,
  );
  const inserir = db().prepare("INSERT INTO simulado_questoes (simulado_id, ordem, questao_id) VALUES (?, ?, ?)");
  db().transaction(() => ids.forEach((q, i) => inserir.run(id, i + 1, q)))();
  redirect(`/simulados/${id}`);
}

export async function salvarRespostaSimulado(simuladoId: number, ordem: number, resposta: string | null) {
  const usuario = await exigirUsuario();
  const s = obterSimulado(simuladoId, usuario.id);
  if (!s || s.finalizado_em) return { ok: false };
  // Tolerância de 1 minuto para atrasos de rede.
  if (Date.now() > prazoSimulado(s) + 60_000) return { ok: false };
  db()
    .prepare("UPDATE simulado_questoes SET resposta = ? WHERE simulado_id = ? AND ordem = ?")
    .run(resposta ? resposta.toUpperCase().slice(0, 1) : null, simuladoId, ordem);
  return { ok: true };
}

export async function finalizarSimulado(simuladoId: number) {
  const usuario = await exigirUsuario();
  const s = obterSimulado(simuladoId, usuario.id);
  if (!s) redirect("/simulados");
  corrigirSimulado(s);
  revalidatePath("/simulados");
  redirect(`/simulados/${simuladoId}/resultado`);
}

export async function excluirSimulado(form: FormData) {
  const usuario = await exigirUsuario();
  db().prepare("DELETE FROM simulados WHERE id = ? AND usuario_id = ?").run(Number(form.get("id")), usuario.id);
  revalidatePath("/simulados");
}

export async function salvarErradasEmCaderno(form: FormData) {
  const usuario = await exigirUsuario();
  const id = Number(form.get("id"));
  const s = obterSimulado(id, usuario.id);
  if (!s) return;
  const erradas = db()
    .prepare(
      `SELECT sq.questao_id FROM simulado_questoes sq JOIN questoes q ON q.id = sq.questao_id
       WHERE sq.simulado_id = ? AND (sq.resposta IS NULL OR sq.resposta <> q.gabarito)`,
    )
    .all(id) as { questao_id: number }[];
  const cadernoId = Number(
    db()
      .prepare("INSERT INTO cadernos (usuario_id, nome, descricao) VALUES (?, ?, ?)")
      .run(usuario.id, `Erros — ${s.titulo}`, "Questões erradas ou em branco no simulado").lastInsertRowid,
  );
  const inserir = db().prepare("INSERT OR IGNORE INTO caderno_questoes (caderno_id, questao_id) VALUES (?, ?)");
  db().transaction(() => erradas.forEach((e) => inserir.run(cadernoId, e.questao_id)))();
  redirect(`/cadernos/${cadernoId}`);
}
