"use client";

import Link from "next/link";
import { useActionState } from "react";
import { cadastrar, entrar, type EstadoForm } from "@/app/actions/auth";
import { Alerta, Botao, Campo } from "./ui";

export function FormAuth({ modo, destino }: { modo: "entrar" | "cadastrar"; destino?: string }) {
  const [estado, acao, pendente] = useActionState<EstadoForm, FormData>(modo === "entrar" ? entrar : cadastrar, undefined);
  return (
    <form action={acao} className="cartao space-y-4 p-6 sm:p-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{modo === "entrar" ? "Entrar" : "Criar conta"}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {modo === "entrar" ? "Bem-vindo de volta! Continue de onde parou." : "Comece a estudar com questões, simulados e um plano de estudos."}
        </p>
      </div>
      {estado?.erro && <Alerta tipo="erro">{estado.erro}</Alerta>}
      {modo === "cadastrar" && (
        <Campo rotulo="Nome">
          <input name="nome" required className="campo" autoComplete="name" />
        </Campo>
      )}
      <Campo rotulo="E-mail">
        <input name="email" type="email" required className="campo" autoComplete="email" />
      </Campo>
      <Campo rotulo="Senha">
        <input
          name="senha"
          type="password"
          required
          minLength={modo === "cadastrar" ? 6 : undefined}
          className="campo"
          autoComplete={modo === "entrar" ? "current-password" : "new-password"}
        />
      </Campo>
      {destino && <input type="hidden" name="destino" value={destino} />}
      <Botao type="submit" className="w-full" disabled={pendente}>
        {pendente ? "Aguarde..." : modo === "entrar" ? "Entrar" : "Criar conta"}
      </Botao>
      <p className="text-center text-sm text-slate-500">
        {modo === "entrar" ? (
          <>
            Ainda não tem conta?{" "}
            <Link href="/cadastrar" className="font-medium text-marca-600 hover:underline">
              Cadastre-se
            </Link>
          </>
        ) : (
          <>
            Já tem conta?{" "}
            <Link href="/entrar" className="font-medium text-marca-600 hover:underline">
              Entrar
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
