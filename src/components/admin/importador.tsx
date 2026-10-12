"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { ChevronDown, ChevronUp, FileJson, FileText, Sparkles, Upload } from "lucide-react";
import { analisarImportacao, confirmarImportacao, type Previa, type RespostaPrevia } from "@/app/actions/admin";
import type { ResultadoImportacao } from "@/lib/importacao";
import { cn } from "@/lib/utils";
import { Alerta, Botao, Campo, Cartao } from "../ui";

type Modo = "pdf" | "ia" | "arquivo";
type Item = {
  incluir: boolean;
  numero?: string | number | null;
  disciplina?: string | null;
  assunto?: string | null;
  tipo?: string | null;
  texto_base?: string | null;
  enunciado: string;
  alternativas: { letra: string; texto: string }[];
  gabarito?: string | null;
  comentario?: string | null;
  [chave: string]: unknown;
};

const EXEMPLO_JSON = `{
  "prova": { "banca": "CEBRASPE", "orgao": "PF", "orgao_nome": "Polícia Federal",
             "cargo": "Agente", "ano": 2021, "escolaridade": "superior" },
  "questoes": [
    { "numero": 1, "disciplina": "Direito Constitucional",
      "assunto": "Direitos e garantias fundamentais > Remédios constitucionais",
      "tipo": "certo_errado", "enunciado": "O habeas data ...", "gabarito": "C",
      "comentario": "Art. 5º, LXXII, da CF." },
    { "numero": 2, "disciplina": "Língua Portuguesa", "assunto": "Crase",
      "enunciado": "Assinale a alternativa ...",
      "alternativas": ["(A) ...", "(B) ...", "(C) ...", "(D) ...", "(E) ..."],
      "gabarito": "B" }
  ]
}`;

function normalizarAlternativas(lista: unknown): { letra: string; texto: string }[] {
  if (!Array.isArray(lista)) return [];
  return lista.map((a, i) =>
    typeof a === "string" ? { letra: String.fromCharCode(65 + i), texto: a.replace(/^\s*\(?[A-Ja-j][).\-–:]\s+/, "") } : (a as { letra: string; texto: string }),
  );
}

export function Importador({ disciplinas, iaAtiva }: { disciplinas: string[]; iaAtiva: boolean }) {
  const [modo, setModo] = useState<Modo>("pdf");
  const [estado, acao, analisando] = useActionState<RespostaPrevia, FormData>(async (anterior, form) => {
    const r = await analisarImportacao(anterior, form);
    if (r?.ok) prepararRevisao(r);
    return r;
  }, undefined);
  const [prova, setProva] = useState<Previa["prova"]>({});
  const [disciplinaPadrao, setDisciplinaPadrao] = useState("");
  const [itens, setItens] = useState<Item[]>([]);
  const [aberto, setAberto] = useState<number | null>(null);
  const [resultado, setResultado] = useState<ResultadoImportacao | { erro: string } | null>(null);
  const [importando, iniciar] = useTransition();

  function prepararRevisao(p: Previa) {
    setProva(p.prova ?? {});
    setItens(
      p.questoes.map((q) => ({
        ...(q as Record<string, unknown>),
        incluir: true,
        enunciado: q.enunciado,
        alternativas: normalizarAlternativas(q.alternativas),
      })) as Item[],
    );
    setResultado(null);
    setAberto(null);
  }

  const atualizar = (i: number, dados: Partial<Item>) => setItens((lista) => lista.map((it, k) => (k === i ? { ...it, ...dados } : it)));
  const selecionados = itens.filter((i) => i.incluir);
  const semDisciplina = selecionados.filter((i) => !i.disciplina && !disciplinaPadrao).length;

  const importar = () => {
    iniciar(async () => {
      const questoes = selecionados.map(({ incluir: _i, _aviso: _a, ...q }) => ({
        ...q,
        disciplina: q.disciplina || disciplinaPadrao,
        numero: q.numero ?? undefined,
      }));
      setResultado(await confirmarImportacao(JSON.stringify({ prova, questoes })));
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        {(
          [
            { m: "pdf", icone: FileText, titulo: "PDF da prova", texto: "Leitura automática de provas com texto selecionável + gabarito." },
            { m: "ia", icone: Sparkles, titulo: "PDF com IA", texto: "Qualquer prova, inclusive escaneada. Classifica assuntos e comenta." },
            { m: "arquivo", icone: FileJson, titulo: "JSON ou CSV", texto: "Planilhas e arquivos estruturados de outras fontes." },
          ] as const
        ).map(({ m, icone: Icone, titulo, texto }) => (
          <button
            key={m}
            type="button"
            onClick={() => setModo(m)}
            className={cn(
              "cartao p-4 text-left transition",
              modo === m ? "border-marca-500 ring-2 ring-marca-500/20" : "hover:border-slate-300 dark:hover:border-slate-700",
            )}
          >
            <Icone className="mb-2 h-5 w-5 text-marca-600" />
            <p className="font-semibold">{titulo}</p>
            <p className="text-xs text-slate-500">{texto}</p>
          </button>
        ))}
      </div>

      <form action={acao} className="cartao space-y-4 p-5" key={modo}>
        <input type="hidden" name="modo" value={modo} />
        {modo === "arquivo" ? (
          <>
            <Campo rotulo="Arquivo (.json ou .csv)">
              <input type="file" name="arquivo" accept=".json,.csv,text/csv,application/json" className="campo" />
            </Campo>
            <Campo rotulo="…ou cole o conteúdo">
              <textarea name="conteudo" rows={6} className="campo font-mono text-xs" placeholder={EXEMPLO_JSON} />
            </Campo>
            <details className="text-sm text-slate-600 dark:text-slate-400">
              <summary className="cursor-pointer font-medium">Formatos aceitos</summary>
              <div className="mt-2 space-y-2">
                <p>
                  <strong>JSON:</strong> objeto com <code>prova</code> (dados comuns) e <code>questoes</code>, ou apenas uma lista de questões. Campos:{" "}
                  <code>disciplina, assunto, tipo (multipla | certo_errado), texto_base, enunciado, alternativas, gabarito, comentario, dificuldade (1-3),
                  anulada, banca, orgao, orgao_nome, cargo, ano, escolaridade, numero, fonte</code>.
                </p>
                <pre className="overflow-x-auto rounded bg-slate-100 p-3 text-xs dark:bg-slate-800">{EXEMPLO_JSON}</pre>
                <p>
                  <strong>CSV:</strong> primeira linha com cabeçalho usando os mesmos nomes de campos; alternativas nas colunas <code>a, b, c, d, e</code>.
                  Separador vírgula ou ponto e vírgula.
                </p>
              </div>
            </details>
          </>
        ) : (
          <>
            {modo === "ia" && !iaAtiva && (
              <Alerta tipo="aviso">
                A extração com IA precisa da variável <code>ANTHROPIC_API_KEY</code> configurada no servidor.
              </Alerta>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="PDF da prova" dica="Baixe nos sites oficiais das bancas (Cebraspe, FGV, FCC, Vunesp...)">
                <input type="file" name="prova" accept="application/pdf" required className="campo" />
              </Campo>
              <Campo rotulo="PDF do gabarito (opcional)" dica="Gabarito definitivo, de preferência">
                <input type="file" name="gabarito" accept="application/pdf" className="campo" />
              </Campo>
            </div>
            <Campo rotulo="…ou cole o gabarito" dica='Ex.: "1 C 2 E 3 A" ou a tabela copiada do PDF. Use X para questões anuladas.'>
              <textarea name="gabarito_texto" rows={3} className="campo font-mono text-xs" />
            </Campo>
            {modo === "ia" && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="comentarios" className="h-4 w-4 accent-marca-600" /> Gerar comentários explicativos (mais lento)
              </label>
            )}
          </>
        )}
        <Botao type="submit" disabled={analisando || (modo === "ia" && !iaAtiva)}>
          <Upload className="h-4 w-4" /> {analisando ? (modo === "ia" ? "A IA está lendo a prova (pode levar alguns minutos)..." : "Analisando...") : "Analisar"}
        </Botao>
        {estado && !estado.ok && <Alerta tipo="erro">{estado.erro}</Alerta>}
      </form>

      {estado?.ok && itens.length > 0 && (
        <div className="space-y-4">
          {estado.avisos.map((a) => (
            <Alerta key={a} tipo="aviso">
              {a}
            </Alerta>
          ))}
          <Cartao className="p-5">
            <h2 className="mb-3 font-semibold">Dados da prova (valem para todas as questões)</h2>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {(
                [
                  ["banca", "Banca", "CEBRASPE"],
                  ["orgao", "Órgão (sigla)", "TRF1"],
                  ["orgao_nome", "Órgão (nome)", ""],
                  ["cargo", "Cargo", "Analista"],
                  ["ano", "Ano", "2024"],
                ] as const
              ).map(([k, r, ph]) => (
                <Campo key={k} rotulo={r}>
                  <input value={prova[k] ?? ""} onChange={(e) => setProva({ ...prova, [k]: e.target.value })} className="campo" placeholder={ph} />
                </Campo>
              ))}
              <Campo rotulo="Escolaridade">
                <select value={prova.escolaridade ?? ""} onChange={(e) => setProva({ ...prova, escolaridade: e.target.value })} className="campo">
                  <option value="">—</option>
                  <option value="fundamental">Fundamental</option>
                  <option value="medio">Médio</option>
                  <option value="superior">Superior</option>
                </select>
              </Campo>
            </div>
            <div className="mt-3 max-w-sm">
              <Campo rotulo="Disciplina padrão" dica="Usada nas questões sem disciplina definida">
                <input value={disciplinaPadrao} onChange={(e) => setDisciplinaPadrao(e.target.value)} list="imp-disciplinas" className="campo" />
              </Campo>
            </div>
            <datalist id="imp-disciplinas">
              {disciplinas.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </Cartao>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {itens.length} questões reconhecidas · {selecionados.length} selecionadas · {selecionados.filter((i) => !i.gabarito).length} sem gabarito
            </p>
            <div className="flex gap-2 text-sm">
              <button type="button" className="text-marca-600 hover:underline" onClick={() => setItens(itens.map((i) => ({ ...i, incluir: true })))}>
                Marcar todas
              </button>
              <button type="button" className="text-marca-600 hover:underline" onClick={() => setItens(itens.map((i) => ({ ...i, incluir: false })))}>
                Desmarcar todas
              </button>
            </div>
          </div>

          <div className="cartao divide-y divide-slate-100 dark:divide-slate-800">
            {itens.map((it, i) => (
              <div key={i} className={cn(!it.incluir && "opacity-50")}>
                <div className="flex flex-wrap items-center gap-2 px-3 py-2">
                  <input type="checkbox" checked={it.incluir} onChange={(e) => atualizar(i, { incluir: e.target.checked })} className="h-4 w-4 accent-marca-600" />
                  <span className="w-8 font-mono text-xs text-slate-500">{it.numero ?? i + 1}</span>
                  <input
                    value={it.disciplina ?? ""}
                    onChange={(e) => atualizar(i, { disciplina: e.target.value })}
                    list="imp-disciplinas"
                    placeholder={disciplinaPadrao || "Disciplina"}
                    className="campo w-44 py-1 text-xs"
                  />
                  <input value={it.assunto ?? ""} onChange={(e) => atualizar(i, { assunto: e.target.value })} placeholder="Assunto" className="campo w-48 py-1 text-xs" />
                  <select
                    value={it.gabarito ?? ""}
                    onChange={(e) => atualizar(i, { gabarito: e.target.value || null })}
                    className={cn("campo w-24 py-1 text-xs", !it.gabarito && "border-rose-300")}
                  >
                    <option value="">Gab.?</option>
                    {(it.tipo === "certo_errado" || it.alternativas.length < 2 ? ["C", "E"] : it.alternativas.map((a) => a.letra)).map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                    <option value="X">Anulada</option>
                  </select>
                  <span className="min-w-0 flex-1 truncate text-sm">{it.enunciado}</span>
                  <button type="button" onClick={() => setAberto(aberto === i ? null : i)} className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800">
                    {aberto === i ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>
                {aberto === i && (
                  <div className="space-y-2 bg-slate-50 px-3 py-3 dark:bg-slate-950/40">
                    <label className="block text-xs">
                      <span className="rotulo">Texto associado</span>
                      <textarea value={it.texto_base ?? ""} onChange={(e) => atualizar(i, { texto_base: e.target.value })} rows={3} className="campo text-xs" />
                    </label>
                    <label className="block text-xs">
                      <span className="rotulo">Enunciado</span>
                      <textarea value={it.enunciado} onChange={(e) => atualizar(i, { enunciado: e.target.value })} rows={4} className="campo text-xs" />
                    </label>
                    {it.alternativas.map((a, k) => (
                      <div key={a.letra} className="flex gap-2">
                        <span className="mt-1.5 w-5 text-xs font-bold">{a.letra}</span>
                        <textarea
                          value={a.texto}
                          rows={1}
                          onChange={(e) =>
                            atualizar(i, { alternativas: it.alternativas.map((x, j) => (j === k ? { ...x, texto: e.target.value } : x)) })
                          }
                          className="campo text-xs"
                        />
                      </div>
                    ))}
                    {it.comentario && (
                      <label className="block text-xs">
                        <span className="rotulo">Comentário</span>
                        <textarea value={it.comentario} onChange={(e) => atualizar(i, { comentario: e.target.value })} rows={3} className="campo text-xs" />
                      </label>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {semDisciplina > 0 && <Alerta tipo="aviso">{semDisciplina} questões selecionadas estão sem disciplina. Defina a disciplina padrão ou preencha cada uma.</Alerta>}
          {resultado && "erro" in resultado && <Alerta tipo="erro">{resultado.erro}</Alerta>}
          {resultado && !("erro" in resultado) && (
            <Alerta tipo={resultado.erros.length ? "aviso" : "sucesso"}>
              <p>
                <strong>{resultado.inseridas}</strong> questões importadas, {resultado.duplicadas} já existiam.
                {resultado.ids.length > 0 && (
                  <>
                    {" "}
                    <Link href={`/questoes/${resultado.ids[0]}`} className="underline">
                      Ver a primeira
                    </Link>
                  </>
                )}
              </p>
              {resultado.erros.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-xs">
                  {resultado.erros.slice(0, 20).map((e) => (
                    <li key={e.indice}>
                      Questão {e.indice + 1}: {e.mensagem}
                    </li>
                  ))}
                </ul>
              )}
            </Alerta>
          )}
          <Botao onClick={importar} disabled={importando || selecionados.length === 0 || semDisciplina > 0} tamanho="lg">
            {importando ? "Importando..." : `Importar ${selecionados.length} questões`}
          </Botao>
        </div>
      )}
    </div>
  );
}
