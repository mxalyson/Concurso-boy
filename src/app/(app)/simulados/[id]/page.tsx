import { notFound, redirect } from "next/navigation";
import { exigirUsuario } from "@/lib/auth";
import { obterQuestoesPorIds, resumir } from "@/lib/questoes";
import { corrigirSimulado, itensSimulado, obterSimulado, prazoSimulado } from "@/lib/simulados";
import { ExecucaoSimulado } from "@/components/simulado/execucao-simulado";

export const metadata = { title: "Simulado em andamento" };

export default async function PaginaSimulado({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirUsuario();
  const id = Number((await params).id);
  const simulado = obterSimulado(id, usuario.id);
  if (!simulado) notFound();
  if (simulado.finalizado_em) redirect(`/simulados/${id}/resultado`);
  const prazo = prazoSimulado(simulado);
  if (Date.now() > prazo + 60_000) {
    corrigirSimulado(simulado);
    redirect(`/simulados/${id}/resultado`);
  }
  const itens = itensSimulado(id);
  const questoes = new Map(obterQuestoesPorIds(itens.map((i) => i.questao_id), usuario.id).map((q) => [q.id, resumir(q)]));
  return (
    <ExecucaoSimulado
      id={id}
      titulo={simulado.titulo}
      prazo={prazo}
      itens={itens.filter((i) => questoes.has(i.questao_id)).map((i) => ({ ordem: i.ordem, resposta: i.resposta, questao: questoes.get(i.questao_id)! }))}
    />
  );
}
