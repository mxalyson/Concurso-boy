import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, BookOpen, CalendarClock, ClipboardList, FileUp, GraduationCap, Layers, ListChecks, RotateCcw, Timer } from "lucide-react";
import { usuarioAtual } from "@/lib/auth";
import { contarQuestoes } from "@/lib/questoes";
import { listarDisciplinas } from "@/lib/taxonomia";
import { AlternarTema } from "@/components/tema";
import { LinkBotao } from "@/components/ui";

const RECURSOS = [
  { icone: ListChecks, titulo: "Banco de questões", texto: "Busca por palavra-chave e filtros por disciplina, assunto, banca, órgão, ano, escolaridade e dificuldade." },
  { icone: ClipboardList, titulo: "Simulados cronometrados", texto: "Monte provas com a distribuição do edital e receba gabarito comentado e nota por disciplina." },
  { icone: BookOpen, titulo: "Teoria e edital verticalizado", texto: "Resumos por assunto e controle do que já foi estudado em cada tópico do edital." },
  { icone: CalendarClock, titulo: "Ciclo de estudos", texto: "Distribuição automática das horas pelo peso de cada matéria e pela sua dificuldade." },
  { icone: RotateCcw, titulo: "Revisão espaçada", texto: "Revisões agendadas em 1, 7, 15, 30, 60 e 120 dias para não esquecer o que estudou." },
  { icone: Layers, titulo: "Flashcards", texto: "Cartões de memorização com algoritmo de repetição espaçada, criados até a partir das questões." },
  { icone: Timer, titulo: "Cronômetro Pomodoro", texto: "Registre o tempo de estudo e acompanhe as horas líquidas por disciplina." },
  { icone: BarChart3, titulo: "Estatísticas", texto: "Aproveitamento por disciplina e assunto, constância, evolução nos simulados e pontos fracos." },
  { icone: FileUp, titulo: "Importação de provas", texto: "Importe provas em PDF, JSON ou CSV — com extração automática por IA opcional." },
];

export default async function Inicio() {
  if (await usuarioAtual()) redirect("/painel");
  const total = contarQuestoes();
  const disciplinas = listarDisciplinas().length;

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="flex items-center gap-2 text-lg font-bold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-marca-600 text-white">
            <GraduationCap className="h-5 w-5" />
          </span>
          Concurso Boy
        </span>
        <div className="flex items-center gap-2">
          <AlternarTema />
          <LinkBotao href="/entrar" variante="fantasma">
            Entrar
          </LinkBotao>
          <LinkBotao href="/cadastrar">Criar conta</LinkBotao>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-6 pb-16 pt-12 text-center sm:pt-20">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl dark:text-white">
          Tudo o que você precisa para <span className="text-marca-600">passar no concurso</span>, num só lugar.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600 dark:text-slate-400">
          Questões comentadas com filtros completos, simulados, teoria, plano de estudos, revisões e estatísticas do seu desempenho.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <LinkBotao href="/cadastrar" tamanho="lg">
            Começar a estudar
          </LinkBotao>
          <LinkBotao href="/entrar" tamanho="lg" variante="secundario">
            Já tenho conta
          </LinkBotao>
        </div>
        {total > 0 && (
          <p className="mt-6 text-sm text-slate-500">
            {total.toLocaleString("pt-BR")} questões em {disciplinas} disciplinas
          </p>
        )}
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-24 sm:grid-cols-2 lg:grid-cols-3">
        {RECURSOS.map(({ icone: Icone, titulo, texto }) => (
          <div key={titulo} className="cartao p-5">
            <Icone className="mb-3 h-6 w-6 text-marca-600" />
            <h2 className="font-semibold">{titulo}</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{texto}</p>
          </div>
        ))}
      </section>
      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500 dark:border-slate-800">
        Concurso Boy · <Link href="/entrar">Entrar</Link>
      </footer>
    </div>
  );
}
