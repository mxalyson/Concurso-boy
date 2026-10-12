# Monta o lote de importação de uma prova de múltipla escolha (FGV, FCC...).
# Uso: python3 montar_me.py config.json questoes.json gabarito.txt saida.json
import json, re, sys

cfg = json.load(open(sys.argv[1], encoding="utf8"))
questoes = {q["numero"]: q for q in json.load(open(sys.argv[2], encoding="utf8"))}
gab_txt = open(sys.argv[3], encoding="utf8").read()

# Recorta a seção do gabarito (do título informado até o próximo título).
linhas = gab_txt.splitlines()
inicio = next(i for i, l in enumerate(linhas) if re.search(cfg["gabarito_secao"], l))
trecho = []
for l in linhas[inicio + 1 :]:
    if re.search(r"TIPO \d|Tipo \d|Cargo", l) and trecho:
        break
    trecho.append(l)
gab = {}
nums = None
for l in trecho:
    t = l.split()
    if t and all(x.isdigit() for x in t):
        nums = [int(x) for x in t]
    elif t and nums and all(re.fullmatch(r"[A-E*X]|ANULADA", x) for x in t):
        if len(t) == len(nums):
            gab.update(dict(zip(nums, t)))
        nums = None

def faixa(lista, n):
    for f in lista:
        if f["itens"][0] <= n <= f["itens"][1]:
            return f
    return None

excluir = set()
for e in cfg.get("excluir", []):
    excluir.update(range(e[0], e[1] + 1) if isinstance(e, list) else [e])

saida, avisos = [], []
for n in sorted(questoes):
    if n in excluir:
        continue
    q = questoes[n]
    corr = cfg.get("corrigir", {}).get(str(n), {})
    if q.get("problema") and not corr:
        avisos.append(f"{n}: {q['problema']} (não excluída!)")
    c = faixa(cfg["classificacao"], n)
    if not c:
        avisos.append(f"{n}: sem classificação")
        continue
    g = gab.get(n)
    if not g:
        avisos.append(f"{n}: sem gabarito")
        continue
    b = faixa(cfg.get("bases", []), n)
    base = corr.get("texto_base", b["texto_base"] if b else q.get("texto_base"))
    saida.append({
        "numero": n,
        "disciplina": c["disciplina"],
        "assunto": c.get("assunto"),
        "tipo": "multipla",
        "texto_base": base,
        "enunciado": corr.get("enunciado", q["enunciado"]),
        "alternativas": corr.get("alternativas", q["alternativas"]),
        "gabarito": "X" if g in ("*", "X", "ANULADA") else g,
        "desatualizada": n in set(cfg.get("desatualizadas", [])),
        "fonte": f"{cfg['fonte']}, questão {n}",
    })

json.dump({"prova": cfg["prova"], "questoes": saida}, open(sys.argv[4], "w", encoding="utf8"), ensure_ascii=False, indent=1)
print(f"{len(saida)} questões ({sum(1 for q in saida if q['gabarito'] == 'X')} anuladas); gabarito da seção: {len(gab)} respostas")
for a in avisos:
    print("AVISO", a)
