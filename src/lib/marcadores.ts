// Utilitários sem dependência do banco (podem ser usados em componentes de cliente).

/** Marcador de imagem embutida no texto da questão. */
export const RE_MARCADOR_IMAGEM = /\[\[img:(\d+)\]\]/g;

/** Texto sem os marcadores de imagem (listagens, buscas, flashcards). */
export function semMarcadores(texto: string) {
  return texto.replace(RE_MARCADOR_IMAGEM, "[imagem]").replace(/\n{3,}/g, "\n\n");
}
