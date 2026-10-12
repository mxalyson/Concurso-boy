# Coleta de provas oficiais

Ferramentas usadas para transformar os PDFs oficiais das bancas nos lotes de `data/provas/*.json`
(importados automaticamente por `npm run db:seed`). Requer `pdftotext`/`pdfinfo` (poppler-utils),
Python 3 e `pip install pyspellchecker pymupdf pillow numpy` (hifenização e detecção de figuras).

## Fluxo

1. **Baixar** a prova e o gabarito **definitivo** no site da banca.
   - Cebraspe: a lista de arquivos de cada concurso está em
     `https://apis.cebraspe.org.br/cebraspe/eventos/<ID>` (ex.: `PF_21`), e os PDFs em
     `https://cdn.cebraspe.org.br/concursos/<ID>/arquivos/<nomeArquivo>`.
   - FGV: página do concurso em `https://conhecimento.fgv.br/concursos/<id>` (provas “tipo 1” e gabarito definitivo).
2. **Extrair o texto na ordem de leitura** (as provas são em duas colunas):
   `python3 colunas.py prova.pdf > prova.txt`
3. **Converter** em questões:
   - Certo/errado (Cebraspe): `python3 cespe.py prova.txt itens.json [primeiro_item]`
   - Múltipla escolha (FGV): `python3 fgv.py prova.txt questoes.json "regex_de_cabeçalhos" [primeira_questão]`
   Os itens que dependem de figura, tabela ou fórmula são marcados em `problema`.
4. **Revisar** (`python3 blocos.py itens.json` mostra cada bloco de itens com seu comando) e escrever
   uma configuração em `config/` com: dados da prova, classificação por disciplina/assunto,
   itens excluídos, itens desatualizados (ex.: Lei 8.666/1993) e correções pontuais.
5. **Montar** o lote com o gabarito definitivo:
   - `python3 montar.py config/x.json itens.json gabarito.txt saida.json` (certo/errado; usa justificativas oficiais como comentário quando coincidem com o gabarito definitivo)
   - `python3 montar_me.py config/x.json questoes.json gabarito.txt saida.json` (múltipla escolha)
   (`gabarito.txt` = `pdftotext -layout gabarito.pdf`)
6. Copiar a saída para `data/provas/` e rodar `npm run db:seed`.

## Critérios de qualidade

- Só o **gabarito definitivo** é usado; itens anulados entram marcados como anulados.
- Itens que dependem de imagem, gráfico, tabela ou fórmula recebem **só a figura** recortada do PDF
  (`--pdf prova.pdf:primeiro_item` em `montar.py`/`montar_me.py`): `figuras.py` localiza imagens e
  desenhos vetoriais reais do PDF (PyMuPDF), recorta tabelas/gráficos como imagem e fórmulas como
  imagens pequenas dentro da frase; o restante continua como texto, com `[[img:N]]` no ponto exato.
  Justificativas/gabaritos impressos na prova nunca entram no texto nem nas imagens.
- Cada questão guarda a fonte (banca, órgão, cargo, ano e número do item) e os links da prova e do gabarito.
