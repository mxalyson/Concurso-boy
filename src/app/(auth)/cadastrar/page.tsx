import { FormAuth } from "@/components/form-auth";

export const metadata = { title: "Criar conta" };

export default function Cadastrar() {
  return <FormAuth modo="cadastrar" />;
}
