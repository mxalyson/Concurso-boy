import { FormAuth } from "@/components/form-auth";

export const metadata = { title: "Entrar" };

export default async function Entrar({ searchParams }: { searchParams: Promise<{ destino?: string }> }) {
  const { destino } = await searchParams;
  return <FormAuth modo="entrar" destino={destino} />;
}
