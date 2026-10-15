"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { conferirSenha, exigirUsuario, hashSenha } from "@/lib/auth";
import { db, hoje } from "@/lib/db";
import {
  calcularRevisao,
  definirStatusAssunto,
  registrarRevisaoAssunto,
  registrarSessaoEstudo,
  type NotaFlashcard,
  type StatusAssunto,
} from "@/lib/estudos";
import { TIPOS_SESSAO } from "@/lib/utils";

// --- Edital verticalizado ----------------------------------------------------

export async function alterarStatusAssunto(assuntoId: number, status: StatusAssunto) {
  const usuario = await exigirUsuario();
  definirStatusAssunto(usuario.id, assuntoId, status);
  revalidatePath("/estudos", "layout");
  revalidatePath("/revisoes");
}

export async function concluirRevisao(form: FormData) {
  const usuario = await exigirUsuario();
  registrarRevisaoAssunto(usuario.id, Number(form.get("assunto")));
  const minutos = Number(form.get("minutos"));
  if (minutos > 0) {
    const a = db().prepare("SELECT disciplina_id FROM assuntos WHERE id = ?").get(Number(form.get("assunto"))) as
      | { disciplina_id: number }
      | undefined;
    registrarSessaoEstudo(usuario.id, { disciplinaId: a?.disciplina_id ?? null, assuntoId: Number(form.get("assunto")), minutos, tipo: "revisao" });
  }
  revalidatePath("/revisoes");
  revalidatePath("/estudos", "layout");
}

// --- Materiais (teoria / resumos) ---------------------------------------------

export async function salvarMaterial(_: { erro?: string } | undefined, form: FormData): Promise<{ erro?: string } | undefined> {
  const usuario = await exigirUsuario();
  const id = Number(form.get("id")) || null;
  const titulo = String(form.get("titulo") ?? "").trim().slice(0, 200);
  const conteudo = String(form.get("conteudo") ?? "").trim();
  const disciplinaId = Number(form.get("disciplina_id"));
  const assuntoId = Number(form.get("assunto_id")) || null;
  const publico = usuario.papel === "admin" ? (form.get("publico") === "on" ? 1 : 0) : 0;
  if (!titulo || !conteudo || !disciplinaId) return { erro: "Preencha título, disciplina e conteúdo." };
  if (assuntoId) {
    const a = db().prepare("SELECT disciplina_id FROM assuntos WHERE id = ?").get(assuntoId) as { disciplina_id: number } | undefined;
    if (a?.disciplina_id !== disciplinaId) return { erro: "O assunto não pertence à disciplina escolhida." };
  }
  let materialId = id;
  if (id) {
    const atual = db().prepare("SELECT autor_id FROM materiais WHERE id = ?").get(id) as { autor_id: number | null } | undefined;
    if (!atual || (atual.autor_id !== usuario.id && usuario.papel !== "admin")) return { erro: "Sem permissão para editar." };
    db()
      .prepare(
        `UPDATE materiais SET titulo = ?, conteudo = ?, disciplina_id = ?, assunto_id = ?, publico = ?, atualizado_em = datetime('now')
         WHERE id = ?`,
      )
      .run(titulo, conteudo, disciplinaId, assuntoId, publico, id);
  } else {
    materialId = Number(
      db()
        .prepare("INSERT INTO materiais (disciplina_id, assunto_id, titulo, conteudo, autor_id, publico) VALUES (?, ?, ?, ?, ?, ?)")
        .run(disciplinaId, assuntoId, titulo, conteudo, usuario.id, publico).lastInsertRowid,
    );
  }
  revalidatePath("/estudos", "layout");
  redirect(`/estudos/material/${materialId}`);
}

export async function excluirMaterial(form: FormData) {
  const usuario = await exigirUsuario();
  const id = Number(form.get("id"));
  if (usuario.papel === "admin") db().prepare("DELETE FROM materiais WHERE id = ?").run(id);
  else db().prepare("DELETE FROM materiais WHERE id = ? AND autor_id = ?").run(id, usuario.id);
  redirect("/estudos");
}

export async function marcarMaterialEstudado(form: FormData) {
  const usuario = await exigirUsuario();
  const assuntoId = Number(form.get("assunto"));
  const disciplinaId = Number(form.get("disciplina"));
  const minutos = Number(form.get("minutos"));
  if (assuntoId) definirStatusAssunto(usuario.id, assuntoId, "concluido");
  if (minutos > 0) registrarSessaoEstudo(usuario.id, { disciplinaId: disciplinaId || null, assuntoId: assuntoId || null, minutos, tipo: "teoria" });
  revalidatePath("/estudos", "layout");
}

// --- Sessões de estudo (cronômetro) ------------------------------------------

export async function salvarSessaoEstudo(dados: {
  disciplinaId: number | null;
  assuntoId: number | null;
  minutos: number;
  tipo: string;
  observacao?: string;
}) {
  const usuario = await exigirUsuario();
  if (!(dados.minutos > 0 && dados.minutos <= 24 * 60)) return { ok: false };
  const tipo = dados.tipo in TIPOS_SESSAO ? dados.tipo : "teoria";
  registrarSessaoEstudo(usuario.id, { ...dados, tipo, observacao: dados.observacao?.slice(0, 300) || null });
  revalidatePath("/foco");
  revalidatePath("/plano");
  return { ok: true };
}

export async function registrarSessaoManual(form: FormData) {
  await salvarSessaoEstudo({
    disciplinaId: Number(form.get("disciplina")) || null,
    assuntoId: Number(form.get("assunto")) || null,
    minutos: Number(form.get("minutos")),
    tipo: String(form.get("tipo") ?? "teoria"),
    observacao: String(form.get("observacao") ?? ""),
  });
}

export async function excluirSessao(form: FormData) {
  const usuario = await exigirUsuario();
  db().prepare("DELETE FROM sessoes_estudo WHERE id = ? AND usuario_id = ?").run(Number(form.get("id")), usuario.id);
  revalidatePath("/foco");
  revalidatePath("/plano");
}

// --- Plano de estudos ---------------------------------------------------------

export async function salvarPlano(form: FormData) {
  const usuario = await exigirUsuario();
  const horas = [0, 1, 2, 3, 4, 5, 6].map((d) => Math.min(16, Math.max(0, Number(form.get(`h${d}`)) || 0)));
  const data = String(form.get("data_prova") ?? "");
  db()
    .prepare(
      `INSERT INTO planos (usuario_id, objetivo, data_prova, horas_semana) VALUES (?, ?, ?, ?)
       ON CONFLICT(usuario_id) DO UPDATE SET objetivo = excluded.objetivo, data_prova = excluded.data_prova, horas_semana = excluded.horas_semana`,
    )
    .run(usuario.id, String(form.get("objetivo") ?? "").trim().slice(0, 200) || null, /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : null, JSON.stringify(horas));
  revalidatePath("/plano");
  revalidatePath("/painel");
}

export async function salvarDisciplinaPlano(form: FormData) {
  const usuario = await exigirUsuario();
  const disciplina = Number(form.get("disciplina"));
  const peso = Math.min(5, Math.max(1, Number(form.get("peso")) || 1));
  const dominio = Math.min(5, Math.max(1, Number(form.get("dominio")) || 3));
  if (!disciplina) return;
  db()
    .prepare("INSERT OR IGNORE INTO planos (usuario_id) VALUES (?)")
    .run(usuario.id);
  db()
    .prepare(
      `INSERT INTO plano_disciplinas (usuario_id, disciplina_id, peso, dominio) VALUES (?, ?, ?, ?)
       ON CONFLICT(usuario_id, disciplina_id) DO UPDATE SET peso = excluded.peso, dominio = excluded.dominio`,
    )
    .run(usuario.id, disciplina, peso, dominio);
  revalidatePath("/plano");
}

export async function removerDisciplinaPlano(form: FormData) {
  const usuario = await exigirUsuario();
  db().prepare("DELETE FROM plano_disciplinas WHERE usuario_id = ? AND disciplina_id = ?").run(usuario.id, Number(form.get("disciplina")));
  revalidatePath("/plano");
}

export async function reiniciarCiclo() {
  const usuario = await exigirUsuario();
  db().prepare("UPDATE planos SET ciclo_iniciado_em = datetime('now') WHERE usuario_id = ?").run(usuario.id);
  revalidatePath("/plano");
  revalidatePath("/painel");
}

// --- Flashcards ---------------------------------------------------------------

export async function criarDeck(form: FormData) {
  const usuario = await exigirUsuario();
  const nome = String(form.get("nome") ?? "").trim().slice(0, 120);
  if (!nome) return;
  const id = Number(
    db()
      .prepare("INSERT INTO flashcard_decks (usuario_id, nome, disciplina_id) VALUES (?, ?, ?)")
      .run(usuario.id, nome, Number(form.get("disciplina")) || null).lastInsertRowid,
  );
  redirect(`/flashcards/${id}`);
}

export async function excluirDeck(form: FormData) {
  const usuario = await exigirUsuario();
  db().prepare("DELETE FROM flashcard_decks WHERE id = ? AND usuario_id = ?").run(Number(form.get("id")), usuario.id);
  redirect("/flashcards");
}

function donoDoDeck(deckId: number, usuarioId: number) {
  return !!db().prepare("SELECT 1 FROM flashcard_decks WHERE id = ? AND usuario_id = ?").get(deckId, usuarioId);
}

export async function salvarFlashcard(form: FormData) {
  const usuario = await exigirUsuario();
  const deckId = Number(form.get("deck"));
  const id = Number(form.get("id")) || null;
  const frente = String(form.get("frente") ?? "").trim();
  const verso = String(form.get("verso") ?? "").trim();
  if (!donoDoDeck(deckId, usuario.id) || !frente || !verso) return;
  if (id) db().prepare("UPDATE flashcards SET frente = ?, verso = ? WHERE id = ? AND deck_id = ?").run(frente, verso, id, deckId);
  else db().prepare("INSERT INTO flashcards (deck_id, frente, verso) VALUES (?, ?, ?)").run(deckId, frente, verso);
  revalidatePath(`/flashcards/${deckId}`);
}

export async function importarFlashcards(form: FormData) {
  const usuario = await exigirUsuario();
  const deckId = Number(form.get("deck"));
  if (!donoDoDeck(deckId, usuario.id)) return;
  // Uma carta por linha: "frente ; verso" (ou separada por tabulação).
  const linhas = String(form.get("texto") ?? "")
    .split(/\r?\n/)
    .map((l) => l.split(/\t|\s*;\s*|\s+::\s+/))
    .filter((p) => p.length >= 2 && p[0].trim() && p[1].trim());
  const inserir = db().prepare("INSERT INTO flashcards (deck_id, frente, verso) VALUES (?, ?, ?)");
  db().transaction(() => linhas.forEach(([f, ...v]) => inserir.run(deckId, f.trim(), v.join("; ").trim())))();
  revalidatePath(`/flashcards/${deckId}`);
}

export async function excluirFlashcard(form: FormData) {
  const usuario = await exigirUsuario();
  const deckId = Number(form.get("deck"));
  if (!donoDoDeck(deckId, usuario.id)) return;
  db().prepare("DELETE FROM flashcards WHERE id = ? AND deck_id = ?").run(Number(form.get("id")), deckId);
  revalidatePath(`/flashcards/${deckId}`);
}

export async function revisarFlashcard(cardId: number, nota: NotaFlashcard) {
  const usuario = await exigirUsuario();
  const card = db()
    .prepare(
      `SELECT f.facilidade, f.intervalo, f.repeticoes FROM flashcards f JOIN flashcard_decks d ON d.id = f.deck_id
       WHERE f.id = ? AND d.usuario_id = ?`,
    )
    .get(cardId, usuario.id) as { facilidade: number; intervalo: number; repeticoes: number } | undefined;
  if (!card) return null;
  const novo = calcularRevisao(card, nota);
  db()
    .prepare("UPDATE flashcards SET facilidade = ?, intervalo = ?, repeticoes = ?, vence_em = ? WHERE id = ?")
    .run(novo.facilidade, novo.intervalo, novo.repeticoes, novo.vence_em, cardId);
  db().prepare("INSERT INTO flashcard_revisoes (flashcard_id, usuario_id, nota) VALUES (?, ?, ?)").run(cardId, usuario.id, nota);
  return { ...novo, hoje: hoje() };
}

// --- Conta ----------------------------------------------------------------------

export async function salvarConta(_: { erro?: string; ok?: string } | undefined, form: FormData) {
  const usuario = await exigirUsuario();
  const nome = String(form.get("nome") ?? "").trim().slice(0, 100);
  const meta = Math.min(500, Math.max(1, Number(form.get("meta_diaria")) || 30));
  if (nome.length < 2) return { erro: "Informe seu nome." };
  db().prepare("UPDATE usuarios SET nome = ?, meta_diaria = ? WHERE id = ?").run(nome, meta, usuario.id);
  const nova = String(form.get("nova_senha") ?? "");
  if (nova) {
    const atual = db().prepare("SELECT senha_hash FROM usuarios WHERE id = ?").get(usuario.id) as { senha_hash: string };
    if (!conferirSenha(String(form.get("senha_atual") ?? ""), atual.senha_hash)) return { erro: "Senha atual incorreta." };
    if (nova.length < 6) return { erro: "A nova senha precisa ter ao menos 6 caracteres." };
    db().prepare("UPDATE usuarios SET senha_hash = ? WHERE id = ?").run(hashSenha(nova), usuario.id);
  }
  revalidatePath("/", "layout");
  return { ok: "Dados atualizados." };
}
