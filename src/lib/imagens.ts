import fs from "node:fs";
import path from "node:path";

/**
 * Pastas de onde as imagens das questões são servidas, em ordem de prioridade:
 * a pasta configurada (IMAGENS_PATH, gravável — usada pela coleta automática) e
 * a pasta data/imagens que acompanha o repositório.
 */
export function pastasImagens(): string[] {
  const pastas = [
    process.env.IMAGENS_PATH ? path.resolve(/*turbopackIgnore: true*/ process.env.IMAGENS_PATH) : null,
    path.resolve(/*turbopackIgnore: true*/ process.cwd(), "data/imagens"),
  ].filter((p): p is string => !!p);
  return [...new Set(pastas)];
}

/** Pasta onde novas imagens devem ser gravadas. */
export function pastaGravacaoImagens(): string {
  const pasta = pastasImagens()[0];
  fs.mkdirSync(pasta, { recursive: true });
  return pasta;
}

/** Resolve um caminho relativo de imagem com segurança (sem sair das pastas permitidas). */
export function localizarImagem(relativo: string): string | null {
  if (!/^[\w\-./]+\.(png|jpe?g|webp|gif)$/i.test(relativo) || relativo.includes("..")) return null;
  for (const pasta of pastasImagens()) {
    const completo = path.resolve(pasta, relativo);
    if (completo.startsWith(pasta + path.sep) && fs.existsSync(completo)) return completo;
  }
  return null;
}
