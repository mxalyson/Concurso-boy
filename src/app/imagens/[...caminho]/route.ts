import fs from "node:fs";
import { localizarImagem } from "@/lib/imagens";

const TIPOS: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif" };

export async function GET(_: Request, { params }: { params: Promise<{ caminho: string[] }> }) {
  const relativo = (await params).caminho.join("/");
  const arquivo = localizarImagem(relativo);
  if (!arquivo) return new Response("Imagem não encontrada", { status: 404 });
  const ext = arquivo.split(".").pop()!.toLowerCase();
  return new Response(fs.readFileSync(arquivo), {
    headers: { "Content-Type": TIPOS[ext] ?? "application/octet-stream", "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
