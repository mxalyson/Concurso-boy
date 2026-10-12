# Provas para importar

Crie **uma pasta por prova** aqui dentro e coloque:

| Arquivo | Obrigatório | O que é |
|---|---|---|
| `prova.pdf` | sim | o caderno de prova (baixado do site da banca) |
| `gabarito.pdf` ou `gabarito.txt` | recomendado | gabarito definitivo; no .txt basta `1 C 2 E 3 A ...` (use `X` para anulada) |
| `info.json` | recomendado | banca, órgão, cargo, ano, escolaridade e as disciplinas por faixa de questões (veja `_modelo/info.json`) |

Exemplo:

```
provas/
  cebraspe-pf-2021-agente/
    prova.pdf
    gabarito.pdf
    info.json
  fgv-tjrj-2022-tecnico/
    prova.pdf
    gabarito.txt
    info.json
```

As faixas de `disciplinas` vêm da capa ou do sumário da prova (ex.: “Língua Portuguesa — questões 1 a 20”).

Depois, rode:

```bash
npm run importar-pdfs -- provas --simular   # confere o que foi reconhecido
npm run importar-pdfs -- provas             # importa de verdade
npm run importar-pdfs -- provas --ia        # PDFs escaneados (precisa de ANTHROPIC_API_KEY)
```

Pastas que começam com `_` são ignoradas. Rodar de novo não duplica questões.
