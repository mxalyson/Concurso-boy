import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "./db";

export type Usuario = {
  id: number;
  nome: string;
  email: string;
  papel: "aluno" | "admin";
  meta_diaria: number;
};

const COOKIE = "cb_sessao";
const DURACAO_DIAS = 30;

export function hashSenha(senha: string) {
  return bcrypt.hashSync(senha, 10);
}

export function conferirSenha(senha: string, hash: string) {
  return bcrypt.compareSync(senha, hash);
}

export async function criarSessao(usuarioId: number) {
  const token = crypto.randomBytes(32).toString("hex");
  const expira = new Date(Date.now() + DURACAO_DIAS * 86400_000);
  db()
    .prepare("INSERT INTO sessoes (token, usuario_id, expira_em) VALUES (?, ?, ?)")
    .run(token, usuarioId, expira.toISOString());
  db().prepare("DELETE FROM sessoes WHERE expira_em < ?").run(new Date().toISOString());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.COOKIE_INSEGURO !== "1",
    path: "/",
    expires: expira,
  });
}

export async function encerrarSessao() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) db().prepare("DELETE FROM sessoes WHERE token = ?").run(token);
  jar.delete(COOKIE);
}

/** Usuário logado na requisição atual (memoizado por requisição). */
export const usuarioAtual = cache(async (): Promise<Usuario | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const usuario = db()
    .prepare(
      `SELECT u.id, u.nome, u.email, u.papel, u.meta_diaria
       FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id
       WHERE s.token = ? AND s.expira_em > ?`,
    )
    .get(token, new Date().toISOString()) as Usuario | undefined;
  return usuario ?? null;
});

export async function exigirUsuario(): Promise<Usuario> {
  const usuario = await usuarioAtual();
  if (!usuario) redirect("/entrar");
  return usuario;
}

export async function exigirAdmin(): Promise<Usuario> {
  const usuario = await exigirUsuario();
  if (usuario.papel !== "admin") redirect("/painel");
  return usuario;
}
