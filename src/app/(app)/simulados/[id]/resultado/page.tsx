import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Check, Minus, RotateCcw, X } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { obterQuestoesPorIds } from "@/lib/questoes";
import { itensSimulado, obterSimulado } from "@/lib/simulados";
import { cn, dataSqlite, formatarMinutos, pct } from "@/lib/utils";
import { salvarErradasEmCaderno } from "@/app/actions/simulados";
import { Markdown } from "@/components/markdown";
import { ImagensQuestao } from "@/components/questao/imagens-questao";
import { BarraProgresso, Botao, Cartao, Estatistica, LinkBotao } from "@/components/ui";
import { TextoQuestao } from "@/components/questao/texto-questao";
import { semMarcadores } from "@/lib/marcadores";

export const metadata = { title: "Resultado do simulado" };

export default async function ResultadoSimulado({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirUsuario();
  const id = Number((await params).id);
  const s = obterSimulado(id, usuario.id);
  if (!s) notFound();
  if (!s.finalizado_em) redirect(`/simulados/${id}`);

  const itens = itensSimulado(id);
  const questoes = new Map(obterQuestoesPorIds(itens.map((i) => i.questao_id), usuario.id).map((q) => [q.id, q]));
  const linhas = itens
    .filter((i) => questoes.has(i.questao_id))
    .map((i) => {
      const q = questoes.get(i.questao_id)!;
      return { ...i, q, correta: !!i.resposta && i.resposta === q.gabarito };
    });
  const acertos = linhas.filter((l) => l.correta).length;
  const brancos = linhas.filter((l) => !l.resposta).length;
  const erros = linhas.length - acertos - brancos;
  const minutos = Math.max(1, Math.round((dataSqlite(s.finalizado_em).getTime() - dataSqlite(s.iniciado_em).getTime()) / 60000));

  const porDisciplina = new Map<string, { cor: string; total: number; acertos: number }>();
  for (const l of linhas) {
    const atual = porDisciplina.get(l.q.disciplina_nome) ?? { cor: l.q.disciplina_cor, total: 0, acertos: 0 };
    atual.total++;
    if (l.correta) atual.acertos++;
    porDisciplina.set(l.q.disciplina_nome, atual);
  }
  const nota = pct(acertos, linhas.length);
  const rotulo = (r: string | null, tipo: string) => (!r ? "—" : tipo === "certo_errado" ? (r === "C" ? "Certo" : "Errado") : r);

  return (
    <>
      <Link href="/simulados" className="mb-4 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
        <ArrowLeft className="h-4 w-4" /> Simulados
      </Link>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{s.titulo}</h1>
          <p className="text-sm text-slate-500">Resultado do simulado</p>
        </div>
        <div className="flex gap-2">
          {erros + brancos > 0 && (
            <form action={salvarErradasEmCaderno}>
              <input type="hidden" name="id" value={id} />
              <Botao variante="secundario" tamanho="sm">
                Salvar erradas em caderno
              </Botao>
            </form>
          )}
          <LinkBotao href={`/simulados/novo?${s.filtros}`} tamanho="sm">
            <RotateCcw className="h-4 w-4" /> Novo com os mesmos filtros
          </LinkBotao>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Estatistica
          rotulo="Nota"
          valor={<span className={nota >= 70 ? "text-emerald-600" : nota >= 50 ? "text-amber-600" : "text-rose-600"}>{nota}%</span>}
          detalhe={nota >= 70 ? "Excelente desempenho!" : nota >= 50 ? "Bom, mas dá para melhorar." : "Reforce a teoria e refaça."}
        />
        <Estatistica rotulo="Acertos" valor={acertos} detalhe={`de ${linhas.length} questões`} />
        <Estatistica rotulo="Erros / em branco" valor={`${erros} / ${brancos}`} />
        <Estatistica rotulo="Tempo" valor={formatarMinutos(Math.min(minutos, s.duracao_min))} detalhe={`${Math.round((Math.min(minutos, s.duracao_min) * 60) / Math.max(1, linhas.length))}s por questão`} />
      </div>

      <Cartao className="mb-6 p-5">
        <h2 className="mb-4 font-semibold">Desempenho por disciplina</h2>
        <div className="space-y-3">
          {[...porDisciplina.entries()].map(([nome, d]) => (
            <div key={nome}>
              <div className="mb-1 flex justify-between text-sm">
                <span>{nome}</span>
                <span className="text-slate-500">
                  {d.acertos}/{d.total} · {pct(d.acertos, d.total)}%
                </span>
              </div>
              <BarraProgresso valor={pct(d.acertos, d.total)} cor={d.cor} />
            </div>
          ))}
        </div>
      </Cartao>

      <h2 className="mb-3 font-semibold">Gabarito comentado</h2>
      <div className="space-y-3">
        {linhas.map((l) => (
          <details key={l.ordem} className="cartao group">
            <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white",
                  l.correta ? "bg-emerald-500" : l.resposta ? "bg-rose-500" : "bg-slate-400",
                )}
              >
                {l.correta ? <Check className="h-4 w-4" /> : l.resposta ? <X className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
              </span>
              <span className="w-8 font-mono text-sm text-slate-500">{l.ordem}.</span>
              <span className="min-w-0 flex-1 truncate text-sm">{semMarcadores(l.q.enunciado)}</span>
              <span className="hidden shrink-0 text-xs text-slate-500 sm:block">
                Sua: <strong>{rotulo(l.resposta, l.q.tipo)}</strong> · Gabarito: <strong>{rotulo(l.q.gabarito, l.q.tipo)}</strong>
              </span>
            </summary>
            <div className="space-y-3 border-t border-slate-100 px-4 py-4 text-sm dark:border-slate-800">
              <p className="text-xs text-slate-500">
                {l.q.disciplina_nome}
                {l.q.assunto_nome && ` › ${l.q.assunto_nome}`} {l.q.banca && `· ${l.q.banca}`} {l.q.ano && `· ${l.q.ano}`} ·{" "}
                <Link href={`/questoes/${l.q.id}`} className="text-marca-600 hover:underline">
                  Abrir questão Q{l.q.id}
                </Link>
              </p>
              {l.q.texto_base && !l.q.imagens.some((i) => i.parte === "contexto" && i.substitui) && <TextoQuestao texto={l.q.texto_base} imagens={l.q.imagens} className="rounded bg-slate-50 p-3 dark:bg-slate-950/50" />}
              <ImagensQuestao imagens={l.q.imagens} parte="contexto" />
              {!l.q.texto_confiavel && l.q.imagens.some((i) => i.parte === "enunciado") ? (
                <ImagensQuestao imagens={l.q.imagens} parte="enunciado" />
              ) : (
                <TextoQuestao texto={l.q.enunciado} imagens={l.q.imagens} />
              )}
              <ImagensQuestao imagens={l.q.imagens} parte="figura" />
              {l.q.tipo === "multipla" && l.q.texto_confiavel && (
                <ul className="space-y-1">
                  {l.q.alternativas.map((a) => (
                    <li
                      key={a.letra}
                      className={cn(
                        "rounded px-2 py-1",
                        a.letra === l.q.gabarito && "bg-emerald-50 font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
                        a.letra === l.resposta && a.letra !== l.q.gabarito && "bg-rose-50 text-rose-800 line-through dark:bg-rose-950/40 dark:text-rose-300",
                      )}
                    >
                      ({a.letra}) <TextoQuestao inline texto={a.texto} imagens={l.q.imagens} />
                    </li>
                  ))}
                </ul>
              )}
              {l.q.comentario && (
                <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Comentário</p>
                  <Markdown className="prose-sm">{l.q.comentario}</Markdown>
                </div>
              )}
            </div>
          </details>
        ))}
      </div>
    </>
  );
}
