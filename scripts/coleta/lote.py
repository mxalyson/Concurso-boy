# Importação em lote de provas baixadas à mão (site da banca, Gabarite, PCI...): basta pôr numa
# pasta os PDFs das provas e dos gabaritos de um concurso. O script separa provas de gabaritos
# pelo conteúdo, lê os blocos do gabarito (por cargo/tipo, por seção ou em tabela), descobre na
# capa de cada caderno a que bloco ele corresponde (código "F01T", nome do cargo ou nome do
# arquivo), e importa cada par pelo pipeline comum (extração, conferência, figuras ou OCR).
#
# Uso:
#   python3 lote.py PASTA --banca IBADE --orgao "Prefeitura de X/RO" [--ano 2024] [--cargo "..."]
#                   [--banca-nome "..."] [--listar] [--forcar]
# Gera data/provas/lote-<banca>-<órgão>-<cargo>-<hash>.json.gz (rode npm run db:seed depois).
import argparse, difflib, hashlib, os, re, sys, unicodedata

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
from pipeline import detectar_formato, montar, secoes_cargo, secoes_gabarito, tabela_gabarito, texto_pdf  # noqa: E402
from ibade import titulo  # noqa: E402

RAIZ = os.path.abspath(os.path.join(AQUI, "..", ".."))


def norm(t):
    t = unicodedata.normalize("NFD", str(t or "")).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", t).strip()


def capa(pdf, paginas=2):
    t = texto_pdf(pdf, layout=False, paginas=paginas)
    if len(re.sub(r"\s+", "", t)) < 300:
        from ocr import ocr
        t = ocr(pdf, 200, paginas=1)
    return t


def eh_gabarito(pdf, nome):
    t = texto_pdf(pdf, layout=True, paginas=3)
    linhas_letras = sum(1 for l in t.splitlines() if len(l.split()) >= 5 and all(re.fullmatch(r"[A-Ea-e*X]|C|E", x) for x in l.split()))
    pares = len(re.findall(r"\b\d{1,3}\s*[-–.:)]\s*[A-E*X]\b", t))
    return ("gabarit" in norm(nome) or "gabarit" in norm(t[:600])) and (linhas_letras >= 2 or pares >= 10 or "Cargo:" in t)


def blocos_gabarito(pdf, nome):
    """[{cargo, codigo, tipo, gab, disciplinas, arquivo}] de um PDF de gabarito."""
    txt = texto_pdf(pdf)
    blocos = secoes_cargo(txt)
    if blocos:
        return [{**b, "arquivo": pdf} for b in blocos]
    gab = tabela_gabarito(txt)
    if len(gab) >= 10:
        return [{"cargo": None, "codigo": None, "tipo": None, "gab": gab, "disciplinas": {}, "arquivo": pdf}]
    secoes = secoes_gabarito(txt)
    # várias seções com numeração contínua = um só caderno; numeração recomeçando = cargos diferentes
    saida, atual = [], None
    for titulo, g in secoes:
        if atual and min(g) > max(atual["gab"]):
            atual["gab"].update(g)
            atual["disciplinas"].update({n: titulo for n in g} if titulo else {})
            continue
        atual = {"cargo": titulo, "codigo": None, "tipo": None, "gab": dict(g), "disciplinas": {}, "arquivo": pdf}
        saida.append(atual)
    return [b for b in saida if len(b["gab"]) >= 10]


def identificar(pdf, blocos):
    """Bloco do gabarito correspondente a um caderno: código+tipo na capa, depois nome do cargo."""
    t = capa(pdf)
    tn, nome = norm(t), norm(os.path.basename(pdf))
    codigos = re.findall(r"\b([A-Z]{1,3}\d{2,3})\s*-?\s*([A-Z])?\b", t.upper()) + re.findall(r"\b([a-z]{1,3}\d{2,3})[ _-]*([a-z])?\b", nome)
    for cod, tipo in codigos:
        cands = [b for b in blocos if (b["codigo"] or "").upper() == cod.upper()]
        if cands:
            return next((b for b in cands if tipo and (b["tipo"] or "").upper() == tipo.upper()), None) or (cands[0] if len(cands) == 1 or not tipo else None)
    m = re.search(r"\bTIPO\s*:?\s*([A-Z0-9])\b", t.upper())
    tipo = m.group(1) if m else None
    nomeados = [(len(norm(b["cargo"])), b) for b in blocos if b["cargo"] and len(norm(b["cargo"])) > 3 and (norm(b["cargo"]) in tn or norm(b["cargo"]) in nome)]
    if nomeados:
        maior = max(n for n, _ in nomeados)
        cands = [b for n, b in nomeados if n == maior]
        return next((b for b in cands if tipo and b["tipo"] == tipo), cands[0])
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pasta")
    ap.add_argument("--banca", required=True)
    ap.add_argument("--banca-nome")
    ap.add_argument("--orgao", required=True)
    ap.add_argument("--orgao-nome")
    ap.add_argument("--ano", type=int)
    ap.add_argument("--cargo", help="cargo (quando a pasta tem um só caderno)")
    ap.add_argument("--fonte", help="texto da fonte (padrão: banca — órgão — cargo)")
    ap.add_argument("--listar", action="store_true")
    ap.add_argument("--forcar", action="store_true")
    ap.add_argument("--saida", default=os.path.join(RAIZ, "data", "provas"))
    ap.add_argument("--imagens", default=os.path.join(RAIZ, "data", "imagens"))
    args = ap.parse_args()

    pdfs = sorted(os.path.join(args.pasta, f) for f in os.listdir(args.pasta) if f.lower().endswith(".pdf"))
    gabaritos, provas = [], []
    for p in pdfs:
        (gabaritos if eh_gabarito(p, os.path.basename(p)) else provas).append(p)
    # gabarito definitivo/final antes do preliminar
    gabaritos.sort(key=lambda p: (1 if "prelim" in norm(p) else 0, p))
    blocos = []
    for g in gabaritos:
        novos = blocos_gabarito(g, os.path.basename(g))
        chaves = {(b["codigo"], b["cargo"], b["tipo"]) for b in blocos}
        blocos += [b for b in novos if (b["codigo"], b["cargo"], b["tipo"]) not in chaves]
    print(f"{len(provas)} provas, {len(gabaritos)} gabaritos, {len(blocos)} blocos de gabarito")
    if not blocos:
        sys.exit("nenhum gabarito reconhecido")

    pares, usados = [], set()
    for p in provas:
        b = blocos[0] if len(blocos) == 1 and len(provas) == 1 else identificar(p, blocos)
        if not b and len(blocos) == len(provas):  # mesmo número: pelo nome dos arquivos
            restantes = [x for x in blocos if id(x) not in usados]
            b = max(restantes, key=lambda x: difflib.SequenceMatcher(None, norm(p), norm(x["arquivo"]) + " " + norm(x["cargo"])).ratio(), default=None)
        if not b:
            print(f"[sem-gabarito] {os.path.basename(p)}")
            continue
        chave = b["codigo"] or b["cargo"] or id(b)
        if chave in usados:
            print(f"[repetida] {os.path.basename(p)} (outro tipo do mesmo cargo)")
            continue
        usados.add(chave)
        usados.add(id(b))
        pares.append((p, b))

    resumo = {}
    for p, b in pares:
        cargo = args.cargo or (b["cargo"] and titulo(b["cargo"])) or os.path.splitext(os.path.basename(p))[0]
        if b.get("codigo") and b["codigo"] not in cargo:
            cargo += f" ({b['codigo']})"
        ano = args.ano or (int(b["data"][:4]) if b.get("data") else None)
        if not ano:
            m = re.search(r"\b(20[0-3]\d|199\d)\b", capa(p, 1))
            ano = int(m.group(1)) if m else None
        h = hashlib.sha1(f"{args.banca}|{args.orgao}|{ano}|{cargo}".encode()).hexdigest()[:6]
        nome = re.sub(r"-+", "-", f"lote-{norm(args.banca)}-{norm(args.orgao)[:30]}-{norm(cargo)[:30]}-{h}".replace(" ", "-"))
        if args.listar:
            print(f"[par] {os.path.basename(p)} <- {os.path.basename(b['arquivo'])} :: {cargo} ({len(b['gab'])} questões) -> {nome}")
            continue
        if os.path.exists(os.path.join(args.saida, nome + ".json.gz")) and not args.forcar:
            print(f"[existente] {nome}")
            continue
        meta = {"banca": args.banca, "banca_nome": args.banca_nome or args.banca, "orgao": args.orgao, "orgao_nome": args.orgao_nome or args.orgao,
                "cargo": cargo, "ano": ano, "data": b.get("data"), "origem": "automatica",
                "fonte": args.fonte or f"{args.banca} — {args.orgao} — {cargo}"}
        formato = detectar_formato(texto_pdf(p, layout=False), b["gab"])
        status, msg, _ = montar(p, b["gab"], meta, formato, args.saida, args.imagens, nome, especialidade=cargo, disciplinas=b["disciplinas"])
        resumo[status] = resumo.get(status, 0) + 1
        print(f"[{status}] {os.path.basename(p)}: {msg}")
    print("resumo:", resumo)


if __name__ == "__main__":
    main()
