import { cn } from "@/lib/utils";
import type { ImagemQuestao } from "@/lib/questoes";

const MARCADOR = /\[\[img:(\d+)\]\]/;
const LINHA_TABELA = /^\|.*\|\s*$/;

// Recortes feitos a 150 dpi de texto em ~10 pt: 0,048em por pixel deixa a fórmula na altura
// do texto da tela; figuras grandes ficam no tamanho da prova impressa.
const EM_POR_PIXEL = 0.048;

function Imagem({ img, emLinha }: { img: ImagemQuestao; emLinha: boolean }) {
  const estilo = img.altura
    ? emLinha
      ? { height: `${img.altura * EM_POR_PIXEL}em` }
      : { width: `${(img.largura ?? 0) * EM_POR_PIXEL}em` }
    : undefined;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/imagens/${img.src}`}
      alt={img.legenda ?? (emLinha ? "Fórmula" : "Imagem da questão")}
      loading="lazy"
      style={estilo}
      className={cn(
        "max-w-full bg-white",
        emLinha ? "mx-0.5 inline-block align-middle dark:rounded-sm" : "my-2 block rounded-md border border-slate-200 dark:border-slate-700",
      )}
    />
  );
}

/** Texto com as imagens embutidas nos pontos marcados com [[img:N]]: sozinha na linha, a
 * imagem é um bloco (figura); no meio da frase, fica na linha (fórmula). */
function ComImagens({ texto, imagens, inline }: { texto: string; imagens: ImagemQuestao[]; inline: boolean }) {
  if (!MARCADOR.test(texto)) return <>{texto}</>;
  const partes = texto.split(/\[\[img:(\d+)\]\]/);
  // imagem sozinha na linha (só espaços ou quebra antes e depois) vira bloco
  const bloco = partes.map((_, i) => {
    if (i % 2 === 0 || inline) return false;
    const antes = partes[i - 1];
    const depois = partes[i + 1] ?? "";
    return (/\n[ \t]*$/.test(antes) || (i === 1 && antes.trim() === "")) && (/^[ \t]*\n/.test(depois) || depois.trim() === "");
  });
  return (
    <>
      {partes.map((p, i) => {
        if (i % 2 === 0) {
          // a quebra de linha junto de uma figura em bloco já vem do próprio bloco
          let t = p;
          if (bloco[i - 1]) t = t.replace(/^[ \t]*\n/, "");
          if (bloco[i + 1]) t = t.replace(/\n[ \t]*$/, "");
          return t || null;
        }
        const img = imagens[Number(p)];
        return img ? <Imagem key={i} img={img} emLinha={!bloco[i]} /> : null;
      })}
    </>
  );
}

/** Tabela escrita como linhas "| a | b |" (a primeira linha é o cabeçalho). */
function Tabela({ linhas, imagens }: { linhas: string[]; imagens: ImagemQuestao[] }) {
  const celulas = linhas.map((l) =>
    l
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((c) => c.trim()),
  );
  const [cabecalho, ...corpo] = celulas;
  return (
    <div className="my-2 overflow-x-auto">
      <table className="min-w-max border-collapse whitespace-normal text-sm">
        <thead>
          <tr>
            {cabecalho.map((c, i) => (
              <th key={i} className="border border-slate-300 bg-slate-100 px-2 py-1 text-left font-semibold dark:border-slate-700 dark:bg-slate-800">
                <ComImagens texto={c} imagens={imagens} inline />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {corpo.map((linha, i) => (
            <tr key={i}>
              {linha.map((c, j) => (
                <td key={j} className="border border-slate-300 px-2 py-1 align-top dark:border-slate-700">
                  <ComImagens texto={c} imagens={imagens} inline />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Texto da questão: imagens embutidas ([[img:N]]) e tabelas ("| a | b |") no lugar certo. */
export function TextoQuestao({
  texto,
  imagens,
  className,
  inline = false,
}: {
  texto: string;
  imagens: ImagemQuestao[];
  className?: string;
  /** Dentro de uma linha (alternativas): usa <span> em vez de <div>. */
  inline?: boolean;
}) {
  const Tag = inline ? "span" : "div";
  const linhas = texto.split("\n");
  if (inline || !linhas.some((l) => LINHA_TABELA.test(l))) {
    return (
      <Tag className={cn("texto-questao", className)}>
        <ComImagens texto={texto} imagens={imagens} inline={inline} />
      </Tag>
    );
  }
  // separa blocos de texto e de tabela
  const blocos: { tabela: boolean; linhas: string[] }[] = [];
  for (const l of linhas) {
    const tabela = LINHA_TABELA.test(l);
    const ultimo = blocos[blocos.length - 1];
    if (ultimo && ultimo.tabela === tabela) ultimo.linhas.push(l);
    else blocos.push({ tabela, linhas: [l] });
  }
  return (
    <div className={cn("texto-questao", className)}>
      {blocos.map((b, i) =>
        b.tabela && b.linhas.length >= 2 ? (
          <Tabela key={i} linhas={b.linhas} imagens={imagens} />
        ) : (
          <ComImagens key={i} texto={b.linhas.join("\n").replace(/^\n+|\n+$/g, "")} imagens={imagens} inline={false} />
        ),
      )}
    </div>
  );
}
