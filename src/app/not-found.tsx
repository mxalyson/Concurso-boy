import Link from "next/link";

export default function NaoEncontrado() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-5xl font-bold text-marca-600">404</p>
      <h1 className="text-xl font-semibold">Página não encontrada</h1>
      <Link href="/painel" className="text-sm text-marca-600 underline">
        Voltar ao painel
      </Link>
    </div>
  );
}
