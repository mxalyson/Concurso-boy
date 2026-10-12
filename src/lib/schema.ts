import type Database from "better-sqlite3";
import { areaPorRegras } from "./areas";

// Esquema do banco SQLite. Cada item de MIGRACOES é aplicado uma única vez,
// controlado por PRAGMA user_version. Um item pode ser SQL ou uma função (dados derivados).
export const MIGRACOES: (string | ((c: Database.Database) => void))[] = [
  /* sql */ `
  CREATE TABLE usuarios (
    id INTEGER PRIMARY KEY,
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    senha_hash TEXT NOT NULL,
    papel TEXT NOT NULL DEFAULT 'aluno' CHECK (papel IN ('aluno', 'admin')),
    meta_diaria INTEGER NOT NULL DEFAULT 30,
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE sessoes (
    token TEXT PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    expira_em TEXT NOT NULL
  );

  -- Taxonomia ---------------------------------------------------------------
  CREATE TABLE bancas (
    id INTEGER PRIMARY KEY,
    sigla TEXT NOT NULL UNIQUE COLLATE NOCASE,
    nome TEXT NOT NULL
  );

  CREATE TABLE orgaos (
    id INTEGER PRIMARY KEY,
    sigla TEXT NOT NULL UNIQUE COLLATE NOCASE,
    nome TEXT NOT NULL,
    esfera TEXT CHECK (esfera IN ('federal', 'estadual', 'municipal')),
    uf TEXT
  );

  CREATE TABLE disciplinas (
    id INTEGER PRIMARY KEY,
    nome TEXT NOT NULL UNIQUE COLLATE NOCASE,
    slug TEXT NOT NULL UNIQUE,
    cor TEXT NOT NULL DEFAULT '#6366f1'
  );

  CREATE TABLE assuntos (
    id INTEGER PRIMARY KEY,
    disciplina_id INTEGER NOT NULL REFERENCES disciplinas(id) ON DELETE CASCADE,
    parent_id INTEGER REFERENCES assuntos(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    ordem INTEGER NOT NULL DEFAULT 0
  );
  CREATE UNIQUE INDEX assuntos_unicos ON assuntos(disciplina_id, ifnull(parent_id, 0), nome COLLATE NOCASE);

  CREATE TABLE provas (
    id INTEGER PRIMARY KEY,
    banca_id INTEGER REFERENCES bancas(id) ON DELETE SET NULL,
    orgao_id INTEGER REFERENCES orgaos(id) ON DELETE SET NULL,
    cargo TEXT,
    ano INTEGER,
    escolaridade TEXT CHECK (escolaridade IN ('fundamental', 'medio', 'superior')),
    url_prova TEXT,
    url_gabarito TEXT,
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE UNIQUE INDEX provas_unicas ON provas(ifnull(banca_id, 0), ifnull(orgao_id, 0), ifnull(cargo, ''), ifnull(ano, 0));

  -- Questões ----------------------------------------------------------------
  CREATE TABLE questoes (
    id INTEGER PRIMARY KEY,
    prova_id INTEGER REFERENCES provas(id) ON DELETE SET NULL,
    disciplina_id INTEGER NOT NULL REFERENCES disciplinas(id),
    assunto_id INTEGER REFERENCES assuntos(id) ON DELETE SET NULL,
    numero INTEGER,
    tipo TEXT NOT NULL CHECK (tipo IN ('multipla', 'certo_errado')),
    texto_base TEXT,
    enunciado TEXT NOT NULL,
    alternativas TEXT NOT NULL DEFAULT '[]',
    gabarito TEXT,
    comentario TEXT,
    dificuldade INTEGER CHECK (dificuldade BETWEEN 1 AND 3),
    anulada INTEGER NOT NULL DEFAULT 0,
    desatualizada INTEGER NOT NULL DEFAULT 0,
    fonte TEXT,
    hash TEXT UNIQUE,
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX questoes_disciplina ON questoes(disciplina_id);
  CREATE INDEX questoes_assunto ON questoes(assunto_id);
  CREATE INDEX questoes_prova ON questoes(prova_id);

  CREATE VIRTUAL TABLE questoes_fts USING fts5(
    enunciado, texto_base, alternativas, comentario,
    content='questoes', content_rowid='id',
    tokenize='unicode61 remove_diacritics 2'
  );
  CREATE TRIGGER questoes_ai AFTER INSERT ON questoes BEGIN
    INSERT INTO questoes_fts(rowid, enunciado, texto_base, alternativas, comentario)
    VALUES (new.id, new.enunciado, new.texto_base, new.alternativas, new.comentario);
  END;
  CREATE TRIGGER questoes_ad AFTER DELETE ON questoes BEGIN
    INSERT INTO questoes_fts(questoes_fts, rowid, enunciado, texto_base, alternativas, comentario)
    VALUES ('delete', old.id, old.enunciado, old.texto_base, old.alternativas, old.comentario);
  END;
  CREATE TRIGGER questoes_au AFTER UPDATE ON questoes BEGIN
    INSERT INTO questoes_fts(questoes_fts, rowid, enunciado, texto_base, alternativas, comentario)
    VALUES ('delete', old.id, old.enunciado, old.texto_base, old.alternativas, old.comentario);
    INSERT INTO questoes_fts(rowid, enunciado, texto_base, alternativas, comentario)
    VALUES (new.id, new.enunciado, new.texto_base, new.alternativas, new.comentario);
  END;

  CREATE TABLE respostas (
    id INTEGER PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    questao_id INTEGER NOT NULL REFERENCES questoes(id) ON DELETE CASCADE,
    resposta TEXT NOT NULL,
    correta INTEGER NOT NULL,
    tempo_seg INTEGER,
    origem TEXT NOT NULL DEFAULT 'livre' CHECK (origem IN ('livre', 'simulado')),
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX respostas_usuario_questao ON respostas(usuario_id, questao_id);
  CREATE INDEX respostas_usuario_data ON respostas(usuario_id, criado_em);
  CREATE INDEX respostas_questao ON respostas(questao_id);

  CREATE TABLE favoritos (
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    questao_id INTEGER NOT NULL REFERENCES questoes(id) ON DELETE CASCADE,
    criado_em TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (usuario_id, questao_id)
  );

  CREATE TABLE anotacoes (
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    questao_id INTEGER NOT NULL REFERENCES questoes(id) ON DELETE CASCADE,
    texto TEXT NOT NULL,
    atualizado_em TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (usuario_id, questao_id)
  );

  CREATE TABLE comentarios (
    id INTEGER PRIMARY KEY,
    questao_id INTEGER NOT NULL REFERENCES questoes(id) ON DELETE CASCADE,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    texto TEXT NOT NULL,
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX comentarios_questao ON comentarios(questao_id);

  CREATE TABLE reportes (
    id INTEGER PRIMARY KEY,
    questao_id INTEGER NOT NULL REFERENCES questoes(id) ON DELETE CASCADE,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    motivo TEXT NOT NULL,
    detalhes TEXT,
    status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'resolvido')),
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Cadernos e simulados ----------------------------------------------------
  CREATE TABLE cadernos (
    id INTEGER PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    descricao TEXT,
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE caderno_questoes (
    caderno_id INTEGER NOT NULL REFERENCES cadernos(id) ON DELETE CASCADE,
    questao_id INTEGER NOT NULL REFERENCES questoes(id) ON DELETE CASCADE,
    adicionada_em TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (caderno_id, questao_id)
  );

  CREATE TABLE simulados (
    id INTEGER PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    duracao_min INTEGER NOT NULL,
    filtros TEXT NOT NULL DEFAULT '{}',
    iniciado_em TEXT NOT NULL DEFAULT (datetime('now')),
    finalizado_em TEXT,
    acertos INTEGER,
    total INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE simulado_questoes (
    simulado_id INTEGER NOT NULL REFERENCES simulados(id) ON DELETE CASCADE,
    ordem INTEGER NOT NULL,
    questao_id INTEGER NOT NULL REFERENCES questoes(id) ON DELETE CASCADE,
    resposta TEXT,
    PRIMARY KEY (simulado_id, ordem)
  );

  -- Área de estudos ---------------------------------------------------------
  CREATE TABLE materiais (
    id INTEGER PRIMARY KEY,
    disciplina_id INTEGER NOT NULL REFERENCES disciplinas(id) ON DELETE CASCADE,
    assunto_id INTEGER REFERENCES assuntos(id) ON DELETE SET NULL,
    titulo TEXT NOT NULL,
    conteudo TEXT NOT NULL,
    autor_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    publico INTEGER NOT NULL DEFAULT 1,
    criado_em TEXT NOT NULL DEFAULT (datetime('now')),
    atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX materiais_assunto ON materiais(assunto_id);

  CREATE TABLE flashcard_decks (
    id INTEGER PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    disciplina_id INTEGER REFERENCES disciplinas(id) ON DELETE SET NULL,
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE flashcards (
    id INTEGER PRIMARY KEY,
    deck_id INTEGER NOT NULL REFERENCES flashcard_decks(id) ON DELETE CASCADE,
    frente TEXT NOT NULL,
    verso TEXT NOT NULL,
    questao_id INTEGER REFERENCES questoes(id) ON DELETE SET NULL,
    facilidade REAL NOT NULL DEFAULT 2.5,
    intervalo INTEGER NOT NULL DEFAULT 0,
    repeticoes INTEGER NOT NULL DEFAULT 0,
    vence_em TEXT NOT NULL DEFAULT (date('now')),
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX flashcards_deck ON flashcards(deck_id, vence_em);

  CREATE TABLE flashcard_revisoes (
    id INTEGER PRIMARY KEY,
    flashcard_id INTEGER NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nota INTEGER NOT NULL,
    revisado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE planos (
    usuario_id INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
    objetivo TEXT,
    data_prova TEXT,
    horas_semana TEXT NOT NULL DEFAULT '[2,2,2,2,2,0,0]',
    ciclo_iniciado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE plano_disciplinas (
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    disciplina_id INTEGER NOT NULL REFERENCES disciplinas(id) ON DELETE CASCADE,
    peso INTEGER NOT NULL DEFAULT 1 CHECK (peso BETWEEN 1 AND 5),
    dominio INTEGER NOT NULL DEFAULT 3 CHECK (dominio BETWEEN 1 AND 5),
    PRIMARY KEY (usuario_id, disciplina_id)
  );

  CREATE TABLE sessoes_estudo (
    id INTEGER PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    disciplina_id INTEGER REFERENCES disciplinas(id) ON DELETE SET NULL,
    assunto_id INTEGER REFERENCES assuntos(id) ON DELETE SET NULL,
    minutos INTEGER NOT NULL CHECK (minutos > 0),
    tipo TEXT NOT NULL DEFAULT 'teoria' CHECK (tipo IN ('teoria', 'questoes', 'revisao', 'video', 'leitura_lei')),
    observacao TEXT,
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX sessoes_estudo_usuario ON sessoes_estudo(usuario_id, criado_em);

  CREATE TABLE progresso_assuntos (
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    assunto_id INTEGER NOT NULL REFERENCES assuntos(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'nao_iniciado' CHECK (status IN ('nao_iniciado', 'estudando', 'concluido')),
    revisoes INTEGER NOT NULL DEFAULT 0,
    ultima_revisao TEXT,
    proxima_revisao TEXT,
    PRIMARY KEY (usuario_id, assunto_id)
  );
  `,
  /* sql */ `
  -- Imagens recortadas da prova original (figuras, tabelas, fórmulas).
  -- imagens: JSON [{ "src": "pf21/37-1.png", "parte": "inline" | "contexto" | "enunciado" | "figura", "largura", "altura" }]
  -- "inline": aparece no ponto do texto marcado com [[img:N]]
  ALTER TABLE questoes ADD COLUMN imagens TEXT NOT NULL DEFAULT '[]';
  -- 0 quando o texto extraído do PDF não é confiável (ex.: fórmulas) e a imagem deve ser exibida no lugar dele
  ALTER TABLE questoes ADD COLUMN texto_confiavel INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE provas ADD COLUMN origem TEXT NOT NULL DEFAULT 'manual';
  `,
  // Área/carreira da prova (filtro "Área"): coluna e preenchimento das provas existentes
  (c) => {
    c.exec("ALTER TABLE provas ADD COLUMN area TEXT; CREATE INDEX provas_area ON provas(area);");
    const provas = c
      .prepare(
        `SELECT p.id, p.cargo, o.sigla, o.nome FROM provas p LEFT JOIN orgaos o ON o.id = p.orgao_id`,
      )
      .all() as { id: number; cargo: string | null; sigla: string | null; nome: string | null }[];
    const atualizar = c.prepare("UPDATE provas SET area = ? WHERE id = ?");
    for (const p of provas) atualizar.run(areaPorRegras(p.sigla, p.nome, p.cargo), p.id);
  },
  /* sql */ `
  -- Uma mesma questão pode ter sido aplicada em várias provas (ex.: conhecimentos básicos
  -- comuns a vários cargos). A questão é gravada uma vez; aqui ficam todas as provas.
  -- questoes.prova_id continua sendo a prova "principal" (exibida no cartão).
  CREATE TABLE questao_provas (
    questao_id INTEGER NOT NULL REFERENCES questoes(id) ON DELETE CASCADE,
    prova_id INTEGER NOT NULL REFERENCES provas(id) ON DELETE CASCADE,
    numero INTEGER,
    PRIMARY KEY (questao_id, prova_id)
  );
  CREATE INDEX questao_provas_prova ON questao_provas(prova_id, numero);
  INSERT INTO questao_provas (questao_id, prova_id, numero) SELECT id, prova_id, numero FROM questoes WHERE prova_id IS NOT NULL;
  `,
  /* sql */ `
  -- Filtros salvos pelo usuário ("Meus filtros")
  CREATE TABLE filtros_salvos (
    id INTEGER PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    params TEXT NOT NULL,
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX filtros_salvos_usuario ON filtros_salvos(usuario_id);
  `,
];
