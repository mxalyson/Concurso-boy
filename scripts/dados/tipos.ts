export type QuestaoSeed = {
  d: string; // disciplina
  a: string; // assunto ("Tópico > Subtópico")
  t: "ce" | "me"; // certo/errado ou múltipla escolha
  base?: string; // texto associado
  e: string; // enunciado
  alt?: string[]; // alternativas A..E
  g: string; // gabarito
  c: string; // comentário (Markdown)
  dif: 1 | 2 | 3;
  nivel: "medio" | "superior";
};
