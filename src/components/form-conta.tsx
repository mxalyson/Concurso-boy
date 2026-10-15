"use client";

import { useActionState } from "react";
import { salvarConta } from "@/app/actions/estudos";
import { Alerta, Botao, Campo } from "./ui";

export function FormConta({ nome, email, meta }: { nome: string; email: string; meta: number }) {
  const [estado, acao, pendente] = useActionState(salvarConta, undefined);
  return (
    <form action={acao} className="cartao max-w-xl space-y-4 p-6">
      {estado?.erro && <Alerta tipo="erro">{estado.erro}</Alerta>}
      {estado?.ok && <Alerta tipo="sucesso">{estado.ok}</Alerta>}
      <Campo rotulo="Nome">
        <input name="nome" defaultValue={nome} className="campo" required />
      </Campo>
      <Campo rotulo="E-mail">
        <input value={email} disabled className="campo" />
      </Campo>
      <Campo rotulo="Meta diária de questões">
        <input name="meta_diaria" type="number" min={1} max={500} defaultValue={meta} className="campo w-32" />
      </Campo>
      <fieldset className="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
        <legend className="text-sm font-semibold">Alterar senha (opcional)</legend>
        <input name="senha_atual" type="password" className="campo" placeholder="Senha atual" autoComplete="current-password" />
        <input name="nova_senha" type="password" className="campo" placeholder="Nova senha (mín. 6 caracteres)" autoComplete="new-password" />
      </fieldset>
      <Botao type="submit" disabled={pendente}>
        Salvar
      </Botao>
    </form>
  );
}
