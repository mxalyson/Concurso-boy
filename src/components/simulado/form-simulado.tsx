"use client";

import { useActionState, useState } from "react";
import { criarSimulado } from "@/app/actions/simulados";
import { Alerta, Botao, Campo } from "../ui";

export function FormSimulado({
  params,
  disciplinas,
  totalDisponivel,
}: {
  params: string;
  disciplinas: { id: number; nome: string; cor: string; total: number }[];
  totalDisponivel: number;
}) {
  const [estado, acao, pendente] = useActionState(criarSimulado, undefined);
  const [porDisciplina, setPorDisciplina] = useState(false);
  const [qtds, setQtds] = useState<Record<number, number>>({});
  const somaQtds = Object.values(qtds).reduce((s, n) => s + (n || 0), 0);

  return (
    <form action={acao} className="cartao space-y-4 p-5">
      <input type="hidden" name="params" value={params} />
      {estado?.erro && <Alerta tipo="erro">{estado.erro}</Alerta>}
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo rotulo="Título" className="sm:col-span-3">
          <input name="titulo" className="campo" defaultValue="Simulado" required />
        </Campo>
        {!porDisciplina && (
          <Campo rotulo="Quantidade de questões" dica={`${totalDisponivel} disponíveis com os filtros`}>
            <input name="quantidade" type="number" min={1} max={200} defaultValue={Math.min(20, Math.max(1, totalDisponivel))} className="campo" />
          </Campo>
        )}
        <Campo rotulo="Duração (minutos)" dica="Média de 3 min por questão">
          <input name="duracao" type="number" min={5} max={600} defaultValue={60} className="campo" />
        </Campo>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="h-4 w-4 accent-marca-600" checked={porDisciplina} onChange={(e) => setPorDisciplina(e.target.checked)} />
        Definir quantidade por disciplina (como no edital)
      </label>
      {porDisciplina && (
        <div className="grid gap-2 sm:grid-cols-2">
          {disciplinas.map((d) => (
            <label key={d.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-800">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.cor }} />
              <span className="flex-1 truncate">{d.nome}</span>
              <span className="text-xs text-slate-400">{d.total} disp.</span>
              <input
                name={`qtd_${d.id}`}
                type="number"
                min={0}
                max={Math.min(100, d.total)}
                value={qtds[d.id] ?? 0}
                onChange={(e) => setQtds({ ...qtds, [d.id]: Number(e.target.value) })}
                className="campo w-20 py-1"
              />
            </label>
          ))}
          <p className="text-sm text-slate-500 sm:col-span-2">Total: {somaQtds} questões</p>
        </div>
      )}
      <Botao type="submit" disabled={pendente || (porDisciplina && somaQtds === 0) || totalDisponivel === 0}>
        {pendente ? "Montando..." : "Iniciar simulado"}
      </Botao>
    </form>
  );
}
