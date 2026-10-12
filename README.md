# Concurso Boy

Plataforma completa de estudos para concursos públicos: banco de questões com busca e filtros, simulados cronometrados, teoria por assunto, edital verticalizado, ciclo de estudos, revisão espaçada, flashcards, cronômetro Pomodoro e estatísticas de desempenho. Inclui área administrativa para importar provas (PDF, JSON, CSV ou PDF com IA).

## Funcionalidades

**Questões**
- Busca por palavra-chave (texto completo, ignora acentos) ou por `#ID`
- Filtros: disciplina, assunto (com subtópicos), banca, órgão, ano, cargo, escolaridade, dificuldade, tipo (múltipla escolha / certo-errado), situação (não resolvidas, resolvidas, acertei, errei), favoritas, caderno
- Ordenação: recentes, antigas, aleatória, mais resolvidas, maior índice de erro
- Em cada questão: responder, riscar alternativas, gabarito comentado, estatísticas da turma, fórum, anotações pessoais, favoritar, adicionar a caderno, virar flashcard, reportar erro
- **Cadernos** de questões (manuais ou gerados a partir dos filtros), caderno de erros e favoritas
- **Simulados** cronometrados, com quantidade por disciplina, navegação, marcação para revisão, correção automática, nota por disciplina e gabarito comentado

**Estudos**
- **Disciplinas e teoria**: resumos em Markdown por assunto (públicos ou pessoais)
- **Edital verticalizado**: status de cada assunto (não iniciado / estudando / concluído), aproveitamento e questões por assunto
- **Revisão espaçada**: ao concluir um assunto, revisões são agendadas em 1, 7, 15, 30, 60 e 120 dias
- **Plano e ciclo de estudos**: horas por dia da semana, peso de cada disciplina e seu domínio → ciclo com metas de tempo e grade semanal sugerida; contagem regressiva para a prova
- **Cronômetro** Pomodoro/livre que registra as horas líquidas por disciplina
- **Flashcards** com repetição espaçada (SM-2), importação em lote e criação a partir de questões

**Análise**
- Painel diário: meta de questões, sequência de dias, próxima disciplina do ciclo, revisões pendentes, pontos fracos
- Desempenho por disciplina e assunto, gráfico diário, mapa de constância, tempo por disciplina e evolução nos simulados

**Administração** (o primeiro usuário cadastrado vira administrador)
- Cadastro/edição de questões, disciplinas, assuntos hierárquicos, bancas e órgãos
- Importação de provas com **tela de revisão** antes de gravar e descarte automático de duplicadas
- Notificações de erro enviadas pelos alunos e gestão de usuários
- Opcional: geração de comentários com IA

## Como rodar

Requisitos: Node.js 20+.

```bash
npm install
npm run db:seed      # cria o banco (data/concurso.db) com o conteúdo de exemplo
npm run dev          # http://localhost:3000
```

Cadastre-se: a primeira conta criada é administradora. Para promover outra conta: `npm run admin -- email@exemplo.com`.

Produção:

```bash
npm run build
npm start
```

Ou com Docker (o banco fica no volume `/data`):

```bash
docker build -t concurso-boy .
docker run -p 3000:3000 -v concurso-dados:/data concurso-boy
```

### Variáveis de ambiente

| Variável | Para que serve |
|---|---|
| `DATABASE_PATH` | Caminho do banco SQLite (padrão `data/concurso.db`) |
| `ANTHROPIC_API_KEY` | Opcional. Ativa a importação de PDFs com IA e os comentários automáticos |
| `ANTHROPIC_MODEL` | Opcional. Modelo usado pela IA (padrão `claude-opus-5-5`) |
| `FUSO_HORAS` | Fuso para metas e sequências diárias (padrão `-3`, Brasília) |
| `COOKIE_INSEGURO=1` | Só se rodar em produção **sem HTTPS** (o cookie de sessão é `Secure` por padrão) |

O banco é um arquivo SQLite: hospede em um servidor com disco persistente (VPS, Railway, Fly.io, Render com disco, Docker com volume). Plataformas *serverless* sem disco (como Vercel) não servem sem trocar o banco. Para backup, basta copiar o arquivo `.db`.

## De onde vêm as questões

O sistema vem com **972 questões de provas oficiais** já revisadas, além de 94 questões autorais de exemplo (banca “AUTORAL”) e 10 resumos:

| Banca | Prova | Questões | Com figura/fórmula |
|---|---|---|---|
| Cebraspe | DPF 2025 — Agente de Polícia Federal | 120 | 4 |
| Cebraspe | INSS 2022 — Técnico do Seguro Social | 120 | 1 |
| Cebraspe | PC-DF 2021 — Agente (com a justificativa oficial da banca em cada item) | 70 | 14 |
| Cebraspe | Polícia Federal 2021 — Agente | 120 | 14 |
| Cebraspe | PRF 2021 — Policial Rodoviário Federal | 112 | 2 |
| Cesgranrio | BANESE 2025 — Técnico Bancário | 80 | 1 |
| FCC | TRF 4 2025 — Técnico Judiciário - Área: Administrativa | 50 | 0 |
| FGV | TJ RS 2025 — Técnico do Poder Judiciário – Área: Administrativo-Judiciária | 80 | 3 |
| FGV | TRT-16 2022 — Analista Judiciário (Área Judiciária) | 80 | 2 |
| FGV | TRT-16 2022 — Técnico Judiciário (Área Administrativa) | 70 | 3 |
| Vunesp | TJ SP 2025 — Escrevente Técnico Judiciário | 70 | 3 |

Nas provas extraídas dos PDFs oficiais (com o gabarito **definitivo**), figuras, gráficos, tabelas e fórmulas entram como **imagem recortada só do elemento** — o texto da questão continua como texto, com a imagem no ponto exato (marcador `[[img:N]]` no texto). As provas de 2025 foram obtidas pela [Quest API](https://quest.api.br) com o script `npm run quest` (veja abaixo). Os lotes ficam em `data/provas/`, as imagens em `data/imagens/` e o processo de coleta dos PDFs está em `scripts/coleta/LEIA-ME.md`.

### Baixar mais provas da Quest API (script offline)

O site **não** acessa a Quest API: o script baixa as questões para `data/provas/*.json` (um arquivo por prova, com imagens em `data/imagens/quest/`) e o `npm run db:seed` importa. Coloque a chave em `.env.local` (fora do git): `QUEST_API_KEY=qk_...`.

```bash
npm run quest -- quota                                   # créditos restantes (grátis)
npm run quest -- provas --banca FCC --ano 2025 --orgao TRT   # lista provas (1 crédito por prova listada)
npm run quest -- baixar 25322348 25647523                # baixa provas inteiras (6 créditos por questão)
npm run quest -- novas --ano 2026 --max-creditos 1200    # continua de onde parou: traz provas novas
npm run quest -- reconverter                             # refaz os lotes do cache local (grátis)
npm run db:seed                                          # importa os arquivos novos
```

As bancas usam nomes exatos (`CESPE CEBRASPE`, `FGV`, `FCC`, `VUNESP`, `CESGRANRIO`...). Para agendar a busca de provas novas, rode `npm run quest -- novas && npm run db:seed` no cron do servidor.

Para ampliar o banco, importe mais provas:

1. **Sites oficiais das bancas** — Cebraspe, FGV Conhecimento, FCC, Vunesp, Cesgranrio, IBFC, Quadrix, Instituto AOCP, Idecan e outras publicam a prova e o gabarito (preliminar e definitivo) de cada concurso. É a melhor fonte, inclusive para provas antigas.
2. **Agregadores de provas em PDF**, como o PCI Concursos, que reúnem links para provas e gabaritos de anos anteriores.
3. **Dados abertos do governo**, como as provas e gabaritos do ENEM/ENADE publicados pelo INEP, e as provas do Exame de Ordem divulgadas pela OAB/FGV.
4. **Seu próprio material** — planilhas, apostilas e questões que você ou professores escreveram (CSV/JSON).

Como importar (menu **Painel admin → Importar provas**):

- **PDF da prova**: lê PDFs com texto selecionável, reconhece a numeração, as alternativas (A–E), os itens de certo/errado e os textos associados. O gabarito pode vir em PDF ou colado (`1-C 2-E 3-A` ou a tabela do gabarito). Tudo passa por uma tela de revisão em que você ajusta disciplina, assunto e gabarito.
- **PDF com IA**: para provas escaneadas ou com layout complexo. A IA transcreve todas as questões, classifica disciplina e assunto e, se você quiser, escreve comentários. Precisa de `ANTHROPIC_API_KEY`.
- **JSON ou CSV**: para dados que você já tem estruturados. Também pela linha de comando: `npm run import -- arquivo.json`.
- **Várias provas de uma vez**: coloque cada prova numa subpasta de `provas/` (veja `provas/LEIA-ME.md`) e rode `npm run importar-pdfs -- provas`.

> **Sobre direitos autorais e termos de uso:** não copie o conteúdo de plataformas comerciais de questões (QConcursos, TEC Concursos, Gran etc.). Isso viola os termos de uso delas, e os comentários e a classificação delas são protegidos. Provas e gabaritos publicados pelas bancas são de acesso público e livres para estudo pessoal. Se for abrir a plataforma ao público ou cobrar por ela, consulte um advogado sobre a reprodução de provas de cada banca.

### Formato JSON

```json
{
  "prova": { "banca": "CEBRASPE", "orgao": "PF", "orgao_nome": "Polícia Federal",
             "cargo": "Agente", "ano": 2021, "escolaridade": "superior" },
  "questoes": [
    {
      "numero": 1,
      "disciplina": "Direito Constitucional",
      "assunto": "Direitos e garantias fundamentais > Remédios constitucionais",
      "tipo": "certo_errado",
      "texto_base": "Texto de apoio, se houver",
      "enunciado": "O habeas data ...",
      "gabarito": "C",
      "comentario": "Explicação em **Markdown**",
      "dificuldade": 2
    },
    {
      "disciplina": "Língua Portuguesa",
      "assunto": "Crase",
      "enunciado": "Assinale a alternativa ...",
      "alternativas": ["(A) ...", "(B) ...", "(C) ...", "(D) ...", "(E) ..."],
      "gabarito": "B"
    }
  ]
}
```

- `tipo`: `multipla` ou `certo_errado` (se omitido, é deduzido pelas alternativas)
- `gabarito`: letra (A–E), `C`/`E` (ou Certo/Errado), `X` para anulada
- `assunto`: use `>` para criar subtópicos
- Campos da prova podem ir em `prova` (valem para todas) ou em cada questão
- Questões repetidas (mesmo enunciado e alternativas) são ignoradas

### Formato CSV

Cabeçalho com os mesmos nomes de campos, alternativas nas colunas `a, b, c, d, e`. Separador vírgula ou ponto e vírgula:

```csv
disciplina;assunto;banca;ano;enunciado;a;b;c;d;e;gabarito
Informática;Redes;FCC;2023;Qual protocolo envia e-mails?;POP3;IMAP;SMTP;HTTP;FTP;C
```

## Tecnologia

Next.js 16 (App Router, Server Actions) · React 19 · TypeScript · Tailwind CSS 4 · SQLite (better-sqlite3, busca FTS5) · unpdf (leitura de PDF) · SDK da Anthropic (opcional).

Estrutura:

```
src/app/(auth)        login e cadastro
src/app/(app)         área logada (questões, simulados, estudos, admin...)
src/app/actions       Server Actions (mutações)
src/lib               banco, autenticação, consultas, importação, parser de PDF, IA
src/components        componentes de interface
scripts/              seed, importação via linha de comando, promoção de admin
```
