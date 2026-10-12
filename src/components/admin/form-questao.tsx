"use client";

import { useActionState, useState } from "react";
import { salvarQuestao } from "@/app/actions/admin";
import { Alerta, Botao, Campo, Cartao } from "../ui";

export type DadosFormQuestao = {
  id?: number;
  disciplina: string;
  assunto: string;
  tipo: "multipla" | "certo_errado";
  texto_base: string;
  enunciado: string;
  alternativas: { letra: string; texto: string }[];
  gabarito: string;
  comentario: string;
  dificuldade: string;
  anulada: boolean;
  desatualizada: boolean;
  banca: string;
  orgao: string;
  orgao_nome: string;
  cargo: string;
  ano: string;
  escolaridade: string;
  fonte: string;
  numero: string;
};

const LETRAS = ["A", "B", "C", "D", "E"];

export function FormQuestao({
  dados,
  disciplinas,
  assuntos,
  bancas,
  orgaos,
}: {
  dados: DadosFormQuestao;
  disciplinas: string[];
  assuntos: { disciplina: string; caminho: string }[];
  bancas: string[];
  orgaos: string[];
}) {
  const [estado, acao, pendente] = useActionState(salvarQuestao, undefined);
  const [tipo, setTipo] = useState(dados.tipo);
  const [disciplina, setDisciplina] = useState(dados.disciplina);
  const alt = (l: string) => dados.alternativas.find((a) => a.letra === l)?.texto ?? "";

  return (
    <form action={acao} className="space-y-4">
      {dados.id && <input type="hidden" name="id" value={dados.id} />}
      {estado?.erro && <Alerta tipo="erro">{estado.erro}</Alerta>}

      <Cartao className="grid gap-4 p-5 sm:grid-cols-2">
        <Campo rotulo="Disciplina" dica="Escolha uma existente ou digite um nome novo">
          <input name="disciplina" list="lista-disciplinas" value={disciplina} onChange={(e) => setDisciplina(e.target.value)} required className="campo" />
          <datalist id="lista-disciplinas">
            {disciplinas.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </Campo>
        <Campo rotulo="Assunto" dica='Use "Tópico > Subtópico" para criar hierarquia'>
          <input name="assunto" list="lista-assuntos" defaultValue={dados.assunto} className="campo" />
          <datalist id="lista-assuntos">
            {assuntos
              .filter((a) => a.disciplina.toLowerCase() === disciplina.toLowerCase())
              .map((a) => (
                <option key={a.caminho} value={a.caminho} />
              ))}
          </datalist>
        </Campo>
        <Campo rotulo="Tipo">
          <select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as DadosFormQuestao["tipo"])} className="campo">
            <option value="multipla">Múltipla escolha</option>
            <option value="certo_errado">Certo ou errado</option>
          </select>
        </Campo>
        <div className="grid grid-cols-2 gap-2">
          <Campo rotulo="Dificuldade">
            <select name="dificuldade" defaultValue={dados.dificuldade} className="campo">
              <option value="">Não definida</option>
              <option value="1">Fácil</option>
              <option value="2">Média</option>
              <option value="3">Difícil</option>
            </select>
          </Campo>
          <Campo rotulo="Nº na prova">
            <input name="numero" type="number" min={1} defaultValue={dados.numero} className="campo" />
          </Campo>
        </div>
      </Cartao>

      <Cartao className="space-y-4 p-5">
        <Campo rotulo="Texto associado (opcional)" dica="Texto de apoio compartilhado por várias questões">
          <textarea name="texto_base" rows={4} defaultValue={dados.texto_base} className="campo" />
        </Campo>
        <Campo rotulo="Enunciado">
          <textarea name="enunciado" rows={5} defaultValue={dados.enunciado} required className="campo" />
        </Campo>
        {tipo === "multipla" ? (
          <div className="space-y-2">
            <span className="rotulo">Alternativas</span>
            {LETRAS.map((l) => (
              <div key={l} className="flex items-start gap-2">
                <span className="mt-2 w-6 text-center font-bold text-slate-500">{l}</span>
                <textarea name={`alt_${l}`} rows={1} defaultValue={alt(l)} className="campo" placeholder={l === "E" ? "(opcional)" : ""} />
              </div>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap items-end gap-4">
          <Campo rotulo="Gabarito">
            <select name="gabarito" defaultValue={dados.gabarito} className="campo w-40">
              <option value="">Sem gabarito</option>
              {(tipo === "multipla" ? LETRAS : ["C", "E"]).map((l) => (
                <option key={l} value={l}>
                  {tipo === "multipla" ? l : l === "C" ? "Certo" : "Errado"}
                </option>
              ))}
            </select>
          </Campo>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input type="checkbox" name="anulada" defaultChecked={dados.anulada} className="h-4 w-4 accent-marca-600" /> Anulada
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input type="checkbox" name="desatualizada" defaultChecked={dados.desatualizada} className="h-4 w-4 accent-marca-600" /> Desatualizada
          </label>
        </div>
        <Campo rotulo="Comentário do professor (Markdown)">
          <textarea name="comentario" rows={6} defaultValue={dados.comentario} className="campo font-mono text-xs" />
        </Campo>
      </Cartao>

      <Cartao className="grid gap-4 p-5 sm:grid-cols-3">
        <Campo rotulo="Banca">
          <input name="banca" list="lista-bancas" defaultValue={dados.banca} className="campo" placeholder="Ex.: CEBRASPE" />
          <datalist id="lista-bancas">
            {bancas.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </Campo>
        <Campo rotulo="Órgão (sigla)">
          <input name="orgao" list="lista-orgaos" defaultValue={dados.orgao} className="campo" placeholder="Ex.: TRF1" />
          <datalist id="lista-orgaos">
            {orgaos.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        </Campo>
        <Campo rotulo="Órgão (nome)">
          <input name="orgao_nome" defaultValue={dados.orgao_nome} className="campo" />
        </Campo>
        <Campo rotulo="Cargo">
          <input name="cargo" defaultValue={dados.cargo} className="campo" />
        </Campo>
        <Campo rotulo="Ano">
          <input name="ano" type="number" min={1950} max={2100} defaultValue={dados.ano} className="campo" />
        </Campo>
        <Campo rotulo="Escolaridade">
          <select name="escolaridade" defaultValue={dados.escolaridade} className="campo">
            <option value="">—</option>
            <option value="fundamental">Fundamental</option>
            <option value="medio">Médio</option>
            <option value="superior">Superior</option>
          </select>
        </Campo>
        <Campo rotulo="Fonte / observação" className="sm:col-span-3">
          <input name="fonte" defaultValue={dados.fonte} className="campo" placeholder="Ex.: Prova tipo 1, caderno A" />
        </Campo>
      </Cartao>

      <Botao type="submit" disabled={pendente}>
        {pendente ? "Salvando..." : "Salvar questão"}
      </Botao>
    </form>
  );
}
