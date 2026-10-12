"use server";

import { revalidatePath } from "next/cache";
import { exigirUsuario } from "@/lib/auth";
import { db } from "@/lib/db";
import { filtrosParaParams, lerFiltros } from "@/lib/filtros";

/** Salva a combinação de filtros atual com um nome ("Meus filtros"). */
export async function salvarFiltro(form: FormData) {
  const usuario = await exigirUsuario();
  const nome = String(form.get("nome") ?? "").trim().slice(0, 80);
  // normaliza: só guarda parâmetros de filtro reconhecidos
  const params = filtrosParaParams(lerFiltros(new URLSearchParams(String(form.get("params") ?? "")))).toString();
  if (!nome || !params) return;
  db().prepare("INSERT INTO filtros_salvos (usuario_id, nome, params) VALUES (?, ?, ?)").run(usuario.id, nome, params);
  revalidatePath("/questoes");
}

export async function excluirFiltro(id: number) {
  const usuario = await exigirUsuario();
  db().prepare("DELETE FROM filtros_salvos WHERE id = ? AND usuario_id = ?").run(id, usuario.id);
  revalidatePath("/questoes");
}
