# Monta o JSON de importação a partir dos itens extraídos, do gabarito oficial e de
# uma configuração (classificação por faixa, exclusões e correções manuais).
# Uso: python3 montar.py config.json itens.json gabarito.txt saida.json
import argparse, json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from imagens_lote import anexar_imagens

ap = argparse.ArgumentParser()
ap.add_argument("config"); ap.add_argument("itens"); ap.add_argument("gabarito"); ap.add_argument("saida")
ap.add_argument("--pdf", help="pdf[:primeiro_numero],... para recortar figuras/fórmulas")
ap.add_argument("--imagens", default="data/imagens", help="pasta raiz das imagens")
ap.add_argument("--lixo", default=None, help="regex de cabeçalhos/rodapés a ignorar nos recortes")
args = ap.parse_args()
sys.argv = [sys.argv[0], args.config, args.itens, args.gabarito, args.saida]
cfg = json.load(open(sys.argv[1], encoding="utf8"))
itens = {}
for arq in sys.argv[2].split(","):
    itens.update({x["numero"]: x for x in json.load(open(arq, encoding="utf8"))})
gab_txt = "\n".join(open(a, encoding="utf8").read() for a in sys.argv[3].split(","))

# Gabarito Cebraspe em tabela: linhas "Item 1 2 3..." seguidas de "Gabarito C E X..."
gab = {}
linhas = [l.split() for l in gab_txt.splitlines()]
for i, l in enumerate(linhas):
    if l and l[0].lower() == "item":
        nums = [int(x) for x in l[1:] if x.isdigit()]
        for j in range(i + 1, min(i + 4, len(linhas))):
            if linhas[j] and linhas[j][0].lower() == "gabarito":
                resp = linhas[j][1:]
                if len(resp) == len(nums):
                    gab.update(dict(zip(nums, resp)))
                break

def classificar(n):
    for faixa in cfg["classificacao"]:
        ini, fim = faixa["itens"]
        if ini <= n <= fim:
            return faixa["disciplina"], faixa.get("assunto")
    return None, None

excluir = set()
for e in cfg.get("excluir", []):
    if isinstance(e, list):
        excluir.update(range(e[0], e[1] + 1))
    else:
        excluir.add(e)

saida, avisos = [], []
for n in sorted(itens):
    if n in excluir:
        continue
    x = itens[n]
    corr = cfg.get("corrigir", {}).get(str(n), {})
    base = corr.get("texto_base")
    if base is None:
        for faixa in cfg.get("bases", []):
            if faixa["itens"][0] <= n <= faixa["itens"][1]:
                base = faixa["texto_base"]
    if base is None:
        base = x["texto_base"]
    disc, assunto = classificar(n)
    if not disc:
        avisos.append(f"{n}: sem disciplina")
        continue
    g = gab.get(n)
    if g is None:
        avisos.append(f"{n}: sem gabarito")
        continue
    comentario = corr.get("comentario")
    j = x.get("justificativa")
    enunciado = corr.get("enunciado", x["enunciado"])
    # provas "com justificativa": resposta que vazou para o enunciado (sem o rótulo JUSTIFICATIVA)
    vaz = re.search(r"\s*(?:JUSTIFICATIVA\s*[-–]\s*)?\b((?:CERTO|ERRADO)\.\s[\s\S]*|ITEM ANULADO\.?[\s\S]*)$", enunciado)
    if vaz:
        enunciado = enunciado[: vaz.start()].rstrip()
        if not j and not vaz.group(1).startswith("ITEM"):
            j = vaz.group(1).strip()
    if comentario is None and j and g in ("C", "E"):
        rotulo = re.match(r"^(CERTO|ERRADO)\b\.?\s*", j)
        if rotulo and rotulo.group(1)[0] == g:
            comentario = f"**Justificativa oficial da banca ({cfg['prova']['banca'].title()}):** {j[rotulo.end():].strip()}"
        elif rotulo:
            avisos.append(f"{n}: justificativa ({rotulo.group(1)}) diverge do gabarito definitivo ({g}) — comentário descartado")
    sobrescrito = str(n) in cfg.get("corrigir", {}) or any(f["itens"][0] <= n <= f["itens"][1] for f in cfg.get("bases", []))
    q = {
        "numero": n,
        "problema": None if sobrescrito else x.get("problema"),
        "comentario": comentario,
        "desatualizada": n in set(cfg.get("desatualizadas", [])),
        "disciplina": disc,
        "assunto": assunto,
        "tipo": "certo_errado",
        "texto_base": base,
        "enunciado": enunciado,
        "gabarito": g,
        "fonte": f"{cfg['fonte']}, item {n}",
    }
    saida.append(q)

if args.pdf:
    fontes = [(p.split(":")[0], int(p.split(":")[1]) if ":" in p else 1) for p in args.pdf.split(",")]
    n_img = anexar_imagens(saida, fontes, args.imagens, cfg["slug"], "ce", args.lixo)
    print(f"{n_img} questões com recorte da prova original")
sem_imagem = [q["numero"] for q in saida if q.get("problema") and not q.get("imagens")]
if sem_imagem:
    avisos.append(f"com figura/fórmula mas sem recorte (excluídas): {sem_imagem}")
    saida = [q for q in saida if q["numero"] not in sem_imagem]
for q in saida:
    q.pop("problema", None)
lote = {"prova": cfg["prova"], "questoes": saida}
json.dump(lote, open(sys.argv[4], "w", encoding="utf8"), ensure_ascii=False, indent=1)
anuladas = sum(1 for q in saida if q["gabarito"] == "X")
print(f"{len(saida)} questões ({anuladas} anuladas), gabarito com {len(gab)} itens")
for a in avisos:
    print("AVISO", a)
