import { exigirUsuario } from "@/lib/auth";
import { resumoUsuario } from "@/lib/estatisticas";
import { MenuLateral } from "@/components/menu-lateral";

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const usuario = await exigirUsuario();
  const resumo = resumoUsuario(usuario.id);
  return (
    <div className="min-h-screen">
      <MenuLateral nome={usuario.nome} admin={usuario.papel === "admin"} pendencias={resumo.revisoes + resumo.flashcardsVencidos} />
      <main className="lg:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
