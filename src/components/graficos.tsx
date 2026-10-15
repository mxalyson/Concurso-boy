import { formatarData, formatarMinutos } from "@/lib/utils";

/** Barras empilhadas de acertos/erros por dia. */
export function GraficoDiario({ dados }: { dados: { dia: string; total: number; acertos: number }[] }) {
  const max = Math.max(5, ...dados.map((d) => d.total));
  const largura = 100 / dados.length;
  return (
    <div>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-40 w-full" role="img" aria-label="Questões por dia">
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2="100" y1={40 - f * 38} y2={40 - f * 38} className="stroke-slate-200 dark:stroke-slate-800" strokeWidth="0.15" />
        ))}
        {dados.map((d, i) => {
          const hT = (d.total / max) * 38;
          const hA = (d.acertos / max) * 38;
          const x = i * largura + largura * 0.15;
          const w = largura * 0.7;
          return (
            <g key={d.dia}>
              <title>{`${formatarData(d.dia)}: ${d.total} questões, ${d.acertos} acertos`}</title>
              <rect x={x} y={40 - hT} width={w} height={hT - hA} className="fill-rose-400/80" rx="0.3" />
              <rect x={x} y={40 - hA} width={w} height={hA} className="fill-emerald-500" rx="0.3" />
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-slate-400">
        <span>{formatarData(dados[0]?.dia).slice(0, 5)}</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-emerald-500" /> acertos
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-rose-400" /> erros
          </span>
        </span>
        <span>hoje</span>
      </div>
    </div>
  );
}

/** Mapa de calor estilo GitHub (colunas = semanas, linhas = dias). */
export function MapaCalor({ dados }: { dados: { dia: string; pontos: number }[] }) {
  const max = Math.max(1, ...dados.map((d) => d.pontos));
  const semanas: (typeof dados)[] = [];
  for (let i = 0; i < dados.length; i += 7) semanas.push(dados.slice(i, i + 7));
  const nivel = (p: number) => (p === 0 ? 0 : Math.min(4, Math.ceil((p / max) * 4)));
  const cores = ["bg-slate-100 dark:bg-slate-800", "bg-marca-200 dark:bg-marca-900", "bg-marca-300 dark:bg-marca-700", "bg-marca-500", "bg-marca-700 dark:bg-marca-400"];
  return (
    <div className="overflow-x-auto">
      <div className="flex gap-[3px]">
        {semanas.map((s, i) => (
          <div key={i} className="flex flex-col gap-[3px]">
            {s.map((d) => (
              <div key={d.dia} title={`${formatarData(d.dia)}: ${Math.round(d.pontos)} pontos de atividade`} className={`h-3 w-3 rounded-[3px] ${cores[nivel(d.pontos)]}`} />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-400">
        menos {cores.map((c, i) => <span key={i} className={`h-2.5 w-2.5 rounded-[2px] ${c}`} />)} mais
      </div>
    </div>
  );
}

/** Rosca com a distribuição do tempo de estudo. */
export function Rosca({ dados }: { dados: { nome: string; cor: string; minutos: number }[] }) {
  const total = dados.reduce((s, d) => s + d.minutos, 0);
  if (!total) return <p className="text-sm text-slate-500">Nenhum tempo de estudo registrado no período.</p>;
  const r = 15.9155;
  let acumulado = 0;
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-36 w-36 shrink-0">
        <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90">
          <circle cx="21" cy="21" r={r} fill="none" strokeWidth="6" className="stroke-slate-100 dark:stroke-slate-800" />
          {dados.map((d) => {
            const fatia = (d.minutos / total) * 100;
            const el = (
              <circle key={d.nome} cx="21" cy="21" r={r} fill="none" stroke={d.cor} strokeWidth="6" strokeDasharray={`${fatia} ${100 - fatia}`} strokeDashoffset={-acumulado}>
                <title>{`${d.nome}: ${formatarMinutos(d.minutos)}`}</title>
              </circle>
            );
            acumulado += fatia;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold">{formatarMinutos(total)}</span>
          <span className="text-[10px] uppercase text-slate-400">total</span>
        </div>
      </div>
      <ul className="w-full space-y-1.5 text-sm">
        {dados.map((d) => (
          <li key={d.nome} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.cor }} />
            <span className="flex-1 truncate">{d.nome}</span>
            <span className="text-slate-500">{formatarMinutos(d.minutos)}</span>
            <span className="w-10 text-right text-xs text-slate-400">{Math.round((d.minutos / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
