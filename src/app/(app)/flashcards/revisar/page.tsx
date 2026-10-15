import { exigirUsuario } from "@/lib/auth";
import { db, hoje } from "@/lib/db";
import { RevisaoFlashcards } from "@/components/estudos/revisao-flashcards";

export const metadata = { title: "Revisar flashcards" };

export default async function RevisarFlashcards({ searchParams }: { searchParams: Promise<{ deck?: string }> }) {
  const usuario = await exigirUsuario();
  const deck = Number((await searchParams).deck) || null;
  const filtroDeck = deck ? "AND k.id = @deck" : "";
  const base = `SELECT f.id, f.frente, f.verso, f.facilidade, f.intervalo, f.repeticoes, k.nome AS deck
    FROM flashcards f JOIN flashcard_decks k ON k.id = f.deck_id WHERE k.usuario_id = @usuario ${filtroDeck}`;
  type Carta = { id: number; frente: string; verso: string; deck: string; facilidade: number; intervalo: number; repeticoes: number };
  let cartas = db()
    .prepare(`${base} AND f.vence_em <= @hoje ORDER BY f.vence_em, random() LIMIT 200`)
    .all({ usuario: usuario.id, deck, hoje: hoje() }) as Carta[];
  // Sem cartas vencidas num baralho específico: permite estudo antecipado.
  if (!cartas.length && deck) {
    cartas = db().prepare(`${base} ORDER BY f.vence_em LIMIT 30`).all({ usuario: usuario.id, deck }) as Carta[];
  }
  return <RevisaoFlashcards cartas={cartas} />;
}
