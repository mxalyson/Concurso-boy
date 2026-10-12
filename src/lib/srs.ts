// Repetição espaçada dos flashcards (algoritmo SM-2 simplificado).
// Módulo sem acesso ao banco: pode ser usado no navegador.
import { hoje } from "./tempo";

export type NotaFlashcard = 0 | 1 | 2 | 3; // errei, difícil, bom, fácil

export function calcularRevisao(card: { facilidade: number; intervalo: number; repeticoes: number }, nota: NotaFlashcard) {
  const q = [1, 3, 4, 5][nota];
  let { facilidade, intervalo, repeticoes } = card;
  facilidade = Math.max(1.3, facilidade + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  if (nota === 0) {
    repeticoes = 0;
    intervalo = 0;
  } else {
    repeticoes += 1;
    if (repeticoes === 1) intervalo = nota === 3 ? 3 : 1;
    else if (repeticoes === 2) intervalo = nota === 1 ? 3 : nota === 3 ? 8 : 6;
    else intervalo = Math.max(1, Math.round(intervalo * facilidade * (nota === 1 ? 0.8 : nota === 3 ? 1.3 : 1)));
  }
  return { facilidade, intervalo, repeticoes, vence_em: hoje(intervalo) };
}

export function previsaoIntervalos(card: { facilidade: number; intervalo: number; repeticoes: number }) {
  return ([0, 1, 2, 3] as NotaFlashcard[]).map((n) => calcularRevisao(card, n).intervalo);
}
