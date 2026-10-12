"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  AlertTriangle,
  BarChart2,
  BookmarkPlus,
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  Flag,
  Layers,
  MessageSquare,
  NotebookPen,
  Scissors,
  Sparkles,
  Star,
  Trash2,
  X,
} from "lucide-react";
import {
  alternarCaderno,
  alternarFavorito,
  carregarExtras,
  comentar,
  criarCadernoComQuestao,
  criarFlashcardDaQuestao,
  excluirComentario,
  gerarComentarioComIA,
  reportarQuestao,
  responderQuestao,
  revelarGabarito,
  salvarAnotacao,
  type ExtrasQuestao,
} from "@/app/actions/questoes";
import type { EstatisticasQuestao, QuestaoResumo } from "@/lib/questoes";
import { cn, pct, tempoRelativo, DIFICULDADES } from "@/lib/utils";
import { Markdown } from "../markdown";
import { Botao, Selo } from "../ui";
import { ImagensQuestao } from "./imagens-questao";
import { TextoQuestao } from "./texto-questao";
import { semMarcadores } from "@/lib/marcadores";

type Aba = "comentario" | "estatisticas" | "forum" | "anotacao" | "caderno" | "flashcard" | "reportar";

type Resultado = {
  correta: boolean | null; // null quando o gabarito foi apenas revelado
  gabarito: string | null;
  comentario: string | null;
  estatisticas: EstatisticasQuestao;
};

export function CartaoQuestao({ questao, indice }: { questao: QuestaoResumo; indice?: number }) {
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [eliminadas, setEliminadas] = useState<Set<string>>(new Set());
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<Aba | null>(null);
  const [extras, setExtras] = useState<ExtrasQuestao | null>(null);
  const [favorita, setFavorita] = useState(questao.favorita);
  const [textoBaseAberto, setTextoBaseAberto] = useState((questao.texto_base?.length ?? 0) < 700);
  const temContexto = questao.imagens.some((i) => i.parte === "contexto");
  const contextoSubstitui = questao.imagens.some((i) => i.parte === "contexto" && i.substitui);
  const enunciadoEmImagem = !questao.texto_confiavel && questao.imagens.some((i) => i.parte === "enunciado");
  const [pendente, iniciar] = useTransition();
  const inicio = useRef(Date.now());

  const opcoes =
    questao.tipo === "certo_errado"
      ? [
          { letra: "C", texto: "Certo" },
          { letra: "E", texto: "Errado" },
        ]
      : enunciadoEmImagem
        ? questao.alternativas.map((a) => ({ letra: a.letra, texto: `Alternativa ${a.letra}` }))
        : questao.alternativas;

  const garantirExtras = async () => {
    if (!extras) setExtras(await carregarExtras(questao.id));
  };

  const abrirAba = (nova: Aba) => {
    setAba(aba === nova ? null : nova);
    if (["forum", "anotacao", "caderno", "flashcard"].includes(nova)) void garantirExtras();
    if ((nova === "comentario" || nova === "estatisticas") && !resultado) {
      iniciar(async () => {
        const r = await revelarGabarito(questao.id);
        if (r) setResultado({ correta: null, ...r });
      });
    }
  };

  const responder = () => {
    if (!selecionada) return;
    setErro(null);
    iniciar(async () => {
      const r = await responderQuestao(questao.id, selecionada, (Date.now() - inicio.current) / 1000);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setResultado({ correta: r.correta, gabarito: r.gabarito, comentario: r.comentario, estatisticas: r.estatisticas });
      if (r.comentario) setAba("comentario");
    });
  };

  const refazer = () => {
    setResultado(null);
    setSelecionada(null);
    setEliminadas(new Set());
    setAba(null);
    inicio.current = Date.now();
  };

  const eliminar = (letra: string) => {
    const nova = new Set(eliminadas);
    if (nova.has(letra)) nova.delete(letra);
    else nova.add(letra);
    setEliminadas(nova);
    if (selecionada === letra) setSelecionada(null);
  };

  const respondida = resultado?.correta !== undefined && resultado?.correta !== null;

  return (
    <article className="cartao overflow-hidden">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-100 bg-slate-50/60 px-4 py-2.5 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
        <Link href={`/questoes/${questao.id}`} className="font-mono font-semibold text-slate-700 hover:text-marca-600 dark:text-slate-300">
          {indice !== undefined ? `${indice}.` : ""} Q{questao.id}
        </Link>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: questao.disciplina_cor }} />
          <Link href={`/questoes?d=${questao.disciplina_id}`} className="font-medium text-slate-700 hover:underline dark:text-slate-300">
            {questao.disciplina_nome}
          </Link>
          {questao.assunto_nome && (
            <>
              <span>›</span>
              <Link href={`/questoes?a=${questao.assunto_id}`} className="hover:underline">
                {questao.assunto_nome}
              </Link>
            </>
          )}
        </span>
        <span className="ml-auto flex items-center gap-2">
          {questao.tentativas > 0 && (
            <span title="Seu histórico nesta questão">
              {questao.ultima_correta ? (
                <Selo cor="verde">
                  <Check className="h-3 w-3" /> {questao.acertos}/{questao.tentativas}
                </Selo>
              ) : (
                <Selo cor="vermelho">
                  <X className="h-3 w-3" /> {questao.acertos}/{questao.tentativas}
                </Selo>
              )}
            </span>
          )}
          <button
            onClick={() => iniciar(async () => setFavorita(await alternarFavorito(questao.id)))}
            className={cn("rounded p-1 hover:bg-slate-200 dark:hover:bg-slate-800", favorita ? "text-amber-500" : "text-slate-400")}
            title={favorita ? "Remover dos favoritos" : "Favoritar"}
          >
            <Star className="h-4 w-4" fill={favorita ? "currentColor" : "none"} />
          </button>
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5 px-4 pt-3">
        {questao.banca && <Selo cor="marca">{questao.banca}</Selo>}
        {questao.ano && <Selo>{questao.ano}</Selo>}
        {questao.orgao && <Selo title={questao.orgao_nome ?? undefined}>{questao.orgao}</Selo>}
        {questao.cargo && <Selo>{questao.cargo}</Selo>}
        {questao.dificuldade && <Selo cor="azul">{DIFICULDADES[questao.dificuldade as 1 | 2 | 3]}</Selo>}
        {questao.anulada && (
          <Selo cor="amarelo">
            <AlertTriangle className="h-3 w-3" /> Anulada
          </Selo>
        )}
        {questao.desatualizada && (
          <Selo cor="amarelo">
            <AlertTriangle className="h-3 w-3" /> Desatualizada
          </Selo>
        )}
        {questao.fonte && <Selo className="max-w-full truncate">{questao.fonte}</Selo>}
        {questao.outras_provas && (
          <Selo title={`Também aplicada em: ${questao.outras_provas.split(" | ").join("; ")}`}>
            + {questao.outras_provas.split(" | ").length} {questao.outras_provas.includes(" | ") ? "provas" : "prova"}
          </Selo>
        )}
      </div>

      {/* Corpo */}
      <div className="space-y-4 px-4 py-4">
        {(questao.texto_base || temContexto) && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50">
            <button
              onClick={() => setTextoBaseAberto(!textoBaseAberto)}
              className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Texto associado {textoBaseAberto ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {textoBaseAberto && (
              <div className="space-y-3 px-3 pb-3">
                {questao.texto_base && !contextoSubstitui && (
                  <TextoQuestao texto={questao.texto_base} imagens={questao.imagens} className="text-sm text-slate-700 dark:text-slate-300" />
                )}
                <ImagensQuestao imagens={questao.imagens} parte="contexto" titulo="Recorte da prova original (figuras e tabelas)" />
              </div>
            )}
          </div>
        )}
        {enunciadoEmImagem ? (
          <ImagensQuestao imagens={questao.imagens} parte="enunciado" titulo="Enunciado conforme a prova original" />
        ) : (
          <TextoQuestao texto={questao.enunciado} imagens={questao.imagens} className="text-[15px] text-slate-900 dark:text-slate-100" />
        )}
        <ImagensQuestao imagens={questao.imagens} parte="figura" />

        <div className={cn(questao.tipo === "certo_errado" ? "flex flex-wrap gap-2" : "space-y-2")}>
          {opcoes.map((alt) => {
            const ehGabarito = resultado?.gabarito === alt.letra;
            const ehEscolha = selecionada === alt.letra;
            const eliminada = eliminadas.has(alt.letra);
            const bloqueado = respondida;
            const estado = resultado?.gabarito
              ? ehGabarito
                ? "certa"
                : ehEscolha && respondida
                  ? "errada"
                  : "neutra"
              : ehEscolha
                ? "escolhida"
                : "neutra";
            if (questao.tipo === "certo_errado") {
              return (
                <button
                  key={alt.letra}
                  disabled={bloqueado}
                  onClick={() => setSelecionada(alt.letra)}
                  className={cn(
                    "flex min-w-32 items-center justify-center gap-2 rounded-lg border-2 px-5 py-2.5 text-sm font-semibold transition",
                    estado === "certa" && "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
                    estado === "errada" && "border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
                    estado === "escolhida" && "border-marca-500 bg-marca-50 text-marca-700 dark:bg-marca-950/40 dark:text-marca-300",
                    estado === "neutra" && "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600",
                  )}
                >
                  {alt.letra === "C" ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />} {alt.texto}
                </button>
              );
            }
            return (
              <div key={alt.letra} className="group flex items-start gap-2">
                <button
                  disabled={bloqueado}
                  onClick={() => !eliminada && setSelecionada(alt.letra)}
                  className={cn(
                    "flex flex-1 items-start gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition",
                    estado === "certa" && "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40",
                    estado === "errada" && "border-rose-500 bg-rose-50 dark:bg-rose-950/40",
                    estado === "escolhida" && "border-marca-500 bg-marca-50 ring-1 ring-marca-500 dark:bg-marca-950/40",
                    estado === "neutra" && "border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                      estado === "certa" && "border-emerald-500 bg-emerald-500 text-white",
                      estado === "errada" && "border-rose-500 bg-rose-500 text-white",
                      estado === "escolhida" && "border-marca-500 bg-marca-500 text-white",
                      estado === "neutra" && "border-slate-300 text-slate-500 dark:border-slate-600",
                    )}
                  >
                    {alt.letra}
                  </span>
                  <TextoQuestao inline texto={alt.texto} imagens={questao.imagens} className={cn("pt-0.5", eliminada && "text-slate-400 line-through")} />
                </button>
                {!bloqueado && (
                  <button
                    onClick={() => eliminar(alt.letra)}
                    className="mt-2 rounded p-1 text-slate-300 opacity-60 hover:bg-slate-100 hover:text-slate-600 group-hover:opacity-100 dark:hover:bg-slate-800"
                    title="Riscar alternativa"
                  >
                    <Scissors className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {erro && <p className="text-sm text-rose-600">{erro}</p>}

        {respondida && (
          <div
            className={cn(
              "flex flex-wrap items-center justify-between gap-2 rounded-lg px-4 py-3 text-sm font-medium",
              resultado.correta
                ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
            )}
          >
            <span>
              {resultado.correta ? "Parabéns! Você acertou." : `Você errou. Gabarito: ${rotuloGabarito(resultado.gabarito, questao.tipo)}.`}
              {resultado.estatisticas.total > 0 &&
                ` ${pct(resultado.estatisticas.acertos, resultado.estatisticas.total)}% dos alunos acertaram.`}
            </span>
            <button onClick={refazer} className="text-xs underline">
              Resolver novamente
            </button>
          </div>
        )}
        {resultado && resultado.correta === null && resultado.gabarito && (
          <div className="rounded-lg bg-slate-100 px-4 py-3 text-sm dark:bg-slate-800">
            Gabarito: <strong>{rotuloGabarito(resultado.gabarito, questao.tipo)}</strong>
          </div>
        )}
      </div>

      {/* Rodapé com ações */}
      <div className="flex flex-wrap items-center gap-1 border-t border-slate-100 px-3 py-2 dark:border-slate-800">
        {!respondida && (
          <Botao tamanho="sm" onClick={responder} disabled={!selecionada || pendente} className="mr-2">
            {pendente ? "Enviando..." : "Responder"}
          </Botao>
        )}
        <BotaoAba ativo={aba === "comentario"} onClick={() => abrirAba("comentario")} icone={resultado ? <MessageSquare className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}>
          {resultado ? "Comentário" : "Ver gabarito"}
        </BotaoAba>
        <BotaoAba ativo={aba === "estatisticas"} onClick={() => abrirAba("estatisticas")} icone={<BarChart2 className="h-3.5 w-3.5" />}>
          Estatísticas
        </BotaoAba>
        <BotaoAba ativo={aba === "forum"} onClick={() => abrirAba("forum")} icone={<MessageSquare className="h-3.5 w-3.5" />}>
          Fórum{extras?.comentarios.length ? ` (${extras.comentarios.length})` : ""}
        </BotaoAba>
        <BotaoAba ativo={aba === "anotacao"} onClick={() => abrirAba("anotacao")} icone={<NotebookPen className="h-3.5 w-3.5" />}>
          Anotações
        </BotaoAba>
        <BotaoAba ativo={aba === "caderno"} onClick={() => abrirAba("caderno")} icone={<BookmarkPlus className="h-3.5 w-3.5" />}>
          Caderno
        </BotaoAba>
        <BotaoAba ativo={aba === "flashcard"} onClick={() => abrirAba("flashcard")} icone={<Layers className="h-3.5 w-3.5" />}>
          Flashcard
        </BotaoAba>
        <BotaoAba ativo={aba === "reportar"} onClick={() => abrirAba("reportar")} icone={<Flag className="h-3.5 w-3.5" />}>
          Reportar
        </BotaoAba>
      </div>

      {aba && (
        <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/30">
          {aba === "comentario" && (
            <AbaComentario resultado={resultado} questaoId={questao.id} admin={extras?.admin && extras.ia} onAdmin={garantirExtras} onNovo={(c) => resultado && setResultado({ ...resultado, comentario: c })} />
          )}
          {aba === "estatisticas" && <AbaEstatisticas resultado={resultado} tipo={questao.tipo} />}
          {aba === "forum" && <AbaForum questaoId={questao.id} extras={extras} recarregar={async () => setExtras(await carregarExtras(questao.id))} />}
          {aba === "anotacao" && <AbaAnotacao questaoId={questao.id} extras={extras} />}
          {aba === "caderno" && <AbaCaderno questaoId={questao.id} extras={extras} setExtras={setExtras} />}
          {aba === "flashcard" && <AbaFlashcard questao={questao} extras={extras} gabarito={resultado?.gabarito ?? null} />}
          {aba === "reportar" && <AbaReportar questaoId={questao.id} />}
        </div>
      )}
    </article>
  );
}

function rotuloGabarito(g: string | null, tipo: QuestaoResumo["tipo"]) {
  if (!g) return "—";
  if (tipo === "certo_errado") return g === "C" ? "Certo" : "Errado";
  return g;
}

function BotaoAba({ ativo, onClick, icone, children }: { ativo: boolean; onClick: () => void; icone: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition",
        ativo ? "bg-marca-50 text-marca-700 dark:bg-marca-900/40 dark:text-marca-300" : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800",
      )}
    >
      {icone}
      {children}
    </button>
  );
}

function Carregando() {
  return <p className="text-sm text-slate-500">Carregando...</p>;
}

function AbaComentario({
  resultado,
  questaoId,
  admin,
  onAdmin,
  onNovo,
}: {
  resultado: Resultado | null;
  questaoId: number;
  admin?: boolean;
  onAdmin: () => void;
  onNovo: (c: string) => void;
}) {
  const [gerando, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    onAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!resultado) return <Carregando />;
  return (
    <div className="space-y-3">
      {resultado.comentario ? (
        <Markdown className="prose-sm">{resultado.comentario}</Markdown>
      ) : (
        <p className="text-sm text-slate-500">Esta questão ainda não tem comentário. Veja o fórum para discutir com outros alunos.</p>
      )}
      {admin && (
        <div className="flex items-center gap-2">
          <Botao
            variante="secundario"
            tamanho="sm"
            disabled={gerando}
            onClick={() =>
              iniciar(async () => {
                setErro(null);
                const r = await gerarComentarioComIA(questaoId);
                if (r.ok) onNovo(r.comentario);
                else setErro(r.erro);
              })
            }
          >
            <Sparkles className="h-3.5 w-3.5" /> {gerando ? "Gerando..." : resultado.comentario ? "Refazer comentário com IA" : "Gerar comentário com IA"}
          </Botao>
          {erro && <span className="text-xs text-rose-600">{erro}</span>}
        </div>
      )}
    </div>
  );
}

function AbaEstatisticas({ resultado, tipo }: { resultado: Resultado | null; tipo: QuestaoResumo["tipo"] }) {
  if (!resultado) return <Carregando />;
  const { total, acertos, distribuicao } = resultado.estatisticas;
  if (!total) return <p className="text-sm text-slate-500">Ninguém respondeu esta questão ainda.</p>;
  return (
    <div className="space-y-3 text-sm">
      <p>
        <strong>{total}</strong> resoluções · <strong className="text-emerald-600">{pct(acertos, total)}%</strong> de acerto
      </p>
      <div className="space-y-1.5">
        {distribuicao.map((d) => (
          <div key={d.resposta} className="flex items-center gap-2">
            <span className="w-14 font-mono text-xs">{rotuloGabarito(d.resposta, tipo)}</span>
            <div className="h-5 flex-1 overflow-hidden rounded bg-slate-200 dark:bg-slate-800">
              <div
                className={cn("h-full", d.resposta === resultado.gabarito ? "bg-emerald-500" : "bg-slate-400 dark:bg-slate-600")}
                style={{ width: `${pct(d.n, total)}%` }}
              />
            </div>
            <span className="w-10 text-right text-xs text-slate-500">{pct(d.n, total)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AbaForum({ questaoId, extras, recarregar }: { questaoId: number; extras: ExtrasQuestao | null; recarregar: () => Promise<void> }) {
  const [texto, setTexto] = useState("");
  const [pendente, iniciar] = useTransition();
  if (!extras) return <Carregando />;
  return (
    <div className="space-y-3">
      {extras.comentarios.length === 0 && <p className="text-sm text-slate-500">Seja o primeiro a comentar esta questão.</p>}
      <ul className="space-y-2">
        {extras.comentarios.map((c) => (
          <li key={c.id} className="rounded-lg bg-white p-3 text-sm shadow-sm dark:bg-slate-900">
            <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold text-slate-700 dark:text-slate-300">{c.autor}</span>
              <span className="flex items-center gap-2">
                {tempoRelativo(c.criado_em)}
                {c.meu && (
                  <button onClick={() => iniciar(async () => { await excluirComentario(c.id); await recarregar(); })} title="Excluir">
                    <Trash2 className="h-3.5 w-3.5 hover:text-rose-600" />
                  </button>
                )}
              </span>
            </div>
            <p className="whitespace-pre-line">{c.texto}</p>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={2} className="campo" placeholder="Compartilhe sua dúvida ou explicação..." />
        <Botao
          tamanho="sm"
          disabled={pendente || texto.trim().length < 2}
          onClick={() =>
            iniciar(async () => {
              await comentar(questaoId, texto);
              setTexto("");
              await recarregar();
            })
          }
        >
          Enviar
        </Botao>
      </div>
    </div>
  );
}

function AbaAnotacao({ questaoId, extras }: { questaoId: number; extras: ExtrasQuestao | null }) {
  const [texto, setTexto] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [pendente, iniciar] = useTransition();
  if (!extras) return <Carregando />;
  const valor = texto ?? extras.anotacao;
  return (
    <div className="space-y-2">
      <textarea
        value={valor}
        onChange={(e) => {
          setTexto(e.target.value);
          setSalvo(false);
        }}
        rows={4}
        className="campo"
        placeholder="Suas anotações pessoais sobre esta questão (só você vê)."
      />
      <div className="flex items-center gap-2">
        <Botao
          tamanho="sm"
          disabled={pendente}
          onClick={() =>
            iniciar(async () => {
              await salvarAnotacao(questaoId, valor);
              extras.anotacao = valor;
              setSalvo(true);
            })
          }
        >
          Salvar anotação
        </Botao>
        {salvo && <span className="text-xs text-emerald-600">Salvo!</span>}
      </div>
    </div>
  );
}

function AbaCaderno({ questaoId, extras, setExtras }: { questaoId: number; extras: ExtrasQuestao | null; setExtras: (e: ExtrasQuestao) => void }) {
  const [nome, setNome] = useState("");
  const [pendente, iniciar] = useTransition();
  if (!extras) return <Carregando />;
  return (
    <div className="space-y-3 text-sm">
      {extras.cadernos.length > 0 && (
        <ul className="space-y-1">
          {extras.cadernos.map((c) => (
            <li key={c.id}>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={c.contem}
                  disabled={pendente}
                  onChange={() =>
                    iniciar(async () => {
                      const contem = await alternarCaderno(questaoId, c.id);
                      setExtras({ ...extras, cadernos: extras.cadernos.map((x) => (x.id === c.id ? { ...x, contem } : x)) });
                    })
                  }
                  className="h-4 w-4 accent-marca-600"
                />
                {c.nome}
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input value={nome} onChange={(e) => setNome(e.target.value)} className="campo" placeholder="Novo caderno (ex.: Revisar véspera)" />
        <Botao
          tamanho="sm"
          variante="secundario"
          disabled={pendente || !nome.trim()}
          onClick={() =>
            iniciar(async () => {
              const novo = await criarCadernoComQuestao(questaoId, nome);
              if (novo) setExtras({ ...extras, cadernos: [...extras.cadernos, novo] });
              setNome("");
            })
          }
        >
          Criar e adicionar
        </Botao>
      </div>
    </div>
  );
}

function AbaFlashcard({ questao, extras, gabarito }: { questao: QuestaoResumo; extras: ExtrasQuestao | null; gabarito: string | null }) {
  const [frente, setFrente] = useState(semMarcadores(questao.enunciado).slice(0, 400));
  const [verso, setVerso] = useState(gabarito ? `Gabarito: ${rotuloGabarito(gabarito, questao.tipo)}` : "");
  const [deck, setDeck] = useState<string>("");
  const [novoDeck, setNovoDeck] = useState(questao.disciplina_nome);
  const [msg, setMsg] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  if (!extras) return <Carregando />;
  const deckEscolhido = deck || (extras.decks[0] ? String(extras.decks[0].id) : "novo");
  return (
    <div className="grid gap-3 text-sm sm:grid-cols-2">
      <label>
        <span className="rotulo">Frente (pergunta)</span>
        <textarea value={frente} onChange={(e) => setFrente(e.target.value)} rows={4} className="campo" />
      </label>
      <label>
        <span className="rotulo">Verso (resposta)</span>
        <textarea value={verso} onChange={(e) => setVerso(e.target.value)} rows={4} className="campo" placeholder="O conceito-chave que você quer memorizar" />
      </label>
      <div className="flex flex-wrap items-end gap-2 sm:col-span-2">
        <label className="min-w-48 flex-1">
          <span className="rotulo">Baralho</span>
          <select value={deckEscolhido} onChange={(e) => setDeck(e.target.value)} className="campo">
            {extras.decks.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nome}
              </option>
            ))}
            <option value="novo">+ Novo baralho</option>
          </select>
        </label>
        {deckEscolhido === "novo" && <input value={novoDeck} onChange={(e) => setNovoDeck(e.target.value)} className="campo max-w-56" placeholder="Nome do baralho" />}
        <Botao
          tamanho="md"
          disabled={pendente}
          onClick={() =>
            iniciar(async () => {
              const r = await criarFlashcardDaQuestao(questao.id, deckEscolhido === "novo" ? novoDeck : Number(deckEscolhido), frente, verso);
              setMsg(r.ok ? "Flashcard criado!" : r.erro);
            })
          }
        >
          Criar flashcard
        </Botao>
        {msg && <span className="text-xs text-emerald-600">{msg}</span>}
      </div>
    </div>
  );
}

const MOTIVOS = ["Gabarito errado", "Enunciado com erro", "Classificação errada", "Questão desatualizada", "Questão duplicada", "Outro"];

function AbaReportar({ questaoId }: { questaoId: number }) {
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  const [detalhes, setDetalhes] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [pendente, iniciar] = useTransition();
  if (enviado) return <p className="text-sm text-emerald-600">Obrigado! Sua notificação foi enviada para revisão.</p>;
  return (
    <div className="space-y-2 text-sm">
      <select value={motivo} onChange={(e) => setMotivo(e.target.value)} className="campo max-w-xs">
        {MOTIVOS.map((m) => (
          <option key={m}>{m}</option>
        ))}
      </select>
      <textarea value={detalhes} onChange={(e) => setDetalhes(e.target.value)} rows={3} className="campo" placeholder="Descreva o problema (opcional)" />
      <Botao tamanho="sm" variante="secundario" disabled={pendente} onClick={() => iniciar(async () => { await reportarQuestao(questaoId, motivo, detalhes); setEnviado(true); })}>
        Enviar notificação
      </Botao>
    </div>
  );
}
