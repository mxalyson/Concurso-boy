"use server";

import { revalidatePath } from "next/cache";
import { exigirAdmin, exigirUsuario } from "@/lib/auth";
import { db } from "@/lib/db";
import { gerarComentarioIA, iaDisponivel } from "@/lib/ia";
import { estatisticasQuestao, obterQuestao, registrarResposta, respostasValidas, type EstatisticasQuestao } from "@/lib/questoes";

export type ResultadoResposta =
  | { ok: true; correta: boolean; gabarito: string; comentario: string | null; estatisticas: EstatisticasQuestao }
  | { ok: false; erro: string };

export async function responderQuestao(questaoId: number, resposta: string, tempoSeg: number | null): Promise<ResultadoResposta> {
  const usuario = await exigirUsuario();
  const q = obterQuestao(questaoId, usuario.id);
  if (!q) return { ok: false, erro: "Questão não encontrada." };
  if (!respostasValidas(q).includes(resposta)) return { ok: false, erro: "Resposta inválida." };
  if (!q.gabarito) return { ok: false, erro: "Esta questão ainda não tem gabarito cadastrado." };
  const tempo = tempoSeg && tempoSeg > 0 && tempoSeg < 3600 ? Math.round(tempoSeg) : null;
  const r = registrarResposta(usuario.id, questaoId, resposta, tempo);
  return { ok: true, ...r, comentario: q.comentario, estatisticas: estatisticasQuestao(questaoId) };
}

export async function revelarGabarito(questaoId: number) {
  const usuario = await exigirUsuario();
  const q = obterQuestao(questaoId, usuario.id);
  if (!q) return null;
  return { gabarito: q.gabarito, comentario: q.comentario, estatisticas: estatisticasQuestao(questaoId) };
}

export async function alternarFavorito(questaoId: number): Promise<boolean> {
  const usuario = await exigirUsuario();
  const apagou = db().prepare("DELETE FROM favoritos WHERE usuario_id = ? AND questao_id = ?").run(usuario.id, questaoId).changes;
  if (apagou) return false;
  db().prepare("INSERT INTO favoritos (usuario_id, questao_id) VALUES (?, ?)").run(usuario.id, questaoId);
  return true;
}

export type ExtrasQuestao = {
  anotacao: string;
  comentarios: { id: number; texto: string; criado_em: string; autor: string; meu: boolean }[];
  cadernos: { id: number; nome: string; contem: boolean }[];
  decks: { id: number; nome: string }[];
  admin: boolean;
  ia: boolean;
};

export async function carregarExtras(questaoId: number): Promise<ExtrasQuestao> {
  const usuario = await exigirUsuario();
  const anotacao =
    (db().prepare("SELECT texto FROM anotacoes WHERE usuario_id = ? AND questao_id = ?").get(usuario.id, questaoId) as
      | { texto: string }
      | undefined)?.texto ?? "";
  const comentarios = (
    db()
      .prepare(
        `SELECT c.id, c.texto, c.criado_em, u.nome AS autor, c.usuario_id
         FROM comentarios c JOIN usuarios u ON u.id = c.usuario_id WHERE c.questao_id = ? ORDER BY c.id`,
      )
      .all(questaoId) as { id: number; texto: string; criado_em: string; autor: string; usuario_id: number }[]
  ).map(({ usuario_id, ...c }) => ({ ...c, meu: usuario_id === usuario.id || usuario.papel === "admin" }));
  const cadernos = (
    db()
      .prepare(
        `SELECT c.id, c.nome, EXISTS (SELECT 1 FROM caderno_questoes cq WHERE cq.caderno_id = c.id AND cq.questao_id = ?) AS contem
         FROM cadernos c WHERE c.usuario_id = ? ORDER BY c.nome`,
      )
      .all(questaoId, usuario.id) as { id: number; nome: string; contem: number }[]
  ).map((c) => ({ ...c, contem: !!c.contem }));
  const decks = db().prepare("SELECT id, nome FROM flashcard_decks WHERE usuario_id = ? ORDER BY nome").all(usuario.id) as {
    id: number;
    nome: string;
  }[];
  return { anotacao, comentarios, cadernos, decks, admin: usuario.papel === "admin", ia: iaDisponivel() };
}

export async function salvarAnotacao(questaoId: number, texto: string) {
  const usuario = await exigirUsuario();
  if (!texto.trim()) {
    db().prepare("DELETE FROM anotacoes WHERE usuario_id = ? AND questao_id = ?").run(usuario.id, questaoId);
    return;
  }
  db()
    .prepare(
      `INSERT INTO anotacoes (usuario_id, questao_id, texto) VALUES (?, ?, ?)
       ON CONFLICT(usuario_id, questao_id) DO UPDATE SET texto = excluded.texto, atualizado_em = datetime('now')`,
    )
    .run(usuario.id, questaoId, texto.slice(0, 5000));
}

export async function comentar(questaoId: number, texto: string) {
  const usuario = await exigirUsuario();
  const limpo = texto.trim().slice(0, 3000);
  if (limpo.length < 2) return;
  db().prepare("INSERT INTO comentarios (questao_id, usuario_id, texto) VALUES (?, ?, ?)").run(questaoId, usuario.id, limpo);
}

export async function excluirComentario(id: number) {
  const usuario = await exigirUsuario();
  if (usuario.papel === "admin") db().prepare("DELETE FROM comentarios WHERE id = ?").run(id);
  else db().prepare("DELETE FROM comentarios WHERE id = ? AND usuario_id = ?").run(id, usuario.id);
}

export async function reportarQuestao(questaoId: number, motivo: string, detalhes: string) {
  const usuario = await exigirUsuario();
  db()
    .prepare("INSERT INTO reportes (questao_id, usuario_id, motivo, detalhes) VALUES (?, ?, ?, ?)")
    .run(questaoId, usuario.id, motivo.slice(0, 100), detalhes.trim().slice(0, 2000) || null);
}

export async function alternarCaderno(questaoId: number, cadernoId: number): Promise<boolean> {
  const usuario = await exigirUsuario();
  const dono = db().prepare("SELECT 1 FROM cadernos WHERE id = ? AND usuario_id = ?").get(cadernoId, usuario.id);
  if (!dono) return false;
  const apagou = db().prepare("DELETE FROM caderno_questoes WHERE caderno_id = ? AND questao_id = ?").run(cadernoId, questaoId).changes;
  if (apagou) return false;
  db().prepare("INSERT INTO caderno_questoes (caderno_id, questao_id) VALUES (?, ?)").run(cadernoId, questaoId);
  revalidatePath("/cadernos");
  return true;
}

export async function criarCadernoComQuestao(questaoId: number, nome: string) {
  const usuario = await exigirUsuario();
  const limpo = nome.trim().slice(0, 120);
  if (!limpo) return null;
  const id = Number(db().prepare("INSERT INTO cadernos (usuario_id, nome) VALUES (?, ?)").run(usuario.id, limpo).lastInsertRowid);
  db().prepare("INSERT INTO caderno_questoes (caderno_id, questao_id) VALUES (?, ?)").run(id, questaoId);
  revalidatePath("/cadernos");
  return { id, nome: limpo, contem: true };
}

export async function criarFlashcardDaQuestao(questaoId: number, deck: number | string, frente: string, verso: string) {
  const usuario = await exigirUsuario();
  if (!frente.trim() || !verso.trim()) return { ok: false as const, erro: "Preencha frente e verso." };
  let deckId: number;
  if (typeof deck === "string") {
    const q = obterQuestao(questaoId, usuario.id);
    deckId = Number(
      db()
        .prepare("INSERT INTO flashcard_decks (usuario_id, nome, disciplina_id) VALUES (?, ?, ?)")
        .run(usuario.id, deck.trim() || "Meus flashcards", q?.disciplina_id ?? null).lastInsertRowid,
    );
  } else {
    if (!db().prepare("SELECT 1 FROM flashcard_decks WHERE id = ? AND usuario_id = ?").get(deck, usuario.id))
      return { ok: false as const, erro: "Baralho não encontrado." };
    deckId = deck;
  }
  db()
    .prepare("INSERT INTO flashcards (deck_id, frente, verso, questao_id) VALUES (?, ?, ?, ?)")
    .run(deckId, frente.trim(), verso.trim(), questaoId);
  revalidatePath("/flashcards");
  return { ok: true as const };
}

export async function gerarComentarioComIA(questaoId: number) {
  const admin = await exigirAdmin();
  const q = obterQuestao(questaoId, admin.id);
  if (!q?.gabarito) return { ok: false as const, erro: "Questão sem gabarito." };
  try {
    const comentario = await gerarComentarioIA({
      enunciado: q.enunciado,
      texto_base: q.texto_base,
      alternativas: q.alternativas,
      tipo: q.tipo,
      gabarito: q.gabarito,
      disciplina: q.disciplina_nome,
      assunto: q.assunto_nome,
    });
    db().prepare("UPDATE questoes SET comentario = ? WHERE id = ?").run(comentario, questaoId);
    return { ok: true as const, comentario };
  } catch (e) {
    return { ok: false as const, erro: e instanceof Error ? e.message : "Falha ao gerar comentário." };
  }
}
