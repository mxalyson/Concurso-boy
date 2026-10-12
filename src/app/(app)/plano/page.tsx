import Link from "next/link";
import { CalendarClock, RotateCcw, Timer, Trash2 } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { hoje } from "@/lib/db";
import { calcularCiclo, gradeSemanal, obterPlano, proximaDoCiclo } from "@/lib/estudos";
import { listarDisciplinas } from "@/lib/taxonomia";
import { formatarData, formatarMinutos, pct } from "@/lib/utils";
import { reiniciarCiclo, removerDisciplinaPlano, salvarDisciplinaPlano, salvarPlano } from "@/app/actions/estudos";
import { BarraProgresso, Botao, CabecalhoPagina, Campo, Cartao, LinkBotao, Vazio } from "@/components/ui";

export const metadata = { title: "Plano e ciclo de estudos" };

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const PESOS = ["", "Muito baixo", "Baixo", "Médio", "Alto", "Muito alto"];
const DOMINIOS = ["", "Nenhum", "Pouco", "Regular", "Bom", "Excelente"];

export default async function PaginaPlano() {
  const usuario = await exigirUsuario();
  const plano = obterPlano(usuario.id);
  const { itens, totalMin } = calcularCiclo(usuario.id);
  const disciplinas = listarDisciplinas();
  const noPlano = new Set(itens.map((i) => i.disciplina_id));
  const proxima = proximaDoCiclo(itens);
  const horas = plano?.horas_semana ?? [0, 2, 2, 2, 2, 2, 0];
  const grade = itens.length ? gradeSemanal(itens, horas) : [];
  const diasProva = plano?.data_prova
    ? Math.ceil((new Date(plano.data_prova + "T12:00:00Z").getTime() - new Date(hoje() + "T12:00:00Z").getTime()) / 86400000)
    : null;
  const progressoCiclo = totalMin ? pct(itens.reduce((s, i) => s + Math.min(i.estudadoMin, i.metaMin), 0), totalMin) : 0;
  const diaSemana = new Date(hoje() + "T12:00:00Z").getUTCDay();

  return (
    <>
      <CabecalhoPagina
        titulo="Plano e ciclo de estudos"
        descricao="Defina sua disponibilidade e as disciplinas do edital. O ciclo distribui o tempo pelo peso na prova e pela sua dificuldade."
        icone={<CalendarClock className="h-5 w-5" />}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {/* Ciclo */}
          <Cartao className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold">Ciclo atual</h2>
                <p className="text-sm text-slate-500">
                  {itens.length ? `${formatarMinutos(totalMin)} por ciclo · ${progressoCiclo}% concluído` : "Adicione disciplinas para montar o ciclo."}
                </p>
              </div>
              {itens.length > 0 && (
                <form action={reiniciarCiclo}>
                  <Botao variante="secundario" tamanho="sm" title="Zera o progresso e começa uma nova volta">
                    <RotateCcw className="h-3.5 w-3.5" /> Novo ciclo
                  </Botao>
                </form>
              )}
            </div>
            {proxima && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-marca-50 px-4 py-3 dark:bg-marca-950/40">
                <p className="text-sm">
                  Próximo: <strong>{proxima.nome}</strong> · faltam {formatarMinutos(Math.max(0, proxima.metaMin - proxima.estudadoMin))}
                </p>
                <LinkBotao href={`/foco?disciplina=${proxima.disciplina_id}`} tamanho="sm">
                  <Timer className="h-4 w-4" /> Estudar agora
                </LinkBotao>
              </div>
            )}
            {itens.length > 0 && progressoCiclo >= 100 && (
              <p className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                Ciclo completo! Clique em “Novo ciclo” para começar a próxima volta.
              </p>
            )}
            <div className="space-y-3">
              {itens.map((i) => (
                <div key={i.disciplina_id} className="grid items-center gap-2 sm:grid-cols-[1fr_auto]">
                  <div>
                    <div className="mb-1 flex justify-between text-sm">
                      <Link href={`/estudos/${i.slug}`} className="font-medium hover:text-marca-600">
                        {i.nome}
                      </Link>
                      <span className="text-slate-500">
                        {formatarMinutos(i.estudadoMin)} / {formatarMinutos(i.metaMin)}
                      </span>
                    </div>
                    <BarraProgresso valor={i.progresso} cor={i.cor} />
                  </div>
                  <form action={salvarDisciplinaPlano} className="flex items-center gap-1 text-xs">
                    <input type="hidden" name="disciplina" value={i.disciplina_id} />
                    <select name="peso" defaultValue={i.peso} className="campo w-auto py-1 text-xs" title="Peso na prova">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>
                          Peso {n}
                        </option>
                      ))}
                    </select>
                    <select name="dominio" defaultValue={i.dominio} className="campo w-auto py-1 text-xs" title="Seu domínio">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>
                          Domínio {n}
                        </option>
                      ))}
                    </select>
                    <Botao variante="fantasma" tamanho="sm" title="Salvar">
                      OK
                    </Botao>
                    <button formAction={removerDisciplinaPlano} className="rounded p-1.5 text-slate-400 hover:text-rose-600" title="Remover do plano">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </Cartao>

          {/* Grade semanal */}
          {grade.length > 0 && (
            <Cartao className="p-5">
              <h2 className="mb-1 font-semibold">Sugestão de grade semanal</h2>
              <p className="mb-4 text-sm text-slate-500">Blocos de 30–60 minutos alternando disciplinas para manter a concentração.</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                {grade.map((dia, d) => (
                  <div key={d} className={`rounded-lg border p-2 ${d === diaSemana ? "border-marca-400 bg-marca-50/50 dark:bg-marca-950/20" : "border-slate-200 dark:border-slate-800"}`}>
                    <p className="mb-2 text-xs font-semibold uppercase text-slate-500">
                      {DIAS[d]} {d === diaSemana && "· hoje"}
                    </p>
                    {dia.blocos.length === 0 ? (
                      <p className="text-xs text-slate-400">Descanso</p>
                    ) : (
                      <ul className="space-y-1">
                        {dia.blocos.map((b, k) => (
                          <li key={k} className="rounded px-1.5 py-1 text-xs" style={{ backgroundColor: b.item.cor + "22" }}>
                            <span className="block truncate font-medium" style={{ color: b.item.cor }} title={b.item.nome}>
                              {b.item.nome}
                            </span>
                            <span className="text-slate-500">{formatarMinutos(b.minutos)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </Cartao>
          )}
        </div>

        <div className="space-y-6">
          <Cartao className="p-5">
            <h2 className="mb-3 font-semibold">Objetivo</h2>
            {diasProva !== null && (
              <div className="mb-4 rounded-lg bg-slate-900 px-4 py-3 text-center text-white dark:bg-slate-800">
                <p className="text-3xl font-bold">{diasProva >= 0 ? diasProva : 0}</p>
                <p className="text-xs uppercase tracking-wide text-slate-300">
                  {diasProva >= 0 ? `dias para a prova (${formatarData(plano?.data_prova)})` : "a prova já passou"}
                </p>
              </div>
            )}
            <form action={salvarPlano} className="space-y-3">
              <Campo rotulo="Concurso / cargo alvo">
                <input name="objetivo" defaultValue={plano?.objetivo ?? ""} className="campo" placeholder="Ex.: Analista Judiciário — TRT" />
              </Campo>
              <Campo rotulo="Data da prova">
                <input name="data_prova" type="date" defaultValue={plano?.data_prova ?? ""} className="campo" />
              </Campo>
              <div>
                <span className="rotulo">Horas de estudo por dia</span>
                <div className="grid grid-cols-7 gap-1">
                  {DIAS.map((d, i) => (
                    <label key={d} className="text-center text-xs text-slate-500">
                      {d}
                      <input name={`h${i}`} type="number" min={0} max={16} step={0.5} defaultValue={horas[i]} className="campo mt-1 px-0.5 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
                    </label>
                  ))}
                </div>
                <p className="mt-1 text-xs text-slate-500">Total: {horas.reduce((s, h) => s + h, 0)}h por semana</p>
              </div>
              <Botao type="submit" className="w-full">
                Salvar plano
              </Botao>
            </form>
          </Cartao>

          <Cartao className="p-5">
            <h2 className="mb-3 font-semibold">Adicionar disciplina</h2>
            {disciplinas.filter((d) => !noPlano.has(d.id)).length === 0 ? (
              <p className="text-sm text-slate-500">Todas as disciplinas já estão no plano.</p>
            ) : (
              <form action={salvarDisciplinaPlano} className="space-y-3">
                <select name="disciplina" className="campo" required>
                  {disciplinas
                    .filter((d) => !noPlano.has(d.id))
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.nome}
                      </option>
                    ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <Campo rotulo="Peso na prova">
                    <select name="peso" defaultValue={3} className="campo">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>
                          {n} — {PESOS[n]}
                        </option>
                      ))}
                    </select>
                  </Campo>
                  <Campo rotulo="Seu domínio">
                    <select name="dominio" defaultValue={3} className="campo">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>
                          {n} — {DOMINIOS[n]}
                        </option>
                      ))}
                    </select>
                  </Campo>
                </div>
                <Botao type="submit" variante="secundario" className="w-full">
                  Adicionar ao ciclo
                </Botao>
              </form>
            )}
          </Cartao>
        </div>
      </div>
      {itens.length === 0 && disciplinas.length === 0 && (
        <div className="mt-6">
          <Vazio titulo="Sem disciplinas cadastradas" descricao="Importe questões ou rode o seed de exemplo para ter disciplinas disponíveis." />
        </div>
      )}
    </>
  );
}
