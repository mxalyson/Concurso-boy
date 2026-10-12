import { db } from "./db";
import { assuntosIndentados, listarAnos, listarAssuntos, listarBancas, listarDisciplinas, listarOrgaos } from "./taxonomia";
import type { OpcoesFiltro } from "@/components/questao/painel-filtros";

export function carregarOpcoesFiltro(usuarioId: number): OpcoesFiltro {
  return {
    disciplinas: listarDisciplinas(),
    assuntos: assuntosIndentados(listarAssuntos()).map(({ id, disciplina_id, nome, nivel }) => ({ id, disciplina_id, nome, nivel })),
    bancas: listarBancas(),
    orgaos: listarOrgaos(),
    anos: listarAnos(),
    cadernos: db().prepare("SELECT id, nome FROM cadernos WHERE usuario_id = ? ORDER BY nome").all(usuarioId) as { id: number; nome: string }[],
  };
}
