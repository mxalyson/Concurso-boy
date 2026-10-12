import { exigirAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatarData } from "@/lib/utils";
import { alterarPapel } from "@/app/actions/admin";
import { Botao, Selo } from "@/components/ui";

export const metadata = { title: "Usuários" };

export default async function Usuarios() {
  const admin = await exigirAdmin();
  const usuarios = db()
    .prepare(
      `SELECT u.id, u.nome, u.email, u.papel, u.criado_em,
         (SELECT count(*) FROM respostas r WHERE r.usuario_id = u.id) AS respostas
       FROM usuarios u ORDER BY u.id`,
    )
    .all() as { id: number; nome: string; email: string; papel: string; criado_em: string; respostas: number }[];
  return (
    <div className="cartao overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500 dark:border-slate-800">
            <th className="px-4 py-2">Nome</th>
            <th className="px-4 py-2">E-mail</th>
            <th className="px-4 py-2">Desde</th>
            <th className="px-4 py-2 text-right">Respostas</th>
            <th className="px-4 py-2">Papel</th>
          </tr>
        </thead>
        <tbody>
          {usuarios.map((u) => (
            <tr key={u.id} className="border-b border-slate-50 last:border-0 dark:border-slate-800/50">
              <td className="px-4 py-2">{u.nome}</td>
              <td className="px-4 py-2 text-slate-500">{u.email}</td>
              <td className="px-4 py-2 text-slate-500">{formatarData(u.criado_em)}</td>
              <td className="px-4 py-2 text-right">{u.respostas}</td>
              <td className="px-4 py-2">
                {u.id === admin.id ? (
                  <Selo cor="marca">admin (você)</Selo>
                ) : (
                  <form action={alterarPapel} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={u.id} />
                    <input type="hidden" name="papel" value={u.papel === "admin" ? "aluno" : "admin"} />
                    <Selo cor={u.papel === "admin" ? "marca" : "cinza"}>{u.papel}</Selo>
                    <Botao variante="fantasma" tamanho="sm">
                      {u.papel === "admin" ? "Tornar aluno" : "Tornar admin"}
                    </Botao>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
