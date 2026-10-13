# Importação automática das provas objetivas do IBADE (Instituto Brasileiro de Apoio e
# Desenvolvimento Executivo), publicadas em ibade.org.br/concursos-anteriores/<concurso>/
# provas-e-gabaritos/. Para cada concurso: baixa o gabarito final (após recursos), separa os
# blocos "Cargo: X01 - NOME / Prova: T", escolhe um tipo de prova por cargo, baixa o caderno
# correspondente e importa pelo pipeline comum (extração, conferência, figuras, lote .json.gz).
#
# Uso:
#   python3 ibade.py                         # todos os concursos ainda não processados
#   python3 ibade.py --concursos camara-de-cacoal-ro --processos 4 --forcar
#   python3 ibade.py --novas                 # só concursos ainda não vistos (cron)
import argparse, hashlib, html, json, os, re, subprocess, sys, tempfile, time, unicodedata
from concurrent.futures import ProcessPoolExecutor, as_completed
from html.parser import HTMLParser

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
from pipeline import detectar_formato, montar, secoes_cargo, texto_pdf  # noqa: E402

SITE = "https://ibade.org.br"
RAIZ = os.path.abspath(os.path.join(AQUI, "..", ".."))
CACHE = os.path.join(RAIZ, ".cache", "ibade")
ESTADO = os.environ.get("COLETA_ESTADO_IBADE") or os.path.join(RAIZ, "data", "ibade-estado.json")
BANCA = {"banca": "IBADE", "banca_nome": "Instituto Brasileiro de Apoio e Desenvolvimento Executivo"}
NAO_PROVA = re.compile(r"gabarit|edital|resultado|retifica|aviso|recurso|discursiv|reda[cç]|convoca|homolog|classifica|"
                       r"cronograma|comunicado|errata|inscri|isen[cç]|t[ií]tulo|conven[cç]|laudo|local|ata\b", re.I)


def baixar(url, destino, tentativas=2):
    if os.path.exists(destino) and os.path.getsize(destino) > 0:
        return True
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    for i in range(tentativas):
        r = subprocess.run(["curl", "-sS", "-f", "-L", "-m", "180", "-o", destino + ".tmp", url], capture_output=True)
        if r.returncode == 0 and os.path.getsize(destino + ".tmp") > 0:
            os.replace(destino + ".tmp", destino)
            return True
        time.sleep(2 * (i + 1))
    return False


def pagina(url, validade_h=24 * 7):
    arq = os.path.join(CACHE, "paginas", hashlib.sha1(url.encode()).hexdigest()[:16] + ".html")
    if not (os.path.exists(arq) and time.time() - os.path.getmtime(arq) < validade_h * 3600):
        if os.path.exists(arq):
            os.remove(arq)
        if not baixar(url, arq):
            return ""
    return open(arq, encoding="utf8", errors="replace").read()


class _Tokens(HTMLParser):
    """Sequência (texto, href) na ordem do documento."""

    def __init__(self):
        super().__init__()
        self.tokens, self._href = [], None

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self._href = dict(attrs).get("href")

    def handle_endtag(self, tag):
        if tag == "a":
            self._href = None

    def handle_data(self, d):
        d = d.strip()
        if d:
            self.tokens.append((d, self._href))


def listar_concursos():
    slugs, vistos = [], set()
    urls = [f"{SITE}/concursos-anteriores/"] + [f"{SITE}/concursos-anteriores/page/{n}/" for n in range(2, 15)]
    urls += [f"{SITE}/concursos-anteriores/ano/{a}/" for a in range(2014, time.localtime().tm_year + 1)]
    for u in urls:
        h = pagina(u, validade_h=24)
        if not h and "/page/" in u:
            continue  # paginação acabou (404)
        for s in re.findall(r"https://ibade\.org\.br/concursos-anteriores/([a-z0-9-]+)/", h):
            if s not in vistos and s not in ("page", "ano"):
                vistos.add(s)
                slugs.append(s)
    return slugs


def links_pdf(h):
    """[(rótulo, url)] dos PDFs da página; o rótulo é o último texto fora de link antes dele."""
    p = _Tokens()
    p.feed(h)
    saida, rotulo = [], ""
    for texto, href in p.tokens:
        if href and re.search(r"\.pdf($|\?)", href, re.I):
            if href not in {u for _, u in saida}:
                saida.append((html.unescape(rotulo), href))
        elif not href:
            rotulo = texto
    return saida


def sem_acento(t):
    return unicodedata.normalize("NFD", t).encode("ascii", "ignore").decode()


UFS = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split()
SIGLAS = set(UFS) | {"SAAE", "IPERON", "IAPEN", "EMSERH", "IABAS", "SESACRE", "DETRAN", "PM", "CBM", "IBGE", "UPA", "UPAS", "PSS", "PSI", "ACS",
                     "ACE", "EJA", "DEPASA", "ISEAC", "SANEROM", "PREVES", "IPAM", "SEDUC", "SEE", "CFS", "CHO", "CFC", "TI", "SUS", "PMCE", "PCAC"}


def titulo(t):
    t = re.sub(r"\s+", " ", re.sub(r"\s*/\s*", " / ", html.unescape(t))).strip(" -–:")
    pequenas = {"de", "da", "do", "das", "dos", "e", "em", "na", "no", "a", "o", "para", "com"}
    palavras = []
    for i, p in enumerate(t.split(" ")):
        if p.strip("/()") in SIGLAS or re.fullmatch(r"[IVX]+|[A-Z]+\d+", p.strip("/()")):
            palavras.append(p)  # siglas (RO, ES, PM, SAAE...)
        elif p.lower() in pequenas and i:
            palavras.append(p.lower())
        else:
            palavras.append(p[:1].upper() + p[1:].lower())
    return " ".join(palavras).replace(" / ", "/")


def codigo_tipo(rotulo, url):
    """(código do cargo, tipo da prova) pelo rótulo do link ou pelo nome do arquivo."""
    m = re.match(r"\s*([A-Z]{1,3}\d{2,3})\s*[-–]?\s*([A-Z])\b", rotulo)
    if m:
        return m.group(1), m.group(2)
    arq = url.rsplit("/", 1)[-1]
    m = re.search(r"(?:^|[_-])([A-Z]{1,3}\d{2,3})[_-]+([A-Z])(?:[_-]|\.pdf)", arq)
    if m:
        return m.group(1), m.group(2)
    m = re.search(r"(?:^|[_\s-])([A-Z]{1,3}\d{2,3})(?:[_\s-]|\.pdf)", rotulo + " " + arq)
    return (m.group(1), None) if m else (None, None)


def capa(pdf):
    """Código e tipo pelo texto da primeira página ("CÓDIGO DA PROVA F01T", "Tipo X")."""
    t = sem_acento(texto_pdf(pdf, layout=False, paginas=1)).upper()
    m = re.search(r"CODIGO DA PROVA\s*:?\s*([A-Z]{1,3}\d{2,3})\s*-?\s*([A-Z])\b", t)
    if m:
        return m.group(1), m.group(2)
    m = re.search(r"\b([A-Z]\d{2})\s*-?\s*([TVWXYZ])\b", t)
    return (m.group(1), m.group(2)) if m else (None, None)


def prioridade_gabarito(rotulo, url):
    s = sem_acento(rotulo + " " + url.rsplit("/", 1)[-1]).lower()
    if not re.search(r"gabarit", s) or re.search(r"prelimin|discursiv|curso.de.formacao", s):
        return None
    if re.search(r"retific|republic|atualizad|ajustad|acertad", s):
        return 0
    if re.search(r"final|definitiv|apos|ap.s|recurso", s):
        return 1
    return 2


def processar(slug, pasta_saida, pasta_imagens, forcar=False, so_listar=False):
    base = f"{SITE}/concursos-anteriores/{slug}/"
    h = pagina(base + "provas-e-gabaritos/")
    links = links_pdf(h)
    if not links:
        return slug, [("sem-provas", "página sem PDFs")]
    nome_pag = re.search(r"<h1[^>]*>([^<]+)", h) or re.search(r"<title>([^<]+?)(?: - Ibade)?</title>", h)
    concurso = html.unescape(nome_pag.group(1)).strip() if nome_pag else slug
    pasta = os.path.join(CACHE, "pdf", slug)

    gabaritos = sorted((p, i, r, u) for i, (r, u) in enumerate(links) if (p := prioridade_gabarito(r, u)) is not None)
    blocos = {}
    for _, _, rotulo, url in gabaritos:
        arq = os.path.join(pasta, "gab-" + hashlib.sha1(url.encode()).hexdigest()[:8] + ".pdf")
        if not baixar(url, arq):
            continue
        txt = texto_pdf(arq)
        for b in secoes_cargo(txt):
            chave = (b["codigo"] or b["cargo"], b["tipo"])
            if chave not in blocos:
                b["url"] = url
                b["orgao"] = next((l.strip() for l in txt.splitlines() if l.strip()), concurso)
                blocos[chave] = b
    if not blocos:
        return slug, [("sem-gabarito", "gabarito final não encontrado/legível")]

    provas = [(r, u) for r, u in links if prioridade_gabarito(r, u) is None and not NAO_PROVA.search(sem_acento(r + " " + u.rsplit("/", 1)[-1]))]
    # cargo/tipo de cada caderno: pelo rótulo/arquivo; se faltar, pela capa (exige baixar)
    cadernos = {}
    for rotulo, url in provas:
        cod, tipo = codigo_tipo(rotulo, url)
        cadernos.setdefault((cod, tipo), (rotulo, url))
    resultados = []
    feitos = set()
    for (cod, tipo), b in sorted(blocos.items(), key=lambda kv: (kv[0][0] or "", kv[0][1] or "")):
        if cod in feitos:
            continue
        alvo = cadernos.get((cod, tipo)) or (cadernos.get((cod, None)) if tipo is None or not any(k[0] == cod and k[1] for k in cadernos) else None)
        if not alvo:
            continue
        feitos.add(cod)
        resultados.append(importar(slug, concurso, b, alvo[1], pasta, pasta_saida, pasta_imagens, forcar, so_listar))
    # cadernos sem código no rótulo: identifica pela capa
    sem_codigo = [(r, u) for (c, t), (r, u) in cadernos.items() if c is None]
    for rotulo, url in sem_codigo:
        arq = os.path.join(pasta, hashlib.sha1(url.encode()).hexdigest()[:10] + ".pdf")
        if not baixar(url, arq):
            continue
        cod, tipo = capa(arq)
        b = blocos.get((cod, tipo))
        if not b and len(blocos) == 1 and len(sem_codigo) == 1:
            b = next(iter(blocos.values()))
            cod = b["codigo"] or b["cargo"]
        if b and cod not in feitos:
            feitos.add(cod)
            resultados.append(importar(slug, concurso, b, url, pasta, pasta_saida, pasta_imagens, forcar, so_listar))
    faltam = sorted({c for c, _ in blocos} - feitos)
    if faltam:
        resultados.append(("sem-caderno", f"{len(faltam)} cargos sem caderno identificado: {', '.join(map(str, faltam[:8]))}"))
    return slug, resultados


def importar(slug, concurso, b, url, pasta, pasta_saida, pasta_imagens, forcar, so_listar):
    cargo = titulo(b["cargo"])
    nome = f"ibade-{slug[:40]}-{(b['codigo'] or '').lower()}-{hashlib.sha1((slug + (b['codigo'] or b['cargo'])).encode()).hexdigest()[:6]}"
    nome = re.sub(r"-+", "-", nome).strip("-")
    final = os.path.join(pasta_saida, nome + ".json.gz")
    if so_listar:
        return ("listada", f"{nome}: {cargo} ({len(b['gab'])} questões) <- {url}")
    if os.path.exists(final) and not forcar:
        return ("existente", nome)
    pdf = os.path.join(pasta, hashlib.sha1(url.encode()).hexdigest()[:10] + ".pdf")
    if not baixar(url, pdf):
        return ("erro", f"{nome}: falha ao baixar {url}")
    orgao = titulo(re.sub(r"\s*[-–]\s*(DEMAIS CARGOS|SOLDADO|PROCURADORIA|ADMINISTRATIVO.*)$", "", b["orgao"], flags=re.I))
    ano = int(b["data"][:4]) if b.get("data") else (int(m.group(0)) if (m := re.search(r"20[12]\d", concurso)) else None)
    meta = {
        **BANCA,
        "orgao": orgao,
        "orgao_nome": orgao,
        "cargo": f"{cargo} ({b['codigo']})" if b.get("codigo") else cargo,
        "ano": ano,
        "data": b.get("data"),
        "url_prova": url,
        "url_gabarito": b["url"],
        "origem": "automatica",
        "fonte": f"IBADE — {titulo(concurso)} — {cargo}",
    }
    gab = {n: v for n, v in b["gab"].items()}
    formato = detectar_formato(texto_pdf(pdf, layout=False), gab)
    try:
        status, msg, _ = montar(pdf, gab, meta, formato, pasta_saida, pasta_imagens, nome, especialidade=cargo, disciplinas=b["disciplinas"])
    except subprocess.CalledProcessError as e:
        status, msg = "erro", (e.stderr or b"").decode(errors="replace").strip().splitlines()[-1:] or str(e)
    return (status, f"{nome}: {msg}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--concursos", help="slugs separados por vírgula")
    ap.add_argument("--limite", type=int)
    ap.add_argument("--processos", type=int, default=3)
    ap.add_argument("--forcar", action="store_true")
    ap.add_argument("--novas", action="store_true")
    ap.add_argument("--listar", action="store_true", help="só mostra o que seria importado")
    ap.add_argument("--saida", default=os.path.join(RAIZ, "data", "provas"))
    ap.add_argument("--imagens", default=os.path.join(RAIZ, "data", "imagens"))
    args = ap.parse_args()

    os.makedirs(args.saida, exist_ok=True)
    estado = json.load(open(ESTADO, encoding="utf8")) if os.path.exists(ESTADO) else {}
    slugs = args.concursos.split(",") if args.concursos else listar_concursos()
    if args.novas:
        slugs = [s for s in slugs if s not in estado]
    if args.limite:
        slugs = slugs[: args.limite]
    print(f"{len(slugs)} concursos", flush=True)
    totais = {}
    with ProcessPoolExecutor(args.processos) as pool:
        futuros = {pool.submit(processar, s, args.saida, args.imagens, args.forcar, args.listar): s for s in slugs}
        for f in as_completed(futuros):
            slug = futuros[f]
            try:
                _, res = f.result()
            except Exception as e:  # noqa: BLE001
                res = [("erro", f"{type(e).__name__}: {e}")]
            for status, msg in res:
                totais[status] = totais.get(status, 0) + 1
                print(f"[{status}] {slug}: {msg}", flush=True)
            if not args.listar:
                estado[slug] = {"quando": time.strftime("%Y-%m-%d"), "resultados": res}
                json.dump(estado, open(ESTADO, "w", encoding="utf8"), ensure_ascii=False, indent=1)
    print("resumo:", totais)


if __name__ == "__main__":
    main()
