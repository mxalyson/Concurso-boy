"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { conferirSenha, criarSessao, encerrarSessao, hashSenha } from "@/lib/auth";
import { db } from "@/lib/db";

export type EstadoForm = { erro?: string; ok?: string } | undefined;

const Cadastro = z.object({
  nome: z.string().trim().min(2, "Informe seu nome"),
  email: z.string().trim().email("E-mail inválido"),
  senha: z.string().min(6, "A senha precisa ter ao menos 6 caracteres"),
});

export async function cadastrar(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const dados = Cadastro.safeParse(Object.fromEntries(form));
  if (!dados.success) return { erro: dados.error.issues[0].message };
  const { nome, email, senha } = dados.data;
  if (db().prepare("SELECT 1 FROM usuarios WHERE email = ?").get(email)) {
    return { erro: "Já existe uma conta com este e-mail." };
  }
  // O primeiro usuário cadastrado vira administrador.
  const primeiro = (db().prepare("SELECT count(*) AS n FROM usuarios").get() as { n: number }).n === 0;
  const id = Number(
    db()
      .prepare("INSERT INTO usuarios (nome, email, senha_hash, papel) VALUES (?, ?, ?, ?)")
      .run(nome, email, hashSenha(senha), primeiro ? "admin" : "aluno").lastInsertRowid,
  );
  await criarSessao(id);
  redirect("/painel");
}

export async function entrar(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const email = String(form.get("email") ?? "").trim();
  const senha = String(form.get("senha") ?? "");
  const usuario = db().prepare("SELECT id, senha_hash FROM usuarios WHERE email = ?").get(email) as
    | { id: number; senha_hash: string }
    | undefined;
  if (!usuario || !conferirSenha(senha, usuario.senha_hash)) return { erro: "E-mail ou senha incorretos." };
  await criarSessao(usuario.id);
  const destino = String(form.get("destino") ?? "");
  redirect(destino.startsWith("/") && !destino.startsWith("//") ? destino : "/painel");
}

export async function sair() {
  await encerrarSessao();
  redirect("/entrar");
}
