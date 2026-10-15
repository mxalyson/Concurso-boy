# Corrige a disciplina dos lotes automáticos já gerados quando ela veio do nome do cargo
# ("Analista", "Cargo 4", "Emprego 5"...): profissão vira matéria e nomes genéricos são
# reclassificados pelo conteúdo da questão. Uso: python3 reclassificar.py [padrão]
import glob, gzip, json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from classificar import DISCIPLINAS, PROFISSOES, disciplina_da_especialidade, disciplina_de

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CONHECIDAS = {d for d, _ in DISCIPLINAS} | {d for _, d in PROFISSOES} | {"Conhecimentos Específicos"}
padrao = sys.argv[1] if len(sys.argv) > 1 else "*-auto-*.json.gz"
mudadas = arquivos = 0
for arq in sorted(glob.glob(os.path.join(RAIZ, "data", "provas", padrao))):
    lote = json.load(gzip.open(arq, "rt", encoding="utf8"))
    alterou = False
    for q in lote["questoes"]:
        d = q.get("disciplina") or ""
        if d in CONHECIDAS:
            continue
        nova = disciplina_da_especialidade(d)
        if not nova:
            texto = " ".join([q.get("texto_base") or "", q["enunciado"], " ".join(a["texto"] for a in q.get("alternativas") or [])])
            nova = disciplina_de(texto, (q.get("texto_base") or "")[-400:] + " " + q["enunciado"][:300], 2) or "Conhecimentos Específicos"
        if nova != d:
            if not q.get("assunto"):
                q["assunto"] = None
            q["disciplina"] = nova
            mudadas += 1
            alterou = True
    if alterou:
        arquivos += 1
        with gzip.open(arq, "wt", encoding="utf8", compresslevel=9) as f:
            json.dump(lote, f, ensure_ascii=False, indent=1)
print(f"{mudadas} questões reclassificadas em {arquivos} lotes")
