import { Timer, Trash2 } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { sessoesDeHoje } from "@/lib/estudos";
import { assuntosIndentados, listarAssuntos, listarDisciplinas } from "@/lib/taxonomia";
import { formatarMinutos, TIPOS_SESSAO, dataSqlite } from "@/lib/utils";
import { excluirSessao, registrarSessaoManual } from "@/app/actions/estudos";
import { Cronometro } from "@/components/estudos/cronometro";
import { Botao, CabecalhoPagina, Cartao } from "@/components/ui";

export const metadata = { title: "Cronômetro de estudos" };

export default async function PaginaFoco({ searchParams }: { searchParams: Promise<{ disciplina?: string }> }) {
  const usuario = await exigirUsuario();
  const sp = await searchParams;
  const disciplinas = listarDisciplinas();
  const sessoes = sessoesDeHoje(usuario.id);
  const totalHoje = sessoes.reduce((s, x) => s + x.minutos, 0);

  return (
    <>
      <CabecalhoPagina
        titulo="Cronômetro de estudos"
        descricao="Use a técnica Pomodoro ou o cronômetro livre. O tempo é registrado automaticamente e alimenta o seu ciclo de estudos."
        icone={<Timer className="h-5 w-5" />}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Cronometro disciplinas={disciplinas} assuntos={assuntosIndentados(listarAssuntos())} disciplinaInicial={Number(sp.disciplina) || undefined} />
        <div className="space-y-6">
          <Cartao className="p-5">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-semibold">Hoje</h2>
              <span className="text-2xl font-bold text-marca-600">{formatarMinutos(totalHoje)}</span>
            </div>
            {sessoes.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma sessão registrada hoje.</p>
            ) : (
              <ul className="space-y-2">
                {sessoes.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 text-sm">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.cor ?? "#94a3b8" }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{s.disciplina ?? "Sem disciplina"}</span>
                      <span className="text-xs text-slate-500">
                        {TIPOS_SESSAO[s.tipo as keyof typeof TIPOS_SESSAO] ?? s.tipo}
                        {s.assunto && ` · ${s.assunto}`} · {dataSqlite(s.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </span>
                    <span className="font-medium">{formatarMinutos(s.minutos)}</span>
                    <form action={excluirSessao}>
                      <input type="hidden" name="id" value={s.id} />
                      <button className="p-1 text-slate-400 hover:text-rose-600" title="Excluir">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>
          <Cartao className="p-5">
            <h2 className="mb-3 font-semibold">Registro manual</h2>
            <form action={registrarSessaoManual} className="space-y-2">
              <select name="disciplina" className="campo" defaultValue={sp.disciplina ?? ""}>
                <option value="">Sem disciplina</option>
                {disciplinas.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nome}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <select name="tipo" className="campo">
                  {Object.entries(TIPOS_SESSAO).map(([v, r]) => (
                    <option key={v} value={v}>
                      {r}
                    </option>
                  ))}
                </select>
                <input name="minutos" type="number" min={1} max={720} required placeholder="Minutos" className="campo" />
              </div>
              <input name="observacao" className="campo" placeholder="Observação (opcional)" />
              <Botao type="submit" variante="secundario" className="w-full">
                Registrar
              </Botao>
            </form>
          </Cartao>
        </div>
      </div>
    </>
  );
}
