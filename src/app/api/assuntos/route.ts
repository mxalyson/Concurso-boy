import { NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/auth";
import { assuntosDasDisciplinas } from "@/lib/opcoes-filtro";

/** Assuntos das disciplinas escolhidas no painel de filtros (?d=1,2). */
export async function GET(req: Request) {
  if (!(await usuarioAtual())) return NextResponse.json({ erro: "não autenticado" }, { status: 401 });
  const ids = (new URL(req.url).searchParams.get("d") ?? "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 50);
  return NextResponse.json(assuntosDasDisciplinas(ids));
}
