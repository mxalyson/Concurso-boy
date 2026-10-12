"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Coffee, Pause, Play, Square, Timer } from "lucide-react";
import { salvarSessaoEstudo } from "@/app/actions/estudos";
import { TIPOS_SESSAO, cn } from "@/lib/utils";
import { Botao } from "../ui";

type Modo = "pomodoro" | "livre";
type Fase = "foco" | "pausa";

type Estado = {
  modo: Modo;
  fase: Fase;
  rodando: boolean;
  inicio: number | null; // timestamp quando começou a rodar
  acumulado: number; // ms acumulados antes do último início
};

const CHAVE = "cronometro-estado";

function bip() {
  try {
    const ctx = new AudioContext();
    [0, 0.25, 0.5].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      o.connect(g);
      g.connect(ctx.destination);
      g.gain.setValueAtTime(0.2, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.2);
    });
  } catch {}
}

function formatar(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h > 0 ? `${h}:` : ""}${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function Cronometro({
  disciplinas,
  assuntos,
  disciplinaInicial,
}: {
  disciplinas: { id: number; nome: string }[];
  assuntos: { id: number; disciplina_id: number; caminho: string }[];
  disciplinaInicial?: number;
}) {
  const [estado, setEstado] = useState<Estado>({ modo: "pomodoro", fase: "foco", rodando: false, inicio: null, acumulado: 0 });
  const [agora, setAgora] = useState(Date.now());
  const [focoMin, setFocoMin] = useState(25);
  const [pausaMin, setPausaMin] = useState(5);
  const [disciplina, setDisciplina] = useState<number | "">(disciplinaInicial ?? "");
  const [assunto, setAssunto] = useState<number | "">("");
  const [tipo, setTipo] = useState("teoria");
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [, iniciar] = useTransition();
  const carregado = useRef(false);

  // Restaura o cronômetro se a página for recarregada.
  useEffect(() => {
    try {
      const salvo = localStorage.getItem(CHAVE);
      if (salvo) {
        const dados = JSON.parse(salvo);
        setEstado(dados.estado);
        setFocoMin(dados.focoMin ?? 25);
        setPausaMin(dados.pausaMin ?? 5);
        if (!disciplinaInicial && dados.disciplina) setDisciplina(dados.disciplina);
        if (dados.tipo) setTipo(dados.tipo);
      }
    } catch {}
    carregado.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!carregado.current) return;
    try {
      localStorage.setItem(CHAVE, JSON.stringify({ estado, focoMin, pausaMin, disciplina, tipo }));
    } catch {}
  }, [estado, focoMin, pausaMin, disciplina, tipo]);

  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  const decorrido = estado.acumulado + (estado.rodando && estado.inicio ? agora - estado.inicio : 0);
  const alvo = estado.modo === "pomodoro" ? (estado.fase === "foco" ? focoMin : pausaMin) * 60_000 : null;
  const exibido = alvo ? alvo - decorrido : decorrido;

  const salvar = (ms: number) => {
    const minutos = Math.round(ms / 60_000);
    if (minutos < 1) {
      setMensagem("Sessões com menos de 1 minuto não são registradas.");
      return;
    }
    iniciar(async () => {
      const r = await salvarSessaoEstudo({ disciplinaId: disciplina || null, assuntoId: assunto || null, minutos, tipo });
      setMensagem(r.ok ? `Sessão de ${minutos} min registrada!` : "Não foi possível registrar a sessão.");
    });
  };

  // Fim de um bloco do pomodoro.
  useEffect(() => {
    if (!alvo || !estado.rodando || decorrido < alvo) return;
    bip();
    if (estado.fase === "foco") {
      salvar(alvo);
      setEstado({ ...estado, fase: "pausa", inicio: Date.now(), acumulado: 0 });
    } else {
      setEstado({ ...estado, fase: "foco", rodando: false, inicio: null, acumulado: 0 });
      setMensagem("Pausa encerrada. Pronto para o próximo bloco?");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decorrido, alvo]);

  const alternar = () => {
    setMensagem(null);
    if (estado.rodando) setEstado({ ...estado, rodando: false, inicio: null, acumulado: decorrido });
    else setEstado({ ...estado, rodando: true, inicio: Date.now() });
  };

  const encerrar = () => {
    if (estado.fase === "foco") salvar(decorrido);
    setEstado({ ...estado, fase: "foco", rodando: false, inicio: null, acumulado: 0 });
  };

  const trocarModo = (modo: Modo) => setEstado({ modo, fase: "foco", rodando: false, inicio: null, acumulado: 0 });
  const progresso = alvo ? Math.min(1, decorrido / alvo) : (decorrido % 3_600_000) / 3_600_000;
  const raio = 110;
  const circ = 2 * Math.PI * raio;

  return (
    <div className="cartao p-6">
      <div className="mb-6 flex justify-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
        {(["pomodoro", "livre"] as Modo[]).map((m) => (
          <button
            key={m}
            onClick={() => trocarModo(m)}
            disabled={estado.rodando}
            className={cn("flex-1 rounded-md px-3 py-1.5 text-sm font-medium", estado.modo === m ? "bg-white shadow dark:bg-slate-900" : "text-slate-500")}
          >
            {m === "pomodoro" ? "Pomodoro" : "Cronômetro livre"}
          </button>
        ))}
      </div>

      <div className="relative mx-auto mb-6 h-64 w-64">
        <svg viewBox="0 0 240 240" className="h-full w-full -rotate-90">
          <circle cx="120" cy="120" r={raio} fill="none" strokeWidth="10" className="stroke-slate-200 dark:stroke-slate-800" />
          <circle
            cx="120"
            cy="120"
            r={raio}
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - progresso)}
            className={cn("transition-all", estado.fase === "pausa" ? "stroke-emerald-500" : "stroke-marca-500")}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
            {estado.fase === "pausa" ? <Coffee className="h-3.5 w-3.5" /> : <Timer className="h-3.5 w-3.5" />}
            {estado.fase === "pausa" ? "Pausa" : "Foco"}
          </span>
          <span className="font-mono text-5xl font-bold tabular-nums">{formatar(exibido)}</span>
        </div>
      </div>

      <div className="mb-6 flex justify-center gap-2">
        <Botao tamanho="lg" onClick={alternar}>
          {estado.rodando ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          {estado.rodando ? "Pausar" : decorrido > 0 ? "Continuar" : "Iniciar"}
        </Botao>
        {decorrido > 0 && (
          <Botao tamanho="lg" variante="secundario" onClick={encerrar}>
            <Square className="h-4 w-4" /> {estado.fase === "foco" ? "Encerrar e salvar" : "Pular pausa"}
          </Botao>
        )}
      </div>
      {mensagem && <p className="mb-4 text-center text-sm text-emerald-600">{mensagem}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="rotulo">Disciplina</span>
          <select value={disciplina} onChange={(e) => { setDisciplina(Number(e.target.value) || ""); setAssunto(""); }} className="campo">
            <option value="">Sem disciplina</option>
            {disciplinas.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nome}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="rotulo">Assunto</span>
          <select value={assunto} onChange={(e) => setAssunto(Number(e.target.value) || "")} className="campo" disabled={!disciplina}>
            <option value="">—</option>
            {assuntos
              .filter((a) => a.disciplina_id === disciplina)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.caminho}
                </option>
              ))}
          </select>
        </label>
        <label>
          <span className="rotulo">Atividade</span>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="campo">
            {Object.entries(TIPOS_SESSAO).map(([v, r]) => (
              <option key={v} value={v}>
                {r}
              </option>
            ))}
          </select>
        </label>
        {estado.modo === "pomodoro" && (
          <div className="grid grid-cols-2 gap-2">
            <label>
              <span className="rotulo">Foco (min)</span>
              <input type="number" min={5} max={120} value={focoMin} disabled={estado.rodando} onChange={(e) => setFocoMin(Number(e.target.value) || 25)} className="campo" />
            </label>
            <label>
              <span className="rotulo">Pausa (min)</span>
              <input type="number" min={1} max={60} value={pausaMin} disabled={estado.rodando} onChange={(e) => setPausaMin(Number(e.target.value) || 5)} className="campo" />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
