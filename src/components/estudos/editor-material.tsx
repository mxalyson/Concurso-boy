"use client";

import { useActionState, useState } from "react";
import { salvarMaterial } from "@/app/actions/estudos";
import { Markdown } from "../markdown";
import { Alerta, Botao, Campo } from "../ui";
import { cn } from "@/lib/utils";

type Material = { id?: number; titulo: string; conteudo: string; disciplina_id: number | null; assunto_id: number | null; publico: boolean };

export function EditorMaterial({
  material,
  disciplinas,
  assuntos,
  admin,
}: {
  material: Material;
  disciplinas: { id: number; nome: string }[];
  assuntos: { id: number; disciplina_id: number; caminho: string }[];
  admin: boolean;
}) {
  const [estado, acao, pendente] = useActionState(salvarMaterial, undefined);
  const [disciplina, setDisciplina] = useState<number | null>(material.disciplina_id);
  const [conteudo, setConteudo] = useState(material.conteudo);
  const [preview, setPreview] = useState(false);
  return (
    <form action={acao} className="space-y-4">
      {material.id && <input type="hidden" name="id" value={material.id} />}
      {estado?.erro && <Alerta tipo="erro">{estado.erro}</Alerta>}
      <div className="cartao grid gap-4 p-5 sm:grid-cols-2">
        <Campo rotulo="Título" className="sm:col-span-2">
          <input name="titulo" defaultValue={material.titulo} required className="campo" placeholder="Ex.: Atos administrativos — atributos (PATI)" />
        </Campo>
        <Campo rotulo="Disciplina">
          <select
            name="disciplina_id"
            required
            value={disciplina ?? ""}
            onChange={(e) => setDisciplina(Number(e.target.value) || null)}
            className="campo"
          >
            <option value="">Selecione...</option>
            {disciplinas.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nome}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Assunto (opcional)">
          <select name="assunto_id" defaultValue={material.assunto_id ?? ""} key={disciplina} className="campo">
            <option value="">Geral da disciplina</option>
            {assuntos
              .filter((a) => a.disciplina_id === disciplina)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.caminho}
                </option>
              ))}
          </select>
        </Campo>
        {admin && (
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="publico" defaultChecked={material.publico} className="h-4 w-4 accent-marca-600" />
            Público (visível para todos os alunos). Desmarcado, fica apenas para você.
          </label>
        )}
      </div>
      <div className="cartao overflow-hidden">
        <div className="flex items-center gap-1 border-b border-slate-100 px-3 py-2 dark:border-slate-800">
          {["Escrever", "Visualizar"].map((rotulo, i) => (
            <button
              key={rotulo}
              type="button"
              onClick={() => setPreview(i === 1)}
              className={cn(
                "rounded-md px-3 py-1 text-sm font-medium",
                preview === (i === 1) ? "bg-slate-100 dark:bg-slate-800" : "text-slate-500 hover:text-slate-800",
              )}
            >
              {rotulo}
            </button>
          ))}
          <span className="ml-auto text-xs text-slate-400">Markdown: **negrito**, # títulos, - listas, | tabelas |, &gt; citações</span>
        </div>
        <textarea
          name="conteudo"
          value={conteudo}
          onChange={(e) => setConteudo(e.target.value)}
          rows={22}
          required
          className={cn("w-full resize-y bg-transparent p-4 font-mono text-sm outline-none", preview && "hidden")}
          placeholder={"# Título\n\nEscreva aqui seu resumo..."}
        />
        {preview && <div className="min-h-96 p-5">{conteudo ? <Markdown>{conteudo}</Markdown> : <p className="text-slate-400">Nada para visualizar.</p>}</div>}
      </div>
      <Botao type="submit" disabled={pendente}>
        {pendente ? "Salvando..." : "Salvar resumo"}
      </Botao>
    </form>
  );
}
