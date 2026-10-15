import { Plus, Trash2 } from "lucide-react";
import { arvoreAssuntos, listarAssuntos, listarBancas, listarDisciplinas, listarOrgaos, type AssuntoNo } from "@/lib/taxonomia";
import {
  excluirAssunto,
  excluirDisciplina,
  moverQuestoesDisciplina,
  salvarAssunto,
  salvarBanca,
  salvarDisciplina,
  salvarOrgao,
} from "@/app/actions/admin";
import { Botao, Cartao } from "@/components/ui";

export const metadata = { title: "Disciplinas e assuntos" };

function NoAssunto({ no, nivel }: { no: AssuntoNo; nivel: number }) {
  return (
    <li>
      <div className="group flex items-center gap-2 py-1" style={{ paddingLeft: `${nivel * 1.25}rem` }}>
        <form action={salvarAssunto} className="flex flex-1 items-center gap-1">
          <input type="hidden" name="id" value={no.id} />
          <input name="nome" defaultValue={no.nome} className="flex-1 rounded border border-transparent bg-transparent px-1.5 py-0.5 text-sm hover:border-slate-200 focus:border-marca-400 focus:outline-none dark:hover:border-slate-700" />
          <span className="text-xs text-slate-400">{no.totalComFilhos}q</span>
        </form>
        <details className="relative">
          <summary className="cursor-pointer list-none rounded p-1 text-slate-400 opacity-0 hover:text-marca-600 group-hover:opacity-100" title="Adicionar subtópico">
            <Plus className="h-3.5 w-3.5" />
          </summary>
          <form action={salvarAssunto} className="cartao absolute right-0 z-10 mt-1 flex w-64 gap-1 p-2">
            <input type="hidden" name="disciplina" value={no.disciplina_id} />
            <input type="hidden" name="pai" value={no.id} />
            <input name="nome" required className="campo py-1 text-xs" placeholder="Subtópico" />
            <Botao tamanho="sm">OK</Botao>
          </form>
        </details>
        <form action={excluirAssunto}>
          <input type="hidden" name="id" value={no.id} />
          <button className="rounded p-1 text-slate-400 opacity-0 hover:text-rose-600 group-hover:opacity-100" title="Excluir (as questões ficam sem assunto)">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </form>
      </div>
      {no.filhos.length > 0 && (
        <ul>
          {no.filhos.map((f) => (
            <NoAssunto key={f.id} no={f} nivel={nivel + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function Taxonomia() {
  const disciplinas = listarDisciplinas();
  const assuntos = listarAssuntos();
  const bancas = listarBancas();
  const orgaos = listarOrgaos();
  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-semibold">Disciplinas</h2>
          <form action={salvarDisciplina} className="flex gap-2">
            <input name="nome" required className="campo w-64" placeholder="Nova disciplina" />
            <input name="cor" type="color" defaultValue="#6366f1" className="h-10 w-12 cursor-pointer rounded border border-slate-300 dark:border-slate-700" />
            <Botao>
              <Plus className="h-4 w-4" /> Adicionar
            </Botao>
          </form>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {disciplinas.map((d) => (
            <Cartao key={d.id} className="p-4">
              <div className="mb-2 flex items-center gap-2">
                <form action={salvarDisciplina} className="flex flex-1 items-center gap-2">
                  <input type="hidden" name="id" value={d.id} />
                  <input name="cor" type="color" defaultValue={d.cor} className="h-7 w-8 cursor-pointer rounded border-0 bg-transparent" />
                  <input name="nome" defaultValue={d.nome} className="flex-1 rounded border border-transparent bg-transparent px-1.5 py-0.5 font-semibold hover:border-slate-200 focus:border-marca-400 focus:outline-none dark:hover:border-slate-700" />
                  <Botao variante="fantasma" tamanho="sm">
                    Salvar
                  </Botao>
                </form>
                <span className="text-xs text-slate-500">{d.total} questões</span>
                {d.total === 0 ? (
                  <form action={excluirDisciplina}>
                    <input type="hidden" name="id" value={d.id} />
                    <button className="rounded p-1 text-slate-400 hover:text-rose-600" title="Excluir disciplina">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </form>
                ) : (
                  <details className="relative">
                    <summary className="cursor-pointer list-none text-xs text-slate-400 hover:text-marca-600">Mesclar</summary>
                    <form action={moverQuestoesDisciplina} className="cartao absolute right-0 z-10 mt-1 w-64 space-y-2 p-3 text-xs">
                      <input type="hidden" name="origem" value={d.id} />
                      <p>Mover questões, assuntos e resumos para:</p>
                      <select name="destino" className="campo py-1 text-xs">
                        {disciplinas
                          .filter((x) => x.id !== d.id)
                          .map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.nome}
                            </option>
                          ))}
                      </select>
                      <Botao tamanho="sm" variante="perigo">
                        Mesclar e excluir “{d.nome}”
                      </Botao>
                    </form>
                  </details>
                )}
              </div>
              <ul>
                {arvoreAssuntos(assuntos.filter((a) => a.disciplina_id === d.id)).map((no) => (
                  <NoAssunto key={no.id} no={no} nivel={0} />
                ))}
              </ul>
              <form action={salvarAssunto} className="mt-2 flex gap-1">
                <input type="hidden" name="disciplina" value={d.id} />
                <input name="nome" required className="campo py-1 text-xs" placeholder="Novo assunto" />
                <Botao tamanho="sm" variante="secundario">
                  <Plus className="h-3.5 w-3.5" />
                </Botao>
              </form>
            </Cartao>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Cartao className="p-4">
          <h2 className="mb-3 font-semibold">Bancas</h2>
          {bancas.length === 0 && <p className="text-sm text-slate-500">As bancas são criadas na importação.</p>}
          <ul className="space-y-1">
            {bancas.map((b) => (
              <li key={b.id}>
                <form action={salvarBanca} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={b.id} />
                  <input name="sigla" defaultValue={b.sigla} className="campo w-28 py-1 text-xs" />
                  <input name="nome" defaultValue={b.nome} className="campo py-1 text-xs" />
                  <span className="w-12 text-right text-xs text-slate-400">{b.total}q</span>
                  <Botao variante="fantasma" tamanho="sm">
                    Salvar
                  </Botao>
                </form>
              </li>
            ))}
          </ul>
        </Cartao>
        <Cartao className="p-4">
          <h2 className="mb-3 font-semibold">Órgãos</h2>
          {orgaos.length === 0 && <p className="text-sm text-slate-500">Os órgãos são criados na importação.</p>}
          <ul className="space-y-1">
            {orgaos.map((o) => (
              <li key={o.id}>
                <form action={salvarOrgao} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={o.id} />
                  <input name="sigla" defaultValue={o.sigla} className="campo w-24 py-1 text-xs" />
                  <input name="nome" defaultValue={o.nome} className="campo flex-1 py-1 text-xs" />
                  <select name="esfera" defaultValue={o.esfera ?? ""} className="campo w-28 py-1 text-xs">
                    <option value="">Esfera</option>
                    <option value="federal">Federal</option>
                    <option value="estadual">Estadual</option>
                    <option value="municipal">Municipal</option>
                  </select>
                  <input name="uf" defaultValue={o.uf ?? ""} maxLength={2} placeholder="UF" className="campo w-14 py-1 text-xs" />
                  <Botao variante="fantasma" tamanho="sm">
                    Salvar
                  </Botao>
                </form>
              </li>
            ))}
          </ul>
        </Cartao>
      </section>
    </div>
  );
}
