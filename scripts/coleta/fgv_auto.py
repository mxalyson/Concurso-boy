# Importação automática das provas objetivas da FGV (conhecimento.fgv.br/concursos):
# para cada concurso, pega a prova "Tipo 1" de cada cargo e o gabarito oficial DEFINITIVO
# (um PDF com uma seção por cargo/tipo), localiza a seção do cargo, extrai as questões
# (fgv.py), classifica, recorta só as figuras e grava data/provas/fgv-auto-*.json.gz.
#
# Uso: python3 fgv_auto.py [--concursos trt16,rfb22] [--limite N] [--processos 3] [--novas]
import argparse, gzip, hashlib, html, json, os, re, shutil, subprocess, sys, tempfile, time
from collections import Counter
from concurrent.futures import ProcessPoolExecutor, as_completed

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
from auto import baixar, slug, titulo, _sem_acento  # noqa: E402
from classificar import assunto_de, disciplina_de  # noqa: E402

SITE = "https://conhecimento.fgv.br"
RAIZ = os.path.abspath(os.path.join(AQUI, "..", ".."))
CACHE = os.path.join(RAIZ, ".cache", "fgv")
ESTADO = os.environ.get("COLETA_ESTADO_FGV") or os.path.join(RAIZ, "data", "fgv-estado.json")


def pagina(url, cache, validade_h=24 * 7):
    if os.path.exists(cache) and time.time() - os.path.getmtime(cache) < validade_h * 3600:
        return open(cache, encoding="utf8", errors="ignore").read()
    os.makedirs(os.path.dirname(cache), exist_ok=True)
    return open(cache, encoding="utf8", errors="ignore").read() if baixar(url, cache) else ""


def listar_concursos():
    slugs = []
    for p in range(0, 40):
        t = pagina(f"{SITE}/concursos?page={p}", os.path.join(CACHE, f"lista-{p}.html"), validade_h=12)
        novos = [s for s in re.findall(r'href="/concursos/([^"#?/]+)"', t) if s not in slugs and s != "nosso-portfolio"]
        if not novos:
            break
        slugs += novos
    return slugs


def texto(h):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", h))).strip()


def analisar_concurso(slug_c):
    """Devolve dados do concurso: nome, ano, gabarito definitivo e provas tipo 1 por cargo."""
    t = pagina(f"{SITE}/concursos/{slug_c}", os.path.join(CACHE, f"{slug_c}.html"))
    if not t:
        return None
    nome = texto((re.search(r"<h1[^>]*>(.*?)</h1>", t, re.S) or re.search(r"<title>(.*?)</title>", t, re.S)).group(1)).split("|")[0].strip()
    anos = re.findall(r"\b(20[12]\d)\b", t)
    gabaritos, provas, cargo_atual = [], [], None
    for m in re.finditer(r'<p[^>]*class="Indent(\d)"[^>]*>(.*?)</p>|<a[^>]*href="([^"]+\.pdf)"[^>]*>(.*?)</a>', t, re.S):
        if m.group(1):
            nivel, corpo = m.group(1), m.group(2)
            link = re.search(r'href="([^"]+\.pdf)"', corpo)
            rotulo = texto(corpo)
            if nivel == "1":
                cargo_atual = rotulo
                if link and re.search(r"tipo[_ -]?1\b|tipo_1\.pdf", link.group(1), re.I):
                    provas.append((rotulo, link.group(1)))
            elif nivel == "2" and link and re.fullmatch(r"Tipo 1", rotulo, re.I) and cargo_atual:
                provas.append((cargo_atual, link.group(1)))
        else:
            rotulo = texto(m.group(4))
            if re.search(r"gabarito", rotulo, re.I) and re.search(r"definitiv", rotulo, re.I) and not re.search(r"discursiv|preliminar|sub ?judice", rotulo, re.I):
                gabaritos.append(m.group(3))
    vistos, unicas = set(), []
    for c, u in provas:
        if u not in vistos:
            vistos.add(u)
            unicas.append((c, u if u.startswith("http") else SITE + u))
    return {
        "slug": slug_c,
        "nome": nome,
        "ano": int(Counter(anos).most_common(1)[0][0]) if anos else None,
        "gabaritos": [g if g.startswith("http") else SITE + g for g in dict.fromkeys(gabaritos)],
        "provas": unicas,
    }


def secoes_gabarito(txt):
    """Seções do gabarito: [(titulo, {numero: resposta})]. Linhas de números seguidas de
    linhas de letras; o título é a última linha de texto antes da tabela."""
    secoes, titulo_atual, gab, nums = [], None, {}, None
    for l in txt.splitlines():
        t = l.split()
        if not t:
            continue
        if all(x.isdigit() for x in t):
            nums = [int(x) for x in t]
        elif nums and all(re.fullmatch(r"[A-E*X]|ANULADA|NULA", x) for x in t) and len(t) == len(nums):
            gab.update(dict(zip(nums, t)))
            nums = None
        elif re.search(r"[A-Za-zÀ-ú]{3,}", l):
            if gab:
                secoes.append((titulo_atual, gab))
                gab = {}
            titulo_atual = l.strip()
            nums = None
    if gab:
        secoes.append((titulo_atual, gab))
    return secoes


PARADAS = {"de", "da", "do", "das", "dos", "e", "em", "a", "o", "area", "nivel", "superior", "medio", "cargo", "tipo", "prova", "objetiva"}


def palavras(t):
    return {w for w in re.findall(r"[a-z0-9]+", _sem_acento(t or "").lower()) if w not in PARADAS and len(w) > 1}


def escolher_secao(secoes, cargo):
    alvo = palavras(cargo)
    melhor, nota = None, 0
    for titulo_s, gab in secoes:
        if not titulo_s:
            continue
        tipo = re.search(r"tipo\s*(\d)", _sem_acento(titulo_s), re.I)
        if tipo and tipo.group(1) != "1":
            continue
        p = palavras(re.sub(r"tipo\s*\d", "", titulo_s, flags=re.I))
        if not p:
            continue
        n = len(alvo & p) / len(alvo | p)
        if n > nota:
            melhor, nota = gab, n
    if melhor is None and len([s for s in secoes if s[0]]) == 1:
        return secoes[0][1]  # gabarito com um único cargo
    return melhor if nota >= 0.34 else None


def lixo_repetido(txt):
    """Linhas que se repetem em muitas páginas (cabeçalhos e rodapés) viram regex de lixo."""
    paginas = txt.split("@@PAGINA")
    cont = Counter()
    for p in paginas:
        for l in {re.sub(r"\s+", " ", x.strip()) for x in p.splitlines() if 4 < len(x.strip()) < 90}:
            cont[l] += 1
    rep = [l for l, n in cont.items() if n >= max(3, 0.3 * len(paginas)) and not re.fullmatch(r"\(?[A-E]\)?.*", l)]
    return "|".join(re.escape(l) for l in rep[:40]) or None


def processar(conc, cargo, url_prova, url_gab, pasta_saida, pasta_imagens):
    nome = f"fgv-auto-{slug(conc['slug'])}-{slug(cargo)[:50]}-{hashlib.sha1(url_prova.encode()).hexdigest()[:6]}"
    final = os.path.join(pasta_saida, nome + ".json.gz")
    if os.path.exists(final):
        return "existente", "já importada", final
    with tempfile.TemporaryDirectory(prefix="fgv-") as tmp:
        pdf, gpdf = os.path.join(tmp, "p.pdf"), os.path.join(CACHE, "gab", hashlib.sha1(url_gab.encode()).hexdigest() + ".pdf")
        os.makedirs(os.path.dirname(gpdf), exist_ok=True)
        if not baixar(url_prova, pdf) or (not os.path.exists(gpdf) and not baixar(url_gab, gpdf)):
            return "erro", "falha no download", None
        gtxt = subprocess.run(["pdftotext", "-layout", gpdf, "-"], capture_output=True, text=True).stdout
        gab = escolher_secao(secoes_gabarito(gtxt), cargo)
        if not gab or len(gab) < 10:
            return "pulada", "seção do cargo não encontrada no gabarito definitivo", None
        if len(subprocess.run(["pdftotext", pdf, "-"], capture_output=True, text=True).stdout.strip()) < 2000:
            return "pulada", "PDF sem texto (escaneado)", None
        txt = os.path.join(tmp, "p.txt")
        with open(txt, "w", encoding="utf8") as f:
            subprocess.run([sys.executable, os.path.join(AQUI, "colunas.py"), pdf], stdout=f, check=True)
        conteudo = open(txt, encoding="utf8").read()
        lixo = lixo_repetido(conteudo)
        primeiro = min(gab)
        itens_json = os.path.join(tmp, "q.json")
        subprocess.run([sys.executable, os.path.join(AQUI, "fgv.py"), txt, itens_json, lixo or "", str(primeiro)], capture_output=True, check=True)
        itens = json.load(open(itens_json, encoding="utf8"))
        com_gab = {x["numero"] for x in itens} & set(gab)
        if len(com_gab) < 0.85 * len(gab):
            return "pulada", f"extraídas {len(com_gab)} de {len(gab)} questões do gabarito", None
        n_alt = 5 if "E" in gab.values() else 4
        if sum(1 for x in itens if len(x["alternativas"]) != n_alt) > 0.1 * len(itens):
            return "pulada", "alternativas incompletas", None
        # disciplina: título de seção da prova (FGV separa por disciplina) ou palavras-chave
        classes = []
        for x in itens:
            secao = x.get("secao") or ""
            disc = disciplina_de(secao, secao, 2) if secao else None
            if not disc and secao and 3 < len(secao) < 60 and not re.search(r"\d|tipo|prova|página", secao, re.I):
                disc = titulo(secao)
            disc = disc or disciplina_de(x["enunciado"] + " " + " ".join(a["texto"] for a in x["alternativas"]), x["enunciado"][:300], 4) or "Conhecimentos Específicos"
            classes.append({"itens": [x["numero"], x["numero"]], "disciplina": disc, **({"assunto": a} if (a := assunto_de(x["enunciado"][:400], disc)) else {})})
        cfg = {
            "slug": nome,
            "prova": {"banca": "FGV", "banca_nome": "Fundação Getulio Vargas", "orgao": conc["sigla"], "orgao_nome": conc["nome"],
                      "cargo": cargo, "ano": conc["ano"], "url_prova": url_prova, "url_gabarito": url_gab, "origem": "automatica"},
            "fonte": f"FGV — {conc['nome']} {conc['ano'] or ''} — {cargo}".replace("  ", " "),
            "classificacao": classes,
            "excluir": [],
        }
        cfg_arq, gab_txt = os.path.join(tmp, "cfg.json"), os.path.join(tmp, "gab.txt")
        json.dump(cfg, open(cfg_arq, "w", encoding="utf8"), ensure_ascii=False)
        nums = sorted(gab)
        with open(gab_txt, "w", encoding="utf8") as f:
            for i in range(0, len(nums), 20):
                f.write("Questão " + " ".join(map(str, nums[i : i + 20])) + "\nGabarito " + " ".join(gab[n] for n in nums[i : i + 20]) + "\n\n")
        saida = os.path.join(pasta_saida, nome + ".json")
        cmd = [sys.executable, os.path.join(AQUI, "montar_me.py"), cfg_arq, itens_json, gab_txt, saida, "--pdf", f"{pdf}:{primeiro}", "--imagens", pasta_imagens]
        if lixo:
            cmd += ["--lixo", lixo]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode != 0:
            return "erro", ((r.stderr or r.stdout).strip().splitlines() or ["falha"])[-1][:300], None
        n = len(json.load(open(saida, encoding="utf8"))["questoes"])
        if n < 10:
            os.remove(saida)
            return "pulada", f"só {n} questões aproveitáveis", None
        with open(saida, "rb") as f, gzip.open(final, "wb", compresslevel=9) as g:
            shutil.copyfileobj(f, g)
        os.remove(saida)
        return "importada", f"{n} questões", final


def sigla_de(slug_c, nome):
    s = re.sub(r"(19|20)?\d{2}$", "", slug_c.split(".")[0]).upper()
    return s or nome[:20]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--concursos")
    ap.add_argument("--limite", type=int, default=0)
    ap.add_argument("--processos", type=int, default=3)
    ap.add_argument("--novas", action="store_true")
    ap.add_argument("--saida", default=os.path.join(RAIZ, "data", "provas"))
    ap.add_argument("--imagens", default=os.path.join(RAIZ, "data", "imagens"))
    args = ap.parse_args()
    estado = json.load(open(ESTADO, encoding="utf8")) if os.path.exists(ESTADO) else {"cadernos": {}}
    slugs = args.concursos.split(",") if args.concursos else listar_concursos()
    revisadas = set()
    for nome in os.listdir(args.saida):
        if nome.endswith(".json"):
            try:
                revisadas.add(json.load(open(os.path.join(args.saida, nome), encoding="utf8"))["prova"].get("url_prova"))
            except (ValueError, KeyError, TypeError):
                pass
    tarefas = []
    for s in slugs:
        c = analisar_concurso(s)
        if not c or not c["gabaritos"] or not c["provas"]:
            continue
        c["sigla"] = sigla_de(s, c["nome"])
        for cargo, url in c["provas"]:
            if url in revisadas:
                continue
            idc = f"{s}|{url}"
            if args.novas and estado["cadernos"].get(idc, {}).get("status") in ("importada", "pulada", "existente"):
                continue
            tarefas.append((idc, c, cargo, url, c["gabaritos"][0]))
    if args.limite:
        tarefas = tarefas[: args.limite]
    print(f"{len(slugs)} concursos; {len(tarefas)} provas para processar", flush=True)
    totais = {}
    with ProcessPoolExecutor(max_workers=args.processos) as pool:
        fut = {pool.submit(processar, c, cargo, url, g, args.saida, args.imagens): idc for idc, c, cargo, url, g in tarefas}
        for f in as_completed(fut):
            idc = fut[f]
            try:
                status, msg, arq = f.result()
            except Exception as e:  # noqa: BLE001
                status, msg, arq = "erro", f"{type(e).__name__}: {e}"[:300], None
            estado["cadernos"][idc] = {"status": status, "mensagem": msg, "arquivo": os.path.basename(arq) if arq else None, "em": time.strftime("%Y-%m-%d")}
            totais[status] = totais.get(status, 0) + 1
            print(f"[{status}] {idc}: {msg}", flush=True)
            json.dump(estado, open(ESTADO, "w", encoding="utf8"), ensure_ascii=False, indent=1)
    print("Resumo:", totais)


if __name__ == "__main__":
    main()
