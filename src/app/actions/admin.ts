"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { iaDisponivel, extrairQuestoesComIA } from "@/lib/ia";
import { csvParaQuestoes, importarLote, lerCsv, LoteImportacao, prepararQuestao, type QuestaoImportacao, type ResultadoImportacao } from "@/lib/importacao";
import { aplicarGabarito, extrairGabarito, extrairQuestoesDoTexto } from "@/lib/pdf-parser";
import { textoDoPdf } from "@/lib/pdf-texto";
import { listarDisciplinas } from "@/lib/taxonomia";
import { slugify } from "@/lib/utils";

// --- Questões -------------------------------------------------------------------

export type EstadoQuestao = { erro?: string } | undefined;

export async function salvarQuestao(_: EstadoQuestao, form: FormData): Promise<EstadoQuestao> {
  await exigirAdmin();
  const id = Number(form.get("id")) || null;
  const letras = ["A", "B", "C", "D", "E", "F"];
  const tipo = String(form.get("tipo"));
  const dados: QuestaoImportacao = {
    disciplina: String(form.get("disciplina") ?? ""),
    assunto: String(form.get("assunto") ?? ""),
    tipo,
    texto_base: String(form.get("texto_base") ?? ""),
    enunciado: String(form.get("enunciado") ?? ""),
    alternativas:
      tipo === "multipla"
        ? letras.map((l) => ({ letra: l, texto: String(form.get(`alt_${l}`) ?? "") })).filter((a) => a.texto.trim())
        : [],
    gabarito: String(form.get("gabarito") ?? ""),
    comentario: String(form.get("comentario") ?? ""),
    dificuldade: String(form.get("dificuldade") ?? ""),
    anulada: form.get("anulada") === "on",
    desatualizada: form.get("desatualizada") === "on",
    banca: String(form.get("banca") ?? ""),
    orgao: String(form.get("orgao") ?? ""),
    orgao_nome: String(form.get("orgao_nome") ?? ""),
    cargo: String(form.get("cargo") ?? ""),
    ano: String(form.get("ano") ?? ""),
    escolaridade: String(form.get("escolaridade") ?? ""),
    fonte: String(form.get("fonte") ?? ""),
    numero: String(form.get("numero") ?? ""),
  };
  if (!id) {
    const r = importarLote([dados]);
    if (r.erros.length) return { erro: r.erros[0].mensagem };
    if (r.duplicadas) return { erro: "Já existe uma questão com o mesmo enunciado e alternativas." };
    revalidatePath("/admin/questoes");
    redirect(`/questoes/${r.ids[0]}`);
  }
  const r = prepararQuestao(dados);
  if ("erro" in r) return { erro: r.erro };
  try {
    db()
      .prepare(
        `UPDATE questoes SET prova_id = @prova_id, disciplina_id = @disciplina_id, assunto_id = @assunto_id, numero = @numero,
           tipo = @tipo, texto_base = @texto_base, enunciado = @enunciado, alternativas = @alternativas, gabarito = @gabarito,
           comentario = @comentario, dificuldade = @dificuldade, anulada = @anulada, desatualizada = @desatualizada,
           fonte = @fonte, hash = @hash WHERE id = @id`,
      )
      .run({ ...r.linha, id });
  } catch {
    return { erro: "Já existe outra questão com o mesmo enunciado e alternativas." };
  }
  revalidatePath(`/questoes/${id}`);
  redirect(`/questoes/${id}`);
}

export async function excluirQuestao(form: FormData) {
  await exigirAdmin();
  db().prepare("DELETE FROM questoes WHERE id = ?").run(Number(form.get("id")));
  redirect("/admin/questoes");
}

// --- Importação -----------------------------------------------------------------

export type Previa = {
  ok: true;
  origem: "arquivo" | "pdf" | "ia";
  prova: { banca?: string; orgao?: string; orgao_nome?: string; cargo?: string; ano?: string; escolaridade?: string };
  questoes: (QuestaoImportacao & { _aviso?: string })[];
  avisos: string[];
};
export type RespostaPrevia = Previa | { ok: false; erro: string } | undefined;

const TAMANHO_MAX = 30 * 1024 * 1024;

async function lerArquivo(form: FormData, campo: string): Promise<{ nome: string; buffer: Buffer } | null> {
  const arquivo = form.get(campo);
  if (!(arquivo instanceof File) || arquivo.size === 0) return null;
  if (arquivo.size > TAMANHO_MAX) throw new Error("Arquivo muito grande (máximo de 30 MB).");
  return { nome: arquivo.name, buffer: Buffer.from(await arquivo.arrayBuffer()) };
}

export async function analisarImportacao(_: RespostaPrevia, form: FormData): Promise<RespostaPrevia> {
  await exigirAdmin();
  const modo = String(form.get("modo"));
  try {
    if (modo === "arquivo") {
      const arquivo = await lerArquivo(form, "arquivo");
      const colado = String(form.get("conteudo") ?? "").trim();
      const conteudo = arquivo ? arquivo.buffer.toString("utf8") : colado;
      if (!conteudo) return { ok: false, erro: "Envie um arquivo ou cole o conteúdo." };
      const ehJson = arquivo ? /\.json$/i.test(arquivo.nome) : /^[[{]/.test(conteudo);
      if (ehJson) {
        const lote = LoteImportacao.parse(JSON.parse(conteudo));
        const questoes = (Array.isArray(lote) ? lote : lote.questoes) as QuestaoImportacao[];
        const prova = Array.isArray(lote) ? {} : ((lote.prova ?? {}) as Previa["prova"]);
        return { ok: true, origem: "arquivo", prova, questoes, avisos: [] };
      }
      return { ok: true, origem: "arquivo", prova: {}, questoes: csvParaQuestoes(lerCsv(conteudo)), avisos: [] };
    }

    const prova = await lerArquivo(form, "prova");
    if (!prova) return { ok: false, erro: "Envie o PDF da prova." };
    const gabaritoPdf = await lerArquivo(form, "gabarito");
    const gabaritoTexto = String(form.get("gabarito_texto") ?? "").trim();

    if (modo === "ia") {
      if (!iaDisponivel()) return { ok: false, erro: "Configure ANTHROPIC_API_KEY no servidor para usar a extração com IA." };
      const r = await extrairQuestoesComIA({
        prova: prova.buffer,
        gabarito: gabaritoPdf?.buffer,
        gabaritoTexto,
        disciplinasExistentes: listarDisciplinas().map((d) => d.nome),
        gerarComentarios: form.get("comentarios") === "on",
      });
      return {
        ok: true,
        origem: "ia",
        prova: {
          banca: r.prova.banca ?? undefined,
          orgao: r.prova.orgao ?? undefined,
          cargo: r.prova.cargo ?? undefined,
          ano: r.prova.ano ? String(r.prova.ano) : undefined,
          escolaridade: r.prova.escolaridade ?? undefined,
        },
        questoes: r.questoes,
        avisos: r.questoes.some((q) => !q.gabarito) ? ["Algumas questões ficaram sem gabarito: confira antes de importar."] : [],
      };
    }

    const texto = await textoDoPdf(prova.buffer);
    if (texto.replace(/\s/g, "").length < 200) {
      return { ok: false, erro: "Não foi possível ler texto do PDF (provavelmente é uma imagem escaneada). Use a extração com IA." };
    }
    const { questoes } = extrairQuestoesDoTexto(texto);
    const gabarito = extrairGabarito([gabaritoPdf ? await textoDoPdf(gabaritoPdf.buffer) : "", gabaritoTexto].join("\n"));
    aplicarGabarito(questoes, gabarito);
    const avisos: string[] = [];
    if (!questoes.length) avisos.push("Nenhuma questão foi reconhecida automaticamente. Tente a extração com IA.");
    if (questoes.length && gabarito.size === 0) avisos.push("Nenhum gabarito reconhecido: preencha manualmente ou envie o PDF do gabarito.");
    const semGabarito = questoes.filter((q) => !q.gabarito).length;
    if (gabarito.size > 0 && semGabarito) avisos.push(`${semGabarito} questões ficaram sem gabarito.`);
    return {
      ok: true,
      origem: "pdf",
      prova: {},
      questoes: questoes.map((q) => ({
        numero: q.numero,
        tipo: q.tipo,
        texto_base: q.texto_base,
        enunciado: q.enunciado,
        alternativas: q.alternativas,
        gabarito: q.gabarito === "X" ? "X" : q.gabarito,
      })),
      avisos,
    };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Falha ao processar o arquivo." };
  }
}

export async function confirmarImportacao(json: string): Promise<ResultadoImportacao | { erro: string }> {
  await exigirAdmin();
  try {
    const r = importarLote(JSON.parse(json));
    revalidatePath("/", "layout");
    return r;
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Dados inválidos." };
  }
}

// --- Taxonomia ------------------------------------------------------------------

export async function salvarDisciplina(form: FormData) {
  await exigirAdmin();
  const id = Number(form.get("id")) || null;
  const nome = String(form.get("nome") ?? "").trim();
  const cor = /^#[0-9a-f]{6}$/i.test(String(form.get("cor"))) ? String(form.get("cor")) : "#6366f1";
  if (!nome) return;
  if (id) db().prepare("UPDATE disciplinas SET nome = ?, cor = ? WHERE id = ?").run(nome, cor, id);
  else {
    let slug = slugify(nome);
    if (db().prepare("SELECT 1 FROM disciplinas WHERE slug = ?").get(slug)) slug += "-" + Date.now().toString(36);
    db().prepare("INSERT OR IGNORE INTO disciplinas (nome, slug, cor) VALUES (?, ?, ?)").run(nome, slug, cor);
  }
  revalidatePath("/admin/taxonomia");
}

export async function excluirDisciplina(form: FormData) {
  await exigirAdmin();
  const id = Number(form.get("id"));
  const n = (db().prepare("SELECT count(*) AS n FROM questoes WHERE disciplina_id = ?").get(id) as { n: number }).n;
  if (n > 0) return; // A interface só oferece exclusão para disciplinas vazias.
  db().prepare("DELETE FROM disciplinas WHERE id = ?").run(id);
  revalidatePath("/admin/taxonomia");
}

export async function moverQuestoesDisciplina(form: FormData) {
  await exigirAdmin();
  const origem = Number(form.get("origem"));
  const destino = Number(form.get("destino"));
  if (!origem || !destino || origem === destino) return;
  db().transaction(() => {
    db().prepare("UPDATE assuntos SET disciplina_id = ? WHERE disciplina_id = ?").run(destino, origem);
    db().prepare("UPDATE questoes SET disciplina_id = ? WHERE disciplina_id = ?").run(destino, origem);
    db().prepare("UPDATE materiais SET disciplina_id = ? WHERE disciplina_id = ?").run(destino, origem);
    db().prepare("DELETE FROM disciplinas WHERE id = ?").run(origem);
  })();
  revalidatePath("/admin/taxonomia");
}

export async function salvarAssunto(form: FormData) {
  await exigirAdmin();
  const id = Number(form.get("id")) || null;
  const nome = String(form.get("nome") ?? "").trim();
  if (!nome) return;
  if (id) db().prepare("UPDATE assuntos SET nome = ? WHERE id = ?").run(nome, id);
  else {
    const disciplina = Number(form.get("disciplina"));
    const pai = Number(form.get("pai")) || null;
    const ordem = (
      db().prepare("SELECT count(*) AS n FROM assuntos WHERE disciplina_id = ? AND ifnull(parent_id, 0) = ?").get(disciplina, pai ?? 0) as { n: number }
    ).n;
    db().prepare("INSERT OR IGNORE INTO assuntos (disciplina_id, parent_id, nome, ordem) VALUES (?, ?, ?, ?)").run(disciplina, pai, nome, ordem);
  }
  revalidatePath("/admin/taxonomia");
}

export async function excluirAssunto(form: FormData) {
  await exigirAdmin();
  db().prepare("DELETE FROM assuntos WHERE id = ?").run(Number(form.get("id")));
  revalidatePath("/admin/taxonomia");
}

export async function salvarBanca(form: FormData) {
  await exigirAdmin();
  db().prepare("UPDATE bancas SET sigla = ?, nome = ? WHERE id = ?").run(String(form.get("sigla")).trim(), String(form.get("nome")).trim(), Number(form.get("id")));
  revalidatePath("/admin/taxonomia");
}

export async function salvarOrgao(form: FormData) {
  await exigirAdmin();
  const esfera = String(form.get("esfera"));
  db()
    .prepare("UPDATE orgaos SET sigla = ?, nome = ?, esfera = ?, uf = ? WHERE id = ?")
    .run(
      String(form.get("sigla")).trim(),
      String(form.get("nome")).trim(),
      ["federal", "estadual", "municipal"].includes(esfera) ? esfera : null,
      String(form.get("uf") ?? "").trim().toUpperCase().slice(0, 2) || null,
      Number(form.get("id")),
    );
  revalidatePath("/admin/taxonomia");
}

// --- Reportes e usuários --------------------------------------------------------

export async function resolverReporte(form: FormData) {
  await exigirAdmin();
  db().prepare("UPDATE reportes SET status = 'resolvido' WHERE id = ?").run(Number(form.get("id")));
  revalidatePath("/admin/reportes");
  revalidatePath("/admin");
}

export async function alterarPapel(form: FormData) {
  const admin = await exigirAdmin();
  const id = Number(form.get("id"));
  if (id === admin.id) return; // Evita que o admin remova o próprio acesso.
  const papel = form.get("papel") === "admin" ? "admin" : "aluno";
  db().prepare("UPDATE usuarios SET papel = ? WHERE id = ?").run(papel, id);
  revalidatePath("/admin/usuarios");
}
