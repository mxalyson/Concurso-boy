/** Extrai o texto de um PDF preservando as quebras de linha. */
export async function textoDoPdf(buffer: Buffer | Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}
