import type { ImagemQuestao } from "@/lib/questoes";

/** Recortes da prova original (figuras, tabelas, fórmulas). */
export function ImagensQuestao({ imagens, parte, titulo }: { imagens: ImagemQuestao[]; parte: ImagemQuestao["parte"]; titulo?: string }) {
  const lista = imagens.filter((i) => i.parte === parte);
  if (!lista.length) return null;
  return (
    <figure className="space-y-2">
      {lista.map((img) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={img.src}
          src={`/imagens/${img.src}`}
          alt={img.legenda ?? titulo ?? "Recorte da prova original"}
          loading="lazy"
          className="max-w-full rounded-md border border-slate-200 bg-white dark:border-slate-700"
        />
      ))}
      {titulo && <figcaption className="text-xs text-slate-500">{titulo}</figcaption>}
    </figure>
  );
}
