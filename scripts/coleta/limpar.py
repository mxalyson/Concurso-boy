# Arruma data/provas e data/imagens depois das importações:
#   - remove lotes automáticos (cebraspe-auto-*) que duplicam uma prova já presente por outra
#     fonte (revisada à mão ou Quest API): mesmo órgão, ano e cargo;
#   - apaga pastas/arquivos de imagens que nenhum lote usa.
# Uso: python3 limpar.py [--aplicar]   (sem --aplicar, só mostra o que faria)
import gzip, json, os, re, shutil, sys, unicodedata

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PROVAS = os.path.join(RAIZ, "data", "provas")
IMAGENS = os.path.join(RAIZ, "data", "imagens")
aplicar = "--aplicar" in sys.argv


def ler(nome):
    caminho = os.path.join(PROVAS, nome)
    with (gzip.open(caminho, "rt", encoding="utf8") if nome.endswith(".gz") else open(caminho, encoding="utf8")) as f:
        return json.load(f)


def norm(t):
    t = unicodedata.normalize("NFD", str(t or "")).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", t).strip()


lotes = {n: ler(n) for n in sorted(os.listdir(PROVAS)) if re.search(r"\.json(\.gz)?$", n)}
chave = lambda p: (norm(p.get("orgao")), str(p.get("ano")), norm(p.get("cargo")))
outras = {chave(l["prova"]) for n, l in lotes.items() if not n.startswith("cebraspe-auto-")}
duplicados = [n for n, l in lotes.items() if n.startswith("cebraspe-auto-") and chave(l["prova"]) in outras]
for n in duplicados:
    print("duplicado:", n)
    if aplicar:
        os.remove(os.path.join(PROVAS, n))
        del lotes[n]

usadas = {i["src"] for l in lotes.values() for q in l["questoes"] for i in q.get("imagens") or []}
pastas_usadas = {s.split("/")[0] for s in usadas}
orfas = 0
for pasta in sorted(os.listdir(IMAGENS)):
    caminho = os.path.join(IMAGENS, pasta)
    if not os.path.isdir(caminho):
        continue
    if pasta not in pastas_usadas and pasta != "quest":
        orfas += len(os.listdir(caminho))
        if aplicar:
            shutil.rmtree(caminho)
        continue
    for raiz, _, arquivos in os.walk(caminho):
        for a in arquivos:
            rel = os.path.relpath(os.path.join(raiz, a), IMAGENS).replace(os.sep, "/")
            if rel not in usadas:
                orfas += 1
                if aplicar:
                    os.remove(os.path.join(raiz, a))
print(f"{len(duplicados)} lotes duplicados, {orfas} imagens órfãs" + ("" if aplicar else " (use --aplicar para remover)"))
