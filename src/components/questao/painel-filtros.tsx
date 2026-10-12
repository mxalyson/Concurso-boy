"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Filter, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { filtrosParaParams, type Filtros } from "@/lib/filtros";
import { DIFICULDADES, ESCOLARIDADES, cn } from "@/lib/utils";
import { Botao } from "../ui";
import { MultiSelecao } from "./multi-selecao";

export type OpcoesFiltro = {
  disciplinas: { id: number; nome: string; cor: string; total: number }[];
  assuntos: { id: number; disciplina_id: number; nome: string; nivel: number }[];
  bancas: { id: number; sigla: string; nome: string; total: number }[];
  orgaos: { id: number; sigla: string; nome: string; total: number }[];
  anos: number[];
  cadernos: { id: number; nome: string }[];
};

const STATUS = [
  { valor: "nao_resolvidas", rotulo: "Não resolvidas" },
  { valor: "resolvidas", rotulo: "Já resolvidas" },
  { valor: "acertei", rotulo: "Acertei (última tentativa)" },
  { valor: "errei", rotulo: "Errei (última tentativa)" },
];

export function PainelFiltros({ opcoes, filtros, base = "/questoes" }: { opcoes: OpcoesFiltro; filtros: Filtros; base?: string }) {
  const router = useRouter();
  const [f, setF] = useState<Filtros>(filtros);
  const [avancado, setAvancado] = useState(
    filtros.orgaos.length + filtros.anos.length + filtros.escolaridades.length + filtros.dificuldades.length > 0 ||
      !!filtros.cargo ||
      !!filtros.caderno ||
      !!filtros.favoritas ||
      !!filtros.incluirAnuladas,
  );

  const assuntos = useMemo(
    () => (f.disciplinas.length ? opcoes.assuntos.filter((a) => f.disciplinas.includes(a.disciplina_id)) : opcoes.assuntos),
    [f.disciplinas, opcoes.assuntos],
  );
  const nomeDisciplina = useMemo(() => new Map(opcoes.disciplinas.map((d) => [d.id, d.nome])), [opcoes.disciplinas]);

  const aplicar = (novo: Filtros = f) => {
    const params = filtrosParaParams(novo);
    router.push(`${base}${params.size ? `?${params}` : ""}`);
  };

  const num = (v: string[]) => v.map(Number);

  return (
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
          <Filter className="h-4 w-4" /> <span className="hidden sm:inline">Filtrar</span>
        </Botao>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MultiSelecao
          rotulo="Disciplina"
          opcoes={opcoes.disciplinas.map((d) => ({ valor: String(d.id), rotulo: d.nome, detalhe: d.total, cor: d.cor }))}
          selecionados={f.disciplinas.map(String)}
          onChange={(v) => {
            const disciplinas = num(v);
            const validos = new Set(opcoes.assuntos.filter((a) => disciplinas.includes(a.disciplina_id)).map((a) => a.id));
            setF({ ...f, disciplinas, assuntos: disciplinas.length ? f.assuntos.filter((a) => validos.has(a)) : f.assuntos });
          }}
        />
        <MultiSelecao
          rotulo="Assunto"
          opcoes={assuntos.map((a) => ({
            valor: String(a.id),
            rotulo: a.nome,
            nivel: a.nivel,
            detalhe: f.disciplinas.length === 1 ? undefined : a.nivel === 0 ? nomeDisciplina.get(a.disciplina_id) : undefined,
          }))}
          selecionados={f.assuntos.map(String)}
          onChange={(v) => setF({ ...f, assuntos: num(v) })}
        />
        <MultiSelecao
          rotulo="Banca"
          opcoes={opcoes.bancas.map((b) => ({ valor: String(b.id), rotulo: b.sigla, detalhe: b.total }))}
          selecionados={f.bancas.map(String)}
          onChange={(v) => setF({ ...f, bancas: num(v) })}
        />
        <MultiSelecao
          rotulo="Situação"
          unico
          opcoes={STATUS}
          selecionados={f.status ? [f.status] : []}
          onChange={(v) => setF({ ...f, status: (v[0] as Filtros["status"]) || undefined })}
        />
      </div>

      {avancado && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MultiSelecao
            rotulo="Órgão"
            opcoes={opcoes.orgaos.map((o) => ({ valor: String(o.id), rotulo: `${o.sigla}${o.nome !== o.sigla ? ` — ${o.nome}` : ""}`, detalhe: o.total }))}
            selecionados={f.orgaos.map(String)}
            onChange={(v) => setF({ ...f, orgaos: num(v) })}
          />
          <MultiSelecao
            rotulo="Ano"
            opcoes={opcoes.anos.map((a) => ({ valor: String(a), rotulo: String(a) }))}
            selecionados={f.anos.map(String)}
            onChange={(v) => setF({ ...f, anos: num(v) })}
          />
          <MultiSelecao
            rotulo="Escolaridade"
            opcoes={Object.entries(ESCOLARIDADES).map(([valor, rotulo]) => ({ valor, rotulo }))}
            selecionados={f.escolaridades}
            onChange={(v) => setF({ ...f, escolaridades: v })}
          />
          <MultiSelecao
            rotulo="Dificuldade"
            opcoes={Object.entries(DIFICULDADES).map(([valor, rotulo]) => ({ valor, rotulo }))}
            selecionados={f.dificuldades.map(String)}
            onChange={(v) => setF({ ...f, dificuldades: num(v) })}
          />
          <MultiSelecao
            rotulo="Tipo de questão"
            unico
            opcoes={[
              { valor: "multipla", rotulo: "Múltipla escolha" },
              { valor: "certo_errado", rotulo: "Certo ou errado" },
            ]}
            selecionados={f.tipo ? [f.tipo] : []}
            onChange={(v) => setF({ ...f, tipo: (v[0] as Filtros["tipo"]) || undefined })}
          />
          <label>
            <span className="rotulo">Cargo</span>
            <input value={f.cargo ?? ""} onChange={(e) => setF({ ...f, cargo: e.target.value || undefined })} className="campo" placeholder="Ex.: Analista" />
          </label>
          <MultiSelecao
            rotulo="Caderno"
            unico
            opcoes={opcoes.cadernos.map((c) => ({ valor: String(c.id), rotulo: c.nome }))}
            selecionados={f.caderno ? [String(f.caderno)] : []}
            onChange={(v) => setF({ ...f, caderno: v[0] ? Number(v[0]) : undefined })}
            placeholder="Nenhum"
          />
          <div className="space-y-1.5 pt-6 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" className="h-4 w-4 accent-marca-600" checked={!!f.favoritas} onChange={(e) => setF({ ...f, favoritas: e.target.checked })} />
              Só favoritas
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 accent-marca-600"
                checked={!!f.incluirAnuladas}
                onChange={(e) => setF({ ...f, incluirAnuladas: e.target.checked, incluirDesatualizadas: e.target.checked })}
              />
              Incluir anuladas e desatualizadas
            </label>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setAvancado(!avancado)}
          className={cn("flex items-center gap-1.5 text-sm font-medium text-marca-600 hover:underline")}
        >
          <SlidersHorizontal className="h-4 w-4" /> {avancado ? "Menos filtros" : "Mais filtros (órgão, ano, escolaridade...)"}
        </button>
        <button
          type="button"
          onClick={() => {
            const limpo: Filtros = { disciplinas: [], assuntos: [], bancas: [], orgaos: [], anos: [], escolaridades: [], dificuldades: [], ordem: "recentes" };
            setF(limpo);
            aplicar(limpo);
          }}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Limpar filtros
        </button>
      </div>
    </form>
  );
}

export function SeletorOrdem({ filtros, base = "/questoes" }: { filtros: Filtros; base?: string }) {
  const router = useRouter();
  return (
    <select
      value={filtros.ordem}
      onChange={(e) => {
        const ordem = e.target.value as Filtros["ordem"];
        const params = filtrosParaParams({ ...filtros, ordem, semente: ordem === "aleatoria" ? Math.floor(Math.random() * 99991) + 1 : undefined });
        router.push(`${base}?${params}`);
      }}
      className="campo w-auto py-1.5"
      aria-label="Ordenar"
    >
      <option value="recentes">Mais recentes</option>
      <option value="antigas">Mais antigas</option>
      <option value="aleatoria">Aleatória</option>
      <option value="mais_respondidas">Mais resolvidas</option>
      <option value="dificeis">Maior índice de erro</option>
    </select>
  );
}
