import { clsx, type ClassValue } from "clsx";

export function cn(...classes: ClassValue[]) {
  return clsx(classes);
}

export function slugify(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function pct(parte: number, total: number): number {
  return total > 0 ? Math.round((parte / total) * 100) : 0;
}

export function formatarMinutos(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}min`;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

export function formatarData(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

/** Converte datetime UTC do SQLite em Date. */
export function dataSqlite(valor: string): Date {
  return new Date(valor.includes("T") ? valor : valor.replace(" ", "T") + "Z");
}

export function tempoRelativo(valor: string): string {
  const diff = (Date.now() - dataSqlite(valor).getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  const dias = Math.floor(diff / 86400);
  if (dias < 30) return `há ${dias} dia${dias > 1 ? "s" : ""}`;
  return dataSqlite(valor).toLocaleDateString("pt-BR");
}

export const ESCOLARIDADES = {
  fundamental: "Fundamental",
  medio: "Médio",
  superior: "Superior",
} as const;

export const DIFICULDADES = { 1: "Fácil", 2: "Média", 3: "Difícil" } as const;

export const TIPOS_QUESTAO = {
  multipla: "Múltipla escolha",
  certo_errado: "Certo ou errado",
} as const;

export const TIPOS_SESSAO = {
  teoria: "Teoria",
  questoes: "Questões",
  revisao: "Revisão",
  video: "Videoaula",
  leitura_lei: "Lei seca",
} as const;

export function inteiros(valor: string | string[] | undefined | null): number[] {
  if (!valor) return [];
  const partes = (Array.isArray(valor) ? valor.join(",") : valor).split(",");
  return partes.map((p) => Number.parseInt(p, 10)).filter((n) => Number.isFinite(n) && n > 0);
}
