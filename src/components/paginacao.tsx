import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Paginacao({ total, pagina, porPagina, href }: { total: number; pagina: number; porPagina: number; href: (p: number) => string }) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  if (paginas <= 1) return null;
  const janela = new Set([1, paginas, pagina - 2, pagina - 1, pagina, pagina + 1, pagina + 2].filter((p) => p >= 1 && p <= paginas));
  const lista = [...janela].sort((a, b) => a - b);
  const item = "flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-medium";
  return (
    <nav className="mt-6 flex flex-wrap items-center justify-center gap-1" aria-label="Paginação">
      {pagina > 1 && (
        <Link href={href(pagina - 1)} className={cn(item, "hover:bg-slate-100 dark:hover:bg-slate-800")} aria-label="Anterior">
          <ChevronLeft className="h-4 w-4" />
        </Link>
      )}
      {lista.map((p, i) => (
        <span key={p} className="flex items-center gap-1">
          {i > 0 && lista[i - 1] !== p - 1 && <span className="px-1 text-slate-400">…</span>}
          <Link
            href={href(p)}
            className={cn(item, p === pagina ? "bg-marca-600 text-white" : "hover:bg-slate-100 dark:hover:bg-slate-800")}
            aria-current={p === pagina ? "page" : undefined}
          >
            {p}
          </Link>
        </span>
      ))}
      {pagina < paginas && (
        <Link href={href(pagina + 1)} className={cn(item, "hover:bg-slate-100 dark:hover:bg-slate-800")} aria-label="Próxima">
          <ChevronRight className="h-4 w-4" />
        </Link>
      )}
    </nav>
  );
}
