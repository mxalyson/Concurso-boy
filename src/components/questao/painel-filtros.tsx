"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Bookmark,
  Filter,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { excluirFiltro, salvarFiltro } from "@/app/actions/filtros";
import { filtrosParaParams, type Filtros } from "@/lib/filtros";
import { DIFICULDADES, ESCOLARIDADES, cn } from "@/lib/utils";
import { Botao } from "../ui";
import { MultiSelecao } from "./multi-selecao";

type Contagem = { valor: string; total: number };

export type OpcoesFiltro = {
  disciplinas: { id: number; nome: string; cor: string; total: number }[];
  assuntos: {
    id: number;
    disciplina_id: number;
    nome: string;
    nivel: number;
    total?: number;
  }[];
  bancas: { id: number; sigla: string; nome: string; total: number }[];
  orgaos: { id: number; sigla: string; nome: string; total: number }[];
  anos: number[];
  provas: {
    id: number;
    banca: string | null;
    orgao: string | null;
    cargo: string | null;
    ano: number | null;
    total: number;
  }[];
  areas: Contagem[];
  cargos: Contagem[];
  esferas: Contagem[];
  ufs: Contagem[];
  cadernos: { id: number; nome: string }[];
  salvos: { id: number; nome: string; params: string }[];
};

const ESFERAS: Record<string, string> = {
  federal: "Federal",
  estadual: "Estadual",
  municipal: "Municipal",
  distrital: "Distrital",
};
const COM = [
  { valor: "comentario", rotulo: "Com gabarito comentado" },
  { valor: "forum", rotulo: "Com comentários de alunos" },
  { valor: "anotacao", rotulo: "Com minhas anotações" },
  { valor: "imagem", rotulo: "Com imagem, tabela ou fórmula" },
  { valor: "texto", rotulo: "Com texto associado" },
];
const EXCLUIR = [
  { valor: "cadernos", rotulo: "Dos meus cadernos" },
  { valor: "simulados", rotulo: "Dos meus simulados" },
];
const ORIGENS = [
  { valor: "oficial", rotulo: "Só provas oficiais" },
  { valor: "autoral", rotulo: "Só questões autorais" },
];

export function nomeProva(p: OpcoesFiltro["provas"][number]) {
  return [p.banca, p.ano, p.orgao, p.cargo].filter(Boolean).join(" · ");
}

const VAZIO: Filtros = {
  disciplinas: [],
  assuntos: [],
  bancas: [],
  orgaos: [],
  anos: [],
  escolaridades: [],
  dificuldades: [],
  ordem: "recentes",
};

function Secao({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {titulo}
      </legend>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </fieldset>
  );
}

const STATUS = [
  { valor: "nao_resolvidas", rotulo: "Não resolvidas" },
  { valor: "resolvidas", rotulo: "Já resolvidas" },
  { valor: "acertei", rotulo: "Acertei (última tentativa)" },
  { valor: "errei", rotulo: "Errei (última tentativa)" },
];

export function PainelFiltros({
  opcoes,
  filtros,
  base = "/questoes",
}: {
  opcoes: OpcoesFiltro;
  filtros: Filtros;
  base?: string;
}) {
  const router = useRouter();
  const [f, setF] = useState<Filtros>(filtros);
  const [avancado, setAvancado] = useState(
    filtros.orgaos.length +
      filtros.anos.length +
      filtros.escolaridades.length +
      filtros.dificuldades.length >
      0 ||
      !!(
        filtros.provas?.length ||
        filtros.areas?.length ||
        filtros.cargos?.length ||
        filtros.esferas?.length ||
        filtros.ufs?.length
      ) ||
      !!(
        filtros.com?.length ||
        filtros.excluir?.length ||
        filtros.origem ||
        filtros.tipo
      ) ||
      !!filtros.cargo ||
      !!filtros.caderno ||
      !!filtros.favoritas ||
      !!filtros.incluirAnuladas,
  );

  // assuntos das disciplinas escolhidas: vêm do servidor junto com a página e, quando a
  // seleção de disciplinas muda no painel, são buscados em /api/assuntos
  const [listaAssuntos, setListaAssuntos] = useState(opcoes.assuntos);
  const chaveDisciplinas = f.disciplinas.join(",");
  useEffect(() => {
    if (!chaveDisciplinas) return;
    const faltam = chaveDisciplinas.split(",").map(Number).some((d) => !listaAssuntos.some((a) => a.disciplina_id === d));
    if (!faltam) return;
    let ativo = true;
    fetch(`/api/assuntos?d=${chaveDisciplinas}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((lista: OpcoesFiltro["assuntos"]) => ativo && setListaAssuntos((atual) => [...atual.filter((a) => !lista.some((b) => b.id === a.id)), ...lista]))
      .catch(() => undefined);
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveDisciplinas]);
  const assuntos = useMemo(
    () => listaAssuntos.filter((a) => f.disciplinas.includes(a.disciplina_id) || f.assuntos.includes(a.id)),
    [f.disciplinas, f.assuntos, listaAssuntos],
  );
  const nomeDisciplina = useMemo(
    () => new Map(opcoes.disciplinas.map((d) => [d.id, d.nome])),
    [opcoes.disciplinas],
  );

  const aplicar = (novo: Filtros = f) => {
    const params = filtrosParaParams(novo);
    router.push(`${base}${params.size ? `?${params}` : ""}`);
  };

  const num = (v: string[]) => v.map(Number);

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          aplicar();
        }}
        className="cartao space-y-4 p-4"
      >
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={f.q ?? ""}
              onChange={(e) => setF({ ...f, q: e.target.value || undefined })}
              className="campo pl-9"
              placeholder="Buscar por palavras-chave no enunciado, alternativas ou comentário (ou #ID)"
            />
          </div>
          <Botao type="submit">
            <Filter className="h-4 w-4" />{" "}
            <span className="hidden sm:inline">Filtrar</span>
          </Botao>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MultiSelecao
            rotulo="Disciplina"
            opcoes={opcoes.disciplinas.map((d) => ({
              valor: String(d.id),
              rotulo: d.nome,
              detalhe: d.total,
              cor: d.cor,
            }))}
            selecionados={f.disciplinas.map(String)}
            onChange={(v) => {
              const disciplinas = num(v);
              const validos = new Set(
                listaAssuntos
                  .filter((a) => disciplinas.includes(a.disciplina_id))
                  .map((a) => a.id),
              );
              setF({
                ...f,
                disciplinas,
                assuntos: disciplinas.length
                  ? f.assuntos.filter((a) => validos.has(a))
                  : f.assuntos,
              });
            }}
          />
          <MultiSelecao
            rotulo="Assunto"
            opcoes={assuntos.map((a) => ({
              valor: String(a.id),
              rotulo: a.nome,
              nivel: a.nivel,
              detalhe:
                f.disciplinas.length === 1
                  ? a.total || undefined
                  : a.nivel === 0
                    ? nomeDisciplina.get(a.disciplina_id)
                    : undefined,
            }))}
            selecionados={f.assuntos.map(String)}
            onChange={(v) => setF({ ...f, assuntos: num(v) })}
            placeholder={f.disciplinas.length ? "Todos" : "Escolha a disciplina"}
          />
          <MultiSelecao
            rotulo="Banca"
            opcoes={opcoes.bancas.map((b) => ({
              valor: String(b.id),
              rotulo: b.sigla,
              detalhe: b.total,
            }))}
            selecionados={f.bancas.map(String)}
            onChange={(v) => setF({ ...f, bancas: num(v) })}
          />
          <MultiSelecao
            rotulo="Situação"
            unico
            opcoes={STATUS}
            selecionados={f.status ? [f.status] : []}
            onChange={(v) =>
              setF({ ...f, status: (v[0] as Filtros["status"]) || undefined })
            }
          />
        </div>

        {avancado && (
          <div className="space-y-4 border-t border-slate-100 pt-4 dark:border-slate-800">
            <Secao titulo="Concurso">
              <MultiSelecao
                rotulo="Prova (concurso)"
                opcoes={opcoes.provas.map((p) => ({
                  valor: String(p.id),
                  rotulo: nomeProva(p),
                  detalhe: p.total,
                }))}
                selecionados={(f.provas ?? []).map(String)}
                onChange={(v) => setF({ ...f, provas: num(v) })}
              />
              <MultiSelecao
                rotulo="Órgão / instituição"
                opcoes={opcoes.orgaos.map((o) => ({
                  valor: String(o.id),
                  rotulo: `${o.sigla}${o.nome !== o.sigla ? ` — ${o.nome}` : ""}`,
                  detalhe: o.total,
                }))}
                selecionados={f.orgaos.map(String)}
                onChange={(v) => setF({ ...f, orgaos: num(v) })}
              />
              <MultiSelecao
                rotulo="Cargo"
                opcoes={opcoes.cargos.map((c) => ({
                  valor: c.valor,
                  rotulo: c.valor,
                  detalhe: c.total,
                }))}
                selecionados={f.cargos ?? []}
                onChange={(v) => setF({ ...f, cargos: v })}
              />
              <MultiSelecao
                rotulo="Ano"
                opcoes={opcoes.anos.map((a) => ({
                  valor: String(a),
                  rotulo: String(a),
                }))}
                selecionados={f.anos.map(String)}
                onChange={(v) => setF({ ...f, anos: num(v) })}
              />
            </Secao>
            <Secao titulo="Carreira e região">
              <MultiSelecao
                rotulo="Área / carreira"
                opcoes={opcoes.areas.map((a) => ({
                  valor: a.valor,
                  rotulo: a.valor,
                  detalhe: a.total,
                }))}
                selecionados={f.areas ?? []}
                onChange={(v) => setF({ ...f, areas: v })}
              />
              <MultiSelecao
                rotulo="Escolaridade"
                opcoes={Object.entries(ESCOLARIDADES).map(
                  ([valor, rotulo]) => ({ valor, rotulo }),
                )}
                selecionados={f.escolaridades}
                onChange={(v) => setF({ ...f, escolaridades: v })}
              />
              <MultiSelecao
                rotulo="Esfera"
                opcoes={opcoes.esferas.map((e) => ({
                  valor: e.valor,
                  rotulo: ESFERAS[e.valor] ?? e.valor,
                  detalhe: e.total,
                }))}
                selecionados={f.esferas ?? []}
                onChange={(v) => setF({ ...f, esferas: v })}
              />
              <MultiSelecao
                rotulo="Região (UF)"
                opcoes={opcoes.ufs.map((u) => ({
                  valor: u.valor,
                  rotulo: u.valor,
                  detalhe: u.total,
                }))}
                selecionados={f.ufs ?? []}
                onChange={(v) => setF({ ...f, ufs: v })}
              />
            </Secao>
            <Secao titulo="Questão">
              <MultiSelecao
                rotulo="Dificuldade"
                opcoes={Object.entries(DIFICULDADES).map(([valor, rotulo]) => ({
                  valor,
                  rotulo,
                }))}
                selecionados={f.dificuldades.map(String)}
                onChange={(v) => setF({ ...f, dificuldades: num(v) })}
              />
              <MultiSelecao
                rotulo="Modalidade"
                unico
                opcoes={[
                  { valor: "multipla", rotulo: "Múltipla escolha" },
                  { valor: "certo_errado", rotulo: "Certo ou errado" },
                ]}
                selecionados={f.tipo ? [f.tipo] : []}
                onChange={(v) =>
                  setF({ ...f, tipo: (v[0] as Filtros["tipo"]) || undefined })
                }
              />
              <MultiSelecao
                rotulo="Questões com"
                opcoes={COM}
                selecionados={f.com ?? []}
                onChange={(v) => setF({ ...f, com: v as Filtros["com"] })}
                placeholder="Qualquer"
              />
              <MultiSelecao
                rotulo="Origem"
                unico
                opcoes={ORIGENS}
                selecionados={f.origem ? [f.origem] : []}
                onChange={(v) =>
                  setF({
                    ...f,
                    origem: (v[0] as Filtros["origem"]) || undefined,
                  })
                }
              />
            </Secao>
            <Secao titulo="Meus estudos">
              <MultiSelecao
                rotulo="Caderno"
                unico
                opcoes={opcoes.cadernos.map((c) => ({
                  valor: String(c.id),
                  rotulo: c.nome,
                }))}
                selecionados={f.caderno ? [String(f.caderno)] : []}
                onChange={(v) =>
                  setF({ ...f, caderno: v[0] ? Number(v[0]) : undefined })
                }
                placeholder="Nenhum"
              />
              <MultiSelecao
                rotulo="Excluir questões"
                opcoes={EXCLUIR}
                selecionados={f.excluir ?? []}
                onChange={(v) =>
                  setF({ ...f, excluir: v as Filtros["excluir"] })
                }
                placeholder="Nenhuma"
              />
              <div className="space-y-1.5 pt-6 text-sm sm:col-span-1 lg:col-span-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-marca-600"
                    checked={!!f.favoritas}
                    onChange={(e) =>
                      setF({ ...f, favoritas: e.target.checked })
                    }
                  />
                  Só favoritas
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-marca-600"
                    checked={!!f.incluirAnuladas}
                    onChange={(e) =>
                      setF({
                        ...f,
                        incluirAnuladas: e.target.checked,
                        incluirDesatualizadas: e.target.checked,
                      })
                    }
                  />
                  Incluir anuladas e desatualizadas
                </label>
              </div>
            </Secao>
          </div>
        )}

        <FiltrosAtivos filtros={filtros} opcoes={opcoes} aplicar={aplicar} />
        <MeusFiltros
          salvos={opcoes.salvos}
          atuais={filtrosParaParams({
            ...filtros,
            ordem: "recentes",
            semente: undefined,
          }).toString()}
          base={base}
        />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setAvancado(!avancado)}
            className={cn(
              "flex items-center gap-1.5 text-sm font-medium text-marca-600 hover:underline",
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />{" "}
            {avancado
              ? "Menos filtros"
              : "Mais filtros (prova, órgão, cargo, ano, área, dificuldade...)"}
          </button>
          <button
            type="button"
            onClick={() => {
              setF(VAZIO);
              aplicar(VAZIO);
            }}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Limpar filtros
          </button>
        </div>
      </form>
      {/* formulário de "salvar filtros" fica fora do formulário principal (forms não se aninham) */}
      <form id="form-salvar-filtro" action={salvarFiltro} className="hidden" />
    </>
  );
}

/** "Meus filtros": combinações salvas com nome, para reaplicar com um clique. */
function MeusFiltros({
  salvos,
  atuais,
  base,
}: {
  salvos: OpcoesFiltro["salvos"];
  atuais: string;
  base: string;
}) {
  const router = useRouter();
  if (!salvos.length && !atuais) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <Bookmark className="h-4 w-4 text-slate-400" />
      <span className="font-medium text-slate-600 dark:text-slate-300">
        Meus filtros:
      </span>
      {salvos.map((s) => (
        <span
          key={s.id}
          className="group flex items-center rounded-full border border-slate-200 dark:border-slate-700"
        >
          <button
            type="button"
            onClick={() => router.push(`${base}?${s.params}`)}
            className="px-2.5 py-0.5 hover:text-marca-600"
          >
            {s.nome}
          </button>
          <button
            type="button"
            onClick={() => void excluirFiltro(s.id)}
            className="pr-2 text-slate-300 hover:text-rose-500"
            title="Excluir filtro salvo"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </span>
      ))}
      {atuais && (
        <details className="relative">
          <summary className="cursor-pointer list-none rounded-full px-2 py-0.5 text-marca-600 hover:bg-marca-50 dark:hover:bg-marca-950/40">
            + Salvar filtros atuais
          </summary>
          <div className="cartao absolute left-0 z-20 mt-1 flex w-72 gap-2 p-2">
            <input
              type="hidden"
              name="params"
              value={atuais}
              form="form-salvar-filtro"
            />
            <input
              name="nome"
              form="form-salvar-filtro"
              required
              placeholder="Nome (ex.: PF — Informática)"
              className="campo py-1.5"
            />
            <button
              form="form-salvar-filtro"
              className="rounded-lg bg-marca-600 px-3 text-sm font-semibold text-white hover:bg-marca-700"
            >
              Salvar
            </button>
          </div>
        </details>
      )}
    </div>
  );
}

/** Filtros aplicados, como etiquetas removíveis (estilo dos sites de questões). */
function FiltrosAtivos({
  filtros,
  opcoes,
  aplicar,
}: {
  filtros: Filtros;
  opcoes: OpcoesFiltro;
  aplicar: (f: Filtros) => void;
}) {
  const nome = <T extends { id: number }>(
    lista: T[],
    id: number,
    rotulo: (x: T) => string,
  ) => {
    const x = lista.find((i) => i.id === id);
    return x ? rotulo(x) : `#${id}`;
  };
  const tirar = <K extends keyof Filtros>(chave: K, valor?: unknown) => {
    const atual = filtros[chave];
    const novo = Array.isArray(atual)
      ? (atual as unknown[]).filter((v) => v !== valor)
      : undefined;
    aplicar({ ...filtros, [chave]: novo });
  };
  const etiquetas: { rotulo: string; remover: () => void }[] = [
    ...filtros.disciplinas.map((id) => ({
      rotulo: nome(opcoes.disciplinas, id, (d) => d.nome),
      remover: () => tirar("disciplinas", id),
    })),
    ...filtros.assuntos.map((id) => ({
      rotulo: nome(opcoes.assuntos, id, (a) => a.nome),
      remover: () => tirar("assuntos", id),
    })),
    ...filtros.bancas.map((id) => ({
      rotulo: nome(opcoes.bancas, id, (b) => b.sigla),
      remover: () => tirar("bancas", id),
    })),
    ...(filtros.provas ?? []).map((id) => ({
      rotulo: nome(opcoes.provas, id, nomeProva),
      remover: () => tirar("provas", id),
    })),
    ...filtros.orgaos.map((id) => ({
      rotulo: nome(opcoes.orgaos, id, (o) => o.sigla),
      remover: () => tirar("orgaos", id),
    })),
    ...(filtros.cargos ?? []).map((c) => ({
      rotulo: c,
      remover: () => tirar("cargos", c),
    })),
    ...filtros.anos.map((a) => ({
      rotulo: String(a),
      remover: () => tirar("anos", a),
    })),
    ...(filtros.areas ?? []).map((a) => ({
      rotulo: a,
      remover: () => tirar("areas", a),
    })),
    ...filtros.escolaridades.map((e) => ({
      rotulo: ESCOLARIDADES[e as keyof typeof ESCOLARIDADES] ?? e,
      remover: () => tirar("escolaridades", e),
    })),
    ...(filtros.esferas ?? []).map((e) => ({
      rotulo: ESFERAS[e] ?? e,
      remover: () => tirar("esferas", e),
    })),
    ...(filtros.ufs ?? []).map((u) => ({
      rotulo: u,
      remover: () => tirar("ufs", u),
    })),
    ...filtros.dificuldades.map((d) => ({
      rotulo: DIFICULDADES[d as keyof typeof DIFICULDADES] ?? String(d),
      remover: () => tirar("dificuldades", d),
    })),
    ...(filtros.com ?? []).map((c) => ({
      rotulo: COM.find((x) => x.valor === c)?.rotulo ?? c,
      remover: () => tirar("com", c),
    })),
    ...(filtros.excluir ?? []).map((c) => ({
      rotulo: `Excluir ${EXCLUIR.find((x) => x.valor === c)?.rotulo.toLowerCase() ?? c}`,
      remover: () => tirar("excluir", c),
    })),
    ...(filtros.tipo
      ? [
          {
            rotulo:
              filtros.tipo === "multipla"
                ? "Múltipla escolha"
                : "Certo ou errado",
            remover: () => tirar("tipo"),
          },
        ]
      : []),
    ...(filtros.origem
      ? [
          {
            rotulo:
              ORIGENS.find((o) => o.valor === filtros.origem)?.rotulo ?? "",
            remover: () => tirar("origem"),
          },
        ]
      : []),
    ...(filtros.status
      ? [
          {
            rotulo:
              STATUS.find((s) => s.valor === filtros.status)?.rotulo ?? "",
            remover: () => tirar("status"),
          },
        ]
      : []),
  ];
  if (!etiquetas.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {etiquetas.map((e, i) => (
        <button
          key={i}
          type="button"
          onClick={e.remover}
          className="flex items-center gap-1 rounded-full bg-marca-50 px-2.5 py-1 text-xs font-medium text-marca-700 hover:bg-marca-100 dark:bg-marca-950/50 dark:text-marca-300"
          title="Remover filtro"
        >
          {e.rotulo} <X className="h-3 w-3" />
        </button>
      ))}
    </div>
  );
}

export function SeletorOrdem({
  filtros,
  base = "/questoes",
}: {
  filtros: Filtros;
  base?: string;
}) {
  const router = useRouter();
  return (
    <select
      value={filtros.ordem}
      onChange={(e) => {
        const ordem = e.target.value as Filtros["ordem"];
        const params = filtrosParaParams({
          ...filtros,
          ordem,
          semente:
            ordem === "aleatoria"
              ? Math.floor(Math.random() * 99991) + 1
              : undefined,
        });
        router.push(`${base}?${params}`);
      }}
      className="campo w-auto py-1.5"
      aria-label="Ordenar"
    >
      <option value="recentes">Data da prova — mais recentes</option>
      <option value="antigas">Data da prova — mais antigas</option>
      <option value="adicionadas">Adicionadas recentemente</option>
      {filtros.q && (
        <option value="relevancia">Relevância das palavras-chave</option>
      )}
      <option value="comentadas">Com gabarito comentado primeiro</option>
      <option value="aleatoria">Aleatória</option>
      <option value="mais_respondidas">Mais resolvidas</option>
      <option value="dificeis">Maior índice de erro</option>
    </select>
  );
}

/** Quantidade de questões por página (preserva os filtros da URL). */
export function PorPagina({ valor }: { valor: number }) {
  const router = useRouter();
  const caminho = usePathname();
  const params = useSearchParams();
  return (
    <select
      value={valor}
      onChange={(e) => {
        const q = new URLSearchParams(params.toString());
        q.set("pp", e.target.value);
        q.delete("pg");
        router.push(`${caminho}?${q}`);
      }}
      className="campo w-auto py-1.5"
      aria-label="Questões por página"
    >
      {[5, 10, 20, 50].map((n) => (
        <option key={n} value={n}>
          {n} por página
        </option>
      ))}
    </select>
  );
}
