import { User } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { FormConta } from "@/components/form-conta";
import { CabecalhoPagina } from "@/components/ui";

export const metadata = { title: "Minha conta" };

export default async function PaginaConta() {
  const u = await exigirUsuario();
  return (
    <>
      <CabecalhoPagina titulo="Minha conta" icone={<User className="h-5 w-5" />} />
      <FormConta nome={u.nome} email={u.email} meta={u.meta_diaria} />
    </>
  );
}
