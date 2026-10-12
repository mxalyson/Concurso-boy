"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirUsuario } from "@/lib/auth";
import { db } from "@/lib/db";
import { lerFiltros } from "@/lib/filtros";
import { idsQuestoes } from "@/lib/questoes";

export async function criarCadernoDeFiltros(form: FormData) {
  const usuario = await exigirUsuario();
  const nome = String(form.get("nome") ?? "").trim().slice(0, 120) || "Meu caderno";
  const limite = Math.min(500, Math.max(1, Number(form.get("limite")) || 100));
  const filtros = lerFiltros(new URLSearchParams(String(form.get("params") ?? "")));
  const ids = idsQuestoes(filtros, usuario.id, limite, false);
  const id = Number(
    db()
      .prepare("INSERT INTO cadernos (usuario_id, nome, descricao) VALUES (?, ?, ?)")
      .run(usuario.id, nome, String(form.get("descricao") ?? "").trim() || null).lastInsertRowid,
  );
  const inserir = db().prepare("INSERT OR IGNORE INTO caderno_questoes (caderno_id, questao_id) VALUES (?, ?)");
  db().transaction(() => ids.forEach((q) => inserir.run(id, q)))();
  redirect(`/cadernos/${id}`);
}

export async function criarCadernoVazio(form: FormData) {
  const usuario = await exigirUsuario();
  const nome = String(form.get("nome") ?? "").trim().slice(0, 120);
  if (!nome) return;
  db()
    .prepare("INSERT INTO cadernos (usuario_id, nome, descricao) VALUES (?, ?, ?)")
    .run(usuario.id, nome, String(form.get("descricao") ?? "").trim() || null);
  revalidatePath("/cadernos");
}

export async function atualizarCaderno(form: FormData) {
  const usuario = await exigirUsuario();
  const id = Number(form.get("id"));
  const nome = String(form.get("nome") ?? "").trim().slice(0, 120);
  if (!nome) return;
  db()
    .prepare("UPDATE cadernos SET nome = ?, descricao = ? WHERE id = ? AND usuario_id = ?")
    .run(nome, String(form.get("descricao") ?? "").trim() || null, id, usuario.id);
  revalidatePath(`/cadernos/${id}`);
}

export async function excluirCaderno(form: FormData) {
  const usuario = await exigirUsuario();
  db().prepare("DELETE FROM cadernos WHERE id = ? AND usuario_id = ?").run(Number(form.get("id")), usuario.id);
  redirect("/cadernos");
}

export async function removerDoCaderno(form: FormData) {
  const usuario = await exigirUsuario();
  const cadernoId = Number(form.get("caderno"));
  if (!db().prepare("SELECT 1 FROM cadernos WHERE id = ? AND usuario_id = ?").get(cadernoId, usuario.id)) return;
  db().prepare("DELETE FROM caderno_questoes WHERE caderno_id = ? AND questao_id = ?").run(cadernoId, Number(form.get("questao")));
  revalidatePath(`/cadernos/${cadernoId}`);
}
