# Converte o texto (extraído por colunas) de uma prova Cebraspe de múltipla escolha:
# "Texto CG1A1" (textos de apoio), "Questão N", enunciado e alternativas "A ..." a "E ...".
# Uso: python3 cespe_me.py prova.txt saida.json [primeira_questao]
import json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hifen import unir

texto = open(sys.argv[1], encoding="utf8").read()
esperado = int(sys.argv[3]) if len(sys.argv) > 3 else 1
fim = re.search(r"PROVA DISCURSIVA", texto)
if fim:
    texto = texto[: fim.start()]

RE_QUESTAO = re.compile(r"^\s*Quest[ãa]o\s+(\d{1,3})\s*$")
RE_TEXTO = re.compile(r"^\s*Texto\s+([0-9A-Z]+[A-Z0-9-]*)\s*$")
RE_ALT = re.compile(r"^(\s*)([A-E])\s+(\S.*)$")


def lixo(l):
    s = l.strip()
    return (
        not s
        or s.startswith("@@PAGINA")
        or re.fullmatch(r"<[^>]+>", s)
        or re.match(r"^CEBRASPE\s+[–-]", s)
        or re.search(r"Espaço livre|OBJETIVA P\d|NTOS (GERAIS|ESPEC)|BJETIVA|-- ?$", s)
        or (len(l) - len(l.lstrip()) >= 30 and len(s) < 60 and not re.search(r"[.:;]$", s))
    )


linhas = [l.rstrip() for l in texto.split("\n")]
textos, itens = {}, []
atual_texto = None  # [codigo, linhas]
q = None  # {"numero", "enun", "alts", "ind"}
estado = None


def fechar_questao():
    global q
    if q:
        itens.append(q)
    q = None


def alternativas_seguem(i, ind):
    """Confere se, a partir da linha i (candidata a "A ..."), vêm B, C, D e E no mesmo recuo."""
    faltam = list("BCD")  # provas com 4 (A–D) ou 5 (A–E) alternativas
    for l in linhas[i + 1 : i + 60]:
        if RE_QUESTAO.match(l):
            break
        m = RE_ALT.match(l)
        if m and m.group(2) == faltam[0] and abs(len(m.group(1)) - ind) <= 1:
            faltam.pop(0)
            if not faltam:
                return True
    return False


for i, l in enumerate(linhas):
    if not l.strip():
        if atual_texto is not None:
            atual_texto[1].append("")
        continue
    if l.strip().startswith("@@PAGINA") or re.fullmatch(r"\s*<[^>]+>\s*", l):
        continue
    m_q = RE_QUESTAO.match(l)
    m_t = RE_TEXTO.match(l)
    if m_q and int(m_q.group(1)) == esperado:
        fechar_questao()
        if atual_texto:
            textos[atual_texto[0]] = atual_texto[1]
            atual_texto = None
        q = {"numero": esperado, "enun": [], "alts": [], "ind": None}
        esperado += 1
        estado = "enun"
        continue
    if m_t:
        fechar_questao()
        if atual_texto:
            textos[atual_texto[0]] = atual_texto[1]
        atual_texto = [m_t.group(1), []]
        estado = None
        continue
    if lixo(l):
        continue
    if q is not None:
        m_a = RE_ALT.match(l)
        prox = "ABCDE"[len(q["alts"])] if len(q["alts"]) < 5 else None
        e_alt = m_a and m_a.group(2) == prox and (q["ind"] is None or abs(len(m_a.group(1)) - q["ind"]) <= 1)
        if e_alt and prox == "A" and (not q["enun"] or not alternativas_seguem(i, len(m_a.group(1)))):
            e_alt = False  # "A respeito de...", "A política..." no enunciado
        if e_alt:
            q["alts"].append([m_a.group(2), m_a.group(3).strip()])
            q["ind"] = len(m_a.group(1))
            estado = "alt"
        elif estado == "alt":
            ind = len(l) - len(l.lstrip())
            if ind > q["ind"]:
                q["alts"][-1][1] = unir(q["alts"][-1][1], l.strip())
            else:
                # fim da questão: o que vier depois é texto de apoio da próxima
                fechar_questao()
                estado = None
                if atual_texto is not None:
                    atual_texto[1].append(l)
        else:
            q["enun"].append(l.strip())
    elif atual_texto is not None:
        atual_texto[1].append(l)
fechar_questao()
if atual_texto:
    textos[atual_texto[0]] = atual_texto[1]


def paragrafos(ls):
    out, cur = [], ""
    for l in ls:
        s = l.strip()
        if not s:
            if cur:
                out.append(cur)
            cur = ""
            continue
        if (len(l) - len(l.lstrip())) >= 4 and cur:
            out.append(cur)
            cur = ""
        cur = unir(cur, s)
    if cur:
        out.append(cur)
    return "\n\n".join(out)


def juntar(ls):
    """Junta as linhas; itens romanos (I, II, III...) e listas ficam em linhas próprias."""
    r = ""
    for s in ls:
        s = re.sub(r"\s{2,}", " ", s)
        if r and re.match(r"^([IVX]{1,4}|\d{1,2}[.)]|[a-e]\))\s", s):
            r += "\n" + s
        else:
            r = unir(r, s)
    return r


saida = []
for it in itens:
    enun = juntar(it["enun"])
    refs = re.findall(r"texto\s+([0-9A-Z]+[A-Z0-9-]*)", enun, re.I)
    base = "\n\n".join(f"Texto {r}\n\n" + paragrafos(textos[r]) for r in dict.fromkeys(refs) if r in textos)
    alts = [{"letra": a, "texto": re.sub(r"\s{2,}", " ", t).strip()} for a, t in it["alts"]]
    tudo = enun + " " + " ".join(a["texto"] for a in alts)
    problema = None
    if len(alts) not in (4, 5):
        problema = f"{len(alts)} alternativas"
    elif re.search(r"[\U0001D400-\U0001D7FF-]", tudo):
        problema = "fórmula"
    elif re.search(r"\b(figura|imagem|gráfico|ilustração|tabela|quadro|diagrama|esquema|planilha|mapa)\b", tudo, re.I):
        problema = "depende de figura/tabela"
    saida.append({"numero": it["numero"], "secao": None, "texto_base": base or None, "enunciado": enun, "alternativas": alts, "problema": problema})

json.dump(saida, open(sys.argv[2], "w", encoding="utf8"), ensure_ascii=False, indent=1)
print(f"{len(saida)} questões; última {saida[-1]['numero'] if saida else '-'}; com problema: {[x['numero'] for x in saida if x['problema']]}")
