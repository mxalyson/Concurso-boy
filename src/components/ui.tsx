import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variante = "primario" | "secundario" | "fantasma" | "perigo" | "sucesso";
type Tamanho = "sm" | "md" | "lg";

const VARIANTES: Record<Variante, string> = {
  primario: "bg-marca-600 text-white hover:bg-marca-700 shadow-sm disabled:bg-marca-400",
  secundario:
    "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800",
  fantasma: "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
  perigo: "bg-rose-600 text-white hover:bg-rose-700 shadow-sm",
  sucesso: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm",
};

const TAMANHOS: Record<Tamanho, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

export function classesBotao(variante: Variante = "primario", tamanho: Tamanho = "md", extra?: string) {
  return cn(
    "inline-flex items-center justify-center rounded-lg font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-500/40 disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap",
    VARIANTES[variante],
    TAMANHOS[tamanho],
    extra,
  );
}

export function Botao({
  variante = "primario",
  tamanho = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variante?: Variante; tamanho?: Tamanho }) {
  return <button className={classesBotao(variante, tamanho, className)} {...props} />;
}

export function LinkBotao({
  variante = "primario",
  tamanho = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variante?: Variante; tamanho?: Tamanho }) {
  return <Link className={classesBotao(variante, tamanho, className)} {...props} />;
}

export function Cartao({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("cartao", className)} {...props} />;
}

export function CabecalhoPagina({
  titulo,
  descricao,
  acoes,
  icone,
}: {
  titulo: string;
  descricao?: ReactNode;
  acoes?: ReactNode;
  icone?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-start gap-3">
        {icone && (
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-marca-100 text-marca-700 dark:bg-marca-900/40 dark:text-marca-300">
            {icone}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{titulo}</h1>
          {descricao && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{descricao}</p>}
        </div>
      </div>
      {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
    </div>
  );
}

const CORES_SELO = {
  cinza: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  marca: "bg-marca-100 text-marca-700 dark:bg-marca-900/50 dark:text-marca-300",
  verde: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  vermelho: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  amarelo: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  azul: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
};

export function Selo({
  cor = "cinza",
  className,
  ...props
}: ComponentProps<"span"> & { cor?: keyof typeof CORES_SELO }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium", CORES_SELO[cor], className)}
      {...props}
    />
  );
}

export function BarraProgresso({ valor, cor, className }: { valor: number; cor?: string; className?: string }) {
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800", className)}>
      <div
        className="h-full rounded-full bg-marca-500 transition-all"
        style={{ width: `${Math.max(0, Math.min(100, valor))}%`, ...(cor ? { backgroundColor: cor } : {}) }}
      />
    </div>
  );
}

export function Estatistica({
  rotulo,
  valor,
  detalhe,
  icone,
  className,
}: {
  rotulo: string;
  valor: ReactNode;
  detalhe?: ReactNode;
  icone?: ReactNode;
  className?: string;
}) {
  return (
    <Cartao className={cn("p-4", className)}>
      <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
        <span>{rotulo}</span>
        {icone && <span className="text-slate-400">{icone}</span>}
      </div>
      <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{valor}</div>
      {detalhe && <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{detalhe}</div>}
    </Cartao>
  );
}

export function Vazio({ titulo, descricao, acao, icone }: { titulo: string; descricao?: ReactNode; acao?: ReactNode; icone?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 px-6 py-12 text-center dark:border-slate-700">
      {icone && <div className="mb-3 text-slate-400">{icone}</div>}
      <h3 className="font-semibold text-slate-800 dark:text-slate-200">{titulo}</h3>
      {descricao && <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">{descricao}</p>}
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  );
}

export function Campo({ rotulo, dica, children, className }: { rotulo: string; dica?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="rotulo">{rotulo}</span>
      {children}
      {dica && <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{dica}</span>}
    </label>
  );
}

export function Alerta({ tipo = "info", children }: { tipo?: "info" | "erro" | "sucesso" | "aviso"; children: ReactNode }) {
  const cores = {
    info: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-200",
    erro: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200",
    sucesso: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200",
    aviso: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
  };
  return <div className={cn("rounded-lg border px-4 py-3 text-sm", cores[tipo])}>{children}</div>;
}

export function PontoCor({ cor, className }: { cor: string; className?: string }) {
  return <span className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-full", className)} style={{ backgroundColor: cor }} />;
}
