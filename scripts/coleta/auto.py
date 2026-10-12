# Importação automática das provas objetivas do Cebraspe (certo/errado), sem configuração
# manual: lista os concursos na API pública da banca, baixa cada prova e o gabarito
# DEFINITIVO, extrai os itens, classifica (classificar.py), recorta só as figuras/fórmulas e
# gera um lote por prova em data/provas/. Provas que não passam nos controles de qualidade
# são registradas e puladas.
#
# Uso:
#   python3 auto.py                     # todos os concursos encerrados/em andamento ainda não importados
#   python3 auto.py --eventos PF_21,TCU_22 --limite 20 --anos 2020-2026 --processos 4
#   python3 auto.py --novas             # só concursos ainda não vistos (para rodar no cron)
#
# Requer poppler-utils (pdftotext, pdfinfo), Python 3 com pyspellchecker, pymupdf, pillow e numpy.
import argparse, gzip, json, os, re, shutil, subprocess, sys, tempfile, time, unicodedata
from concurrent.futures import ProcessPoolExecutor, as_completed

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
from classificar import classificar_itens  # noqa: E402

API = "https://apis.cebraspe.org.br/cebraspe"
CDN = "https://cdn.cebraspe.org.br/concursos/{evento}/arquivos/{arquivo}"
RAIZ = os.path.abspath(os.path.join(AQUI, "..", ".."))
CACHE = os.path.join(RAIZ, ".cache", "cebraspe")
ESTADO = os.environ.get("COLETA_ESTADO") or os.path.join(RAIZ, "data", "cebraspe-estado.json")


def baixar(url, destino, tentativas=3):
    for i in range(tentativas):
        r = subprocess.run(["curl", "-sS", "-f", "-L", "-m", "120", "-o", destino, url], capture_output=True, text=True)
        if r.returncode == 0 and os.path.getsize(destino) > 0:
            return True
        time.sleep(2 * (i + 1))
    return False


def obter_json(url, cache=None, validade_h=None):
    if cache and os.path.exists(cache) and (validade_h is None or time.time() - os.path.getmtime(cache) < validade_h * 3600):
        try:
            return json.load(open(cache, encoding="utf8"))
        except ValueError:
            pass
    os.makedirs(os.path.dirname(cache or os.path.join(CACHE, "x")), exist_ok=True)
    destino = cache or tempfile.mktemp()
    if not baixar(url, destino):
        return None
    try:
        return json.load(open(destino, encoding="utf8"))
    except ValueError:
        return None


def listar_eventos():
    fases = obter_json(f"{API}/eventos/tipo/concursos/", os.path.join(CACHE, "concursos.json"), validade_h=12) or []
    return [e for f in fases if not re.match(r"novos|inscri", f["faseEvento"], re.I) for e in f["eventos"]]


def _sem_acento(t):
    return unicodedata.normalize("NFD", t).encode("ascii", "ignore").decode()


def chave_par(descricao):
    """Parte da descrição que identifica o caderno: 'PROVA OBJETIVA - CARGO 2: X' e
    'GABARITO DEFINITIVO - CARGO 2: X' dão a mesma chave."""
    d = _sem_acento(descricao).upper()
    d = re.sub(r"^\s*(PROVAS? OBJETIVAS?|GABARITOS? DEFINITIVOS?)(\s*[-–—]\s*PROVAS? OBJETIVAS?)?", "", d)
    d = re.sub(r"\b(ATUALIZAD[OA]S?|RETIFICAD[OA]S?|NOVA VERSAO|VERSAO FINAL)\b", " ", d)
    d = re.sub(r"[-–—:()]", " ", d)
    return re.sub(r"\s+", " ", d).strip()


def pares_do_evento(ev):
    arquivos = (ev.get("arquivosGabarito") or []) + (ev.get("arquivosEdital") or [])
    provas, gabs = {}, {}
    for a in arquivos:
        d = a["descricaoArquivo"].strip()
        u = _sem_acento(d).upper()
        if not a["nomeArquivo"].lower().endswith(".pdf") or re.search(r"SUB ?JUDICE|ORAL|PRATICA|DISCURSIVA|LIBRAS|REAPLICA|JUSTIFICATIVA|PRELIMINAR|RASCUNHO|SEM EFEITO|CANCELAD|ANULAD", u):
            continue
        if re.match(r"\s*PROVAS? OBJETIVAS?", u):
            provas.setdefault(chave_par(d), a)
        elif re.match(r"\s*GABARITOS? DEFINITIVOS?", u):
            gabs.setdefault(chave_par(d), a)
    pares = [(k, provas[k], gabs[k]) for k in provas if k in gabs]
    if not pares and len(provas) == 1 and len(gabs) == 1:
        (k, p), (_, g) = next(iter(provas.items())), next(iter(gabs.items()))
        pares = [(k, p, g)]
    return pares


MINUSCULAS = {"de", "da", "do", "das", "dos", "e", "em", "a", "o", "para", "com", "na", "no", "à", "ao"}


def titulo(t):
    palavras = re.sub(r"\s+", " ", t.strip()).lower().split(" ")
    out = []
    for i, p in enumerate(palavras):
        if i and p in MINUSCULAS:
            out.append(p)
        elif re.fullmatch(r"[ivx]+|ti|tic|sql|ii|iii", p):
            out.append(p.upper())
        else:
            out.append(p[:1].upper() + p[1:])
    return " ".join(out)


def nome_cargo(descricao, ev=None):
    d = re.sub(r"^\s*PROVAS? OBJETIVAS?\s*[-–—]?\s*", "", descricao.strip(), flags=re.I)
    # "CARGO 2" / "ÊNFASE 1" sem nome: busca o nome na lista de cargos do concurso
    cargos = (ev or {}).get("eventoCargos") or []
    num = re.search(r"(?:CARGO|OPÇÃO|OPCAO|ÊNFASE|ENFASE|ESPECIALIDADE|ÁREA|AREA)\s*(\d+)\s*$", d, re.I)
    if num:
        c = next((c for c in cargos if c.get("idArea", "").lstrip("0") == num.group(1).lstrip("0")), None)
        if c:
            d = c["area"]
    elif re.search(r"ESPEC[ÍI]FICOS\s*$", d, re.I) and len(cargos) == 1:
        d = cargos[0]["area"]
    m = re.search(r"(?:CARGO|OPÇÃO|OPCAO|ÊNFASE|ENFASE|ESPECIALIDADE|ÁREA|AREA)\s*\d*\s*:\s*(.+)$", d, re.I)
    if m:
        cargo = m.group(1)
    else:
        cargo = re.sub(r"CONHECIMENTOS (ESPEC[ÍI]FICOS|B[ÁA]SICOS|GERAIS|ESPECIALIZADOS|COMPLEMENTARES)\s*[-–—]?\s*", "", d, flags=re.I).strip(" -–—") or d
    cargo = re.sub(r"\(.*?\)\s*$", "", cargo).strip(" -–—")
    if re.search(r"CONHECIMENTOS B[ÁA]SICOS|CONHECIMENTOS GERAIS", d, re.I) and not m:
        cargo = "Conhecimentos Básicos — " + (cargo if cargo != d else "todos os cargos")
    return titulo(cargo)[:120]


def sigla_orgao(abreviado):
    partes = re.split(r"\s(?:19|20)?\d{2}\b", abreviado.strip(), maxsplit=1)
    return re.sub(r"\s+", " ", partes[0]).strip() or abreviado


def nome_orgao(ev, abrev):
    completo = (ev.get("eventoNomeCompleto") or "").strip()
    # às vezes o "nome completo" é só o código do concurso (ex.: "TCU 25  AUFC")
    if not completo or re.search(r"\d|_", completo) or completo.upper() == abrev.upper():
        return sigla_orgao(abrev)
    return titulo(completo)


def slug(t):
    t = _sem_acento(t).lower()
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")[:60]


def parse_gabarito(txt):
    gab = {}
    linhas = [l.split() for l in txt.splitlines()]
    for i, l in enumerate(linhas):
        if l and l[0].lower() in ("item", "questão", "questao"):
            nums = [int(x) for x in l[1:] if x.isdigit()]
            for j in range(i + 1, min(i + 4, len(linhas))):
                if linhas[j] and linhas[j][0].lower() == "gabarito":
                    resp = linhas[j][1:]
                    if len(resp) == len(nums):
                        gab.update({n: v for n, v in zip(nums, resp) if n > 0 and v != "0"})
                    break
    return gab


def processar(ev, chave, prova, gab, pasta_saida, pasta_imagens, forcar=False):
    """Processa um caderno. Devolve (status, mensagem, arquivo|None)."""
    evento = ev["eventoURL"]
    cargo = nome_cargo(prova["descricaoArquivo"], ev)
    nome = f"cebraspe-auto-{slug(evento)}-{slug(cargo)}"
    saida = os.path.join(pasta_saida, nome + ".json")
    final = saida + ".gz"  # lotes automáticos ficam compactados (o seed lê .json e .json.gz)
    if os.path.exists(final) and not forcar:
        return "existente", "já importada", final
    with tempfile.TemporaryDirectory(prefix="cbx-") as tmp:
        pdf, pdf_gab = os.path.join(tmp, "prova.pdf"), os.path.join(tmp, "gab.pdf")
        url_prova = CDN.format(evento=evento, arquivo=prova["nomeArquivo"])
        url_gab = CDN.format(evento=evento, arquivo=gab["nomeArquivo"])
        if not baixar(url_prova, pdf) or not baixar(url_gab, pdf_gab):
            return "erro", "falha no download", None
        txt_gab = subprocess.run(["pdftotext", "-layout", pdf_gab, "-"], capture_output=True, text=True).stdout
        gabarito = parse_gabarito(txt_gab)
        if len(gabarito) < 10:
            return "pulada", "gabarito sem tabela Item/Gabarito (formato não suportado)", None
        multipla = not set(gabarito.values()) <= {"C", "E", "X", "*"}
        if multipla and not set(gabarito.values()) <= set("ABCDEX*"):
            return "pulada", "gabarito em formato desconhecido", None
        texto_pdf = subprocess.run(["pdftotext", pdf, "-"], capture_output=True, text=True).stdout
        if len(texto_pdf.strip()) < 2000:
            return "pulada", "PDF sem texto (escaneado)", None
        primeiro = min(gabarito)
        txt = os.path.join(tmp, "prova.txt")
        with open(txt, "w", encoding="utf8") as f:
            subprocess.run([sys.executable, os.path.join(AQUI, "colunas.py"), pdf], stdout=f, check=True)
        itens_json = os.path.join(tmp, "itens.json")
        conversor = "cespe_me.py" if multipla else "cespe.py"
        subprocess.run([sys.executable, os.path.join(AQUI, conversor), txt, itens_json, str(primeiro)], capture_output=True, check=True)
        itens = json.load(open(itens_json, encoding="utf8"))
        if multipla:
            n_alt = 5 if "E" in gabarito.values() else 4
            incompletas = sum(1 for x in itens if len(x["alternativas"]) != n_alt)
            if incompletas > 0.1 * max(1, len(itens)):
                return "pulada", f"{incompletas} questões sem as {n_alt} alternativas", None
            for x in itens:  # o classificador lê o "comando": na múltipla escolha, o próprio enunciado
                x["comando"] = x["enunciado"][:400]
        # controles de qualidade
        numeros = {x["numero"] for x in itens}
        com_gab = numeros & set(gabarito)
        if len(com_gab) < 0.85 * len(gabarito):
            return "pulada", f"extraídos {len(com_gab)} de {len(gabarito)} itens do gabarito", None
        curtos = sum(1 for x in itens if len(x["enunciado"]) < 25)
        if curtos > 0.1 * len(itens):
            return "pulada", f"{curtos} itens com enunciado truncado", None
        especifico = re.search(r"ESPEC[ÍI]FIC|ESPECIALIZAD|ÊNFASE|ENFASE|OPÇÃO|OPCAO", prova["descricaoArquivo"], re.I)
        especialidade = cargo.split(":")[-1].strip() if especifico and not re.search(r"Conhecimentos", cargo) else None
        classes = classificar_itens(itens, cargo, especialidade)
        abrev = ev.get("eventoNomeAbreviado") or evento
        cfg = {
            "slug": nome,
            "prova": {
                "banca": "CEBRASPE",
                "banca_nome": "Centro Brasileiro de Pesquisa em Avaliação e Seleção e de Promoção de Eventos",
                "orgao": sigla_orgao(abrev),
                "orgao_nome": nome_orgao(ev, abrev),
                "cargo": cargo,
                "ano": ev.get("eventoAno"),
                "url_prova": url_prova,
                "url_gabarito": url_gab,
                "origem": "automatica",
            },
            "fonte": f"Cebraspe — {abrev} — {cargo}",
            "classificacao": [{"itens": [n, n], "disciplina": d, **({"assunto": a} if a else {})} for n, (d, a) in sorted(classes.items())],
            "excluir": [],
        }
        nivel = re.search(r"N[ÍI]VEL (M[ÉE]DIO|SUPERIOR|FUNDAMENTAL)", _sem_acento(prova["descricaoArquivo"]).upper())
        if nivel:
            cfg["prova"]["escolaridade"] = {"MEDIO": "medio", "SUPERIOR": "superior", "FUNDAMENTAL": "fundamental"}[nivel.group(1).replace("É", "E")]
        cfg_arq = os.path.join(tmp, "cfg.json")
        json.dump(cfg, open(cfg_arq, "w", encoding="utf8"), ensure_ascii=False)
        gab_txt = os.path.join(tmp, "gab.txt")
        open(gab_txt, "w", encoding="utf8").write(txt_gab)
        if multipla:
            for x in itens:
                x.pop("comando", None)
            json.dump(itens, open(itens_json, "w", encoding="utf8"), ensure_ascii=False)
        r = subprocess.run(
            [sys.executable, os.path.join(AQUI, "montar_me.py" if multipla else "montar.py"), cfg_arq, itens_json, gab_txt, saida,
             "--pdf", f"{pdf}:{primeiro}", "--imagens", pasta_imagens],
            capture_output=True, text=True,
        )
        if r.returncode != 0:
            return "erro", (r.stderr or r.stdout).strip().splitlines()[-1][:300] if (r.stderr or r.stdout).strip() else "falha", None
        lote = json.load(open(saida, encoding="utf8"))
        n = len(lote["questoes"])
        if n < 10:
            os.remove(saida)
            return "pulada", f"só {n} questões aproveitáveis", None
        with open(saida, "rb") as f, gzip.open(final, "wb", compresslevel=9) as g:
            shutil.copyfileobj(f, g)
        os.remove(saida)
        return "importada", f"{n} questões", final


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--eventos", help="lista de eventos (ex.: PF_21,TCU_22)")
    ap.add_argument("--anos", help="intervalo de anos, ex.: 2019-2026")
    ap.add_argument("--limite", type=int, default=0, help="máximo de cadernos nesta execução")
    ap.add_argument("--processos", type=int, default=3)
    ap.add_argument("--novas", action="store_true", help="só cadernos ainda não processados")
    ap.add_argument("--forcar", action="store_true")
    ap.add_argument("--saida", default=os.path.join(RAIZ, "data", "provas"))
    ap.add_argument("--imagens", default=os.path.join(RAIZ, "data", "imagens"))
    args = ap.parse_args()

    estado = json.load(open(ESTADO, encoding="utf8")) if os.path.exists(ESTADO) else {"cadernos": {}}
    eventos = listar_eventos()
    if args.eventos:
        quero = set(args.eventos.split(","))
        eventos = [e for e in eventos if e["eventoURL"] in quero]
    if args.anos:
        a, b = (int(x) for x in args.anos.split("-"))
        eventos = [e for e in eventos if e.get("eventoAno") and a <= e["eventoAno"] <= b]

    # provas já revisadas manualmente (data/provas/*.json) não são reimportadas
    revisadas = set()
    for nome in os.listdir(args.saida) if os.path.isdir(args.saida) else []:
        if nome.endswith(".json"):
            try:
                revisadas.add(json.load(open(os.path.join(args.saida, nome), encoding="utf8"))["prova"].get("url_prova"))
            except (ValueError, KeyError, TypeError):
                pass

    tarefas = []
    for e in eventos:
        ev = obter_json(f"{API}/eventos/{e['eventoURL']}", os.path.join(CACHE, "ev", e["eventoURL"] + ".json"), validade_h=24 * 7)
        if not ev:
            continue
        for chave, prova, gab in pares_do_evento(ev):
            if CDN.format(evento=ev["eventoURL"], arquivo=prova["nomeArquivo"]) in revisadas:
                continue
            id_caderno = f"{ev['eventoURL']}|{chave}"
            anterior = estado["cadernos"].get(id_caderno)
            if args.novas and anterior and anterior["status"] in ("importada", "pulada", "existente"):
                continue
            tarefas.append((id_caderno, ev, chave, prova, gab))
    if args.limite:
        tarefas = tarefas[: args.limite]
    print(f"{len(eventos)} concursos; {len(tarefas)} cadernos para processar", flush=True)

    os.makedirs(args.saida, exist_ok=True)
    totais = {}
    with ProcessPoolExecutor(max_workers=args.processos) as pool:
        futuros = {pool.submit(processar, ev, chave, prova, gab, args.saida, args.imagens, args.forcar): idc for idc, ev, chave, prova, gab in tarefas}
        for f in as_completed(futuros):
            idc = futuros[f]
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
