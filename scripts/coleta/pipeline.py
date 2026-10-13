# Etapas comuns de importação de uma prova em PDF já baixada: extração por formato, controle
# de qualidade, classificação, recorte de figuras e gravação do lote (.json.gz).
import gzip, json, os, re, shutil, subprocess, sys, tempfile
from collections import Counter

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
from classificar import assunto_de, classificar_itens, disciplina_de  # noqa: E402

FORMATOS = ("ce", "me_cebraspe", "me_fgv")


def texto_pdf(pdf, layout=True, paginas=None):
    cmd = ["pdftotext"] + (["-layout"] if layout else []) + (["-f", "1", "-l", str(paginas)] if paginas else []) + [pdf, "-"]
    return subprocess.run(cmd, capture_output=True, text=True).stdout


def tabela_gabarito(txt):
    """Gabarito em tabela (Cebraspe): linhas "Item/Questão 1 2 3" + "Gabarito C E X"."""
    gab, ls = {}, [l.split() for l in txt.splitlines()]
    for i, l in enumerate(ls):
        if l and l[0].lower() in ("item", "questão", "questao", "questões", "itens"):
            nums = [int(x) for x in l[1:] if x.isdigit()]
            for j in range(i + 1, min(i + 4, len(ls))):
                if ls[j] and ls[j][0].lower() in ("gabarito", "resposta", "respostas"):
                    if len(ls[j]) - 1 == len(nums):
                        gab.update({n: v for n, v in zip(nums, ls[j][1:]) if n > 0 and v != "0"})
                    break
    return gab


def secoes_gabarito(txt):
    """Gabarito em seções (FGV e outras): [(título, {número: resposta})]. Linhas só de números
    seguidas de linhas só de letras; o título é a última linha de texto antes da tabela.
    Também aceita pares "1-A 2-B" / "1 A 2 B" numa mesma linha."""
    secoes, titulo_atual, gab, nums = [], None, {}, None
    for l in txt.splitlines():
        t = l.split()
        if not t:
            continue
        pares = re.findall(r"\b0*(\d{1,3})\s*[-–.:)]?\s*([A-E]|X|\*|ANULADA)\b", l)
        if all(x.isdigit() for x in t):
            nums = [int(x) for x in t]
        elif nums and all(re.fullmatch(r"[A-E*X]|ANULADA|NULA", x) for x in t) and len(t) == len(nums):
            gab.update(dict(zip(nums, t)))
            nums = None
        elif len(pares) >= 5 and len(pares) * 2 >= len(t) - 1:
            gab.update({int(n): v for n, v in pares})
        elif re.search(r"[A-Za-zÀ-ú]{3,}", l):
            if gab:
                secoes.append((titulo_atual, gab))
                gab = {}
            titulo_atual = l.strip()
            nums = None
    if gab:
        secoes.append((titulo_atual, gab))
    return secoes


def lixo_repetido(txt):
    """Linhas repetidas em muitas páginas (cabeçalhos/rodapés) viram uma regex de lixo."""
    paginas = txt.split("@@PAGINA")
    cont = Counter()
    for p in paginas:
        for l in {re.sub(r"\s+", " ", x.strip()) for x in p.splitlines() if 4 < len(x.strip()) < 90}:
            cont[l] += 1
    rep = [l for l, n in cont.items() if n >= max(3, 0.3 * len(paginas)) and not re.fullmatch(r"\(?[A-E]\)?.*", l)]
    return "|".join(re.escape(l) for l in rep[:40]) or None


def detectar_formato(txt_prova, gab):
    """Formato do caderno pelo texto: certo/errado (Cebraspe), múltipla escolha do Cebraspe
    ("Questão N" + "A ...") ou múltipla escolha com "(A)" (FGV, FCC, Vunesp...)."""
    certo_errado = bool(gab) and set(gab.values()) <= {"C", "E", "X", "*"}
    if certo_errado:
        return "ce"
    if len(re.findall(r"(?m)^\s*Quest[ãa]o\s+\d{1,3}\s*$", txt_prova)) >= 5 and len(re.findall(r"(?m)^\s*\([A-E]\)", txt_prova)) < 10:
        return "me_cebraspe"
    return "me_fgv"


def montar(pdf, gab, meta, formato, pasta_saida, pasta_imagens, nome, especialidade=None):
    """Extrai, confere, classifica e grava o lote. meta: campos da prova + "fonte".
    Devolve (status, mensagem, arquivo|None)."""
    final = os.path.join(pasta_saida, nome + ".json.gz")
    if not gab or len(gab) < 10:
        return "pulada", "gabarito não encontrado ou incompleto", None
    with tempfile.TemporaryDirectory(prefix="lote-") as tmp:
        if len(texto_pdf(pdf, layout=False).strip()) < 2000:
            return "pulada", "PDF sem texto (escaneado: use npm run importar-pdfs -- --ia)", None
        txt = os.path.join(tmp, "p.txt")
        with open(txt, "w", encoding="utf8") as f:
            subprocess.run([sys.executable, os.path.join(AQUI, "colunas.py"), pdf], stdout=f, check=True)
        primeiro = min(gab)
        itens_json = os.path.join(tmp, "q.json")
        lixo = None
        if formato == "ce":
            subprocess.run([sys.executable, os.path.join(AQUI, "cespe.py"), txt, itens_json, str(primeiro)], capture_output=True, check=True)
        elif formato == "me_cebraspe":
            subprocess.run([sys.executable, os.path.join(AQUI, "cespe_me.py"), txt, itens_json, str(primeiro)], capture_output=True, check=True)
        else:
            lixo = lixo_repetido(open(txt, encoding="utf8").read())
            subprocess.run([sys.executable, os.path.join(AQUI, "fgv.py"), txt, itens_json, lixo or "", str(primeiro)], capture_output=True, check=True)
        itens = json.load(open(itens_json, encoding="utf8"))
        com_gab = {x["numero"] for x in itens} & set(gab)
        if len(com_gab) < 0.85 * len(gab):
            return "pulada", f"extraídas {len(com_gab)} de {len(gab)} questões do gabarito", None
        multipla = formato != "ce"
        if multipla:
            n_alt = 5 if "E" in gab.values() else 4
            if sum(1 for x in itens if len(x["alternativas"]) != n_alt) > 0.1 * len(itens):
                return "pulada", "alternativas incompletas", None
        elif sum(1 for x in itens if len(x["enunciado"]) < 25) > 0.1 * len(itens):
            return "pulada", "itens com enunciado truncado", None

        # classificação
        if formato == "me_fgv":
            classes = []
            for x in itens:
                secao = x.get("secao") or ""
                disc = disciplina_de(secao, secao, 2) if secao else None
                if not disc and secao and 3 < len(secao) < 60 and not re.search(r"\d|tipo|prova|página", secao, re.I):
                    disc = secao.strip()
                disc = disc or disciplina_de(x["enunciado"] + " " + " ".join(a["texto"] for a in x["alternativas"]), x["enunciado"][:300], 4) or especialidade or "Conhecimentos Específicos"
                a = assunto_de(x["enunciado"][:400], disc)
                classes.append({"itens": [x["numero"], x["numero"]], "disciplina": disc, **({"assunto": a} if a else {})})
        else:
            if multipla:
                for x in itens:
                    x["comando"] = x["enunciado"][:400]
            cl = classificar_itens(itens, meta.get("cargo", ""), especialidade)
            classes = [{"itens": [n, n], "disciplina": d, **({"assunto": a} if a else {})} for n, (d, a) in sorted(cl.items())]
            for x in itens:
                if multipla:
                    x.pop("comando", None)
            json.dump(itens, open(itens_json, "w", encoding="utf8"), ensure_ascii=False)

        prova = {k: v for k, v in meta.items() if k != "fonte" and v not in (None, "")}
        cfg = {"slug": nome, "prova": prova, "fonte": meta.get("fonte") or nome, "classificacao": classes, "excluir": []}
        cfg_arq, gab_txt = os.path.join(tmp, "cfg.json"), os.path.join(tmp, "gab.txt")
        json.dump(cfg, open(cfg_arq, "w", encoding="utf8"), ensure_ascii=False)
        nums = sorted(gab)
        with open(gab_txt, "w", encoding="utf8") as f:
            rotulo = "Item" if formato == "ce" else "Questão"
            for i in range(0, len(nums), 20):
                f.write(f"{rotulo} " + " ".join(map(str, nums[i : i + 20])) + "\nGabarito " + " ".join(gab[n] for n in nums[i : i + 20]) + "\n\n")
        saida = os.path.join(pasta_saida, nome + ".json")
        script = "montar_me.py" if multipla else "montar.py"
        cmd = [sys.executable, os.path.join(AQUI, script), cfg_arq, itens_json, gab_txt, saida, "--pdf", f"{pdf}:{primeiro}", "--imagens", pasta_imagens]
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
