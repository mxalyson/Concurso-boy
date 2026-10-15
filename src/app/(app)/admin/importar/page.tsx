import { iaDisponivel } from "@/lib/ia";
import { listarDisciplinas } from "@/lib/taxonomia";
import { Importador } from "@/components/admin/importador";

export const metadata = { title: "Importar provas" };

export default function ImportarProvas() {
  return (
    <>
      <p className="mb-4 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
        Importe provas oficiais (novas ou antigas) para o banco. Todo conteúdo passa por uma tela de revisão antes de ser gravado, e questões repetidas são
        ignoradas automaticamente. Também é possível importar pela linha de comando: <code>npm run import -- arquivo.json</code>.
      </p>
      <Importador disciplinas={listarDisciplinas().map((d) => d.nome)} iaAtiva={iaDisponivel()} />
    </>
  );
}
