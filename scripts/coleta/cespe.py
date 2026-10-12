# Converte o texto (extraído por colunas, modo layout) de uma prova Cebraspe de
# certo/errado em uma lista de itens com texto base e comando.
import json, re, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hifen import unir

texto = open(sys.argv[1], encoding="utf8").read()
inicio = texto.find("PROVA O")  # pula a capa
if inicio > 0:
    texto = texto[inicio:]
fim = re.search(r"PROVA DISCURSIVA", texto)
if fim:
    texto = texto[: fim.start()]

linhas = texto.split("\n")

def indent(l):
    return len(l) - len(l.lstrip(" "))

def lixo(l):
    s = l.strip()
    if not s:
        return False
    if indent(l) >= 40:
        return True  # títulos centralizados cortados pela divisão das colunas
    if re.fullmatch(r"\d{3}[A-Z0-9_]*N\d+", s) or "OVAS OBJETIVAS --" in s:
        return True
    if s.startswith("@@PAGINA") or re.match(r"^CEBRASPE\s+–", s) or re.match(r"^-- ?(PROVA|CONHEC)", s) or re.search(r"(ESPECÍFICOS|BÁSICOS) --$", s) or s.startswith("Espaço livre"):
        return True
    if re.fullmatch(r"[A-ZÇÃÕÉÊÓÚÍ ]{1,6}", s):
        return True
    return False

linhas = [l.rstrip() for l in linhas if not lixo(l)]

RE_TEXTO = re.compile(r"(?:^\s*|-\s*)Texto\s+([0-9A-Z]+[A-Z0-9-]*)\s*$")
RE_ITEM = re.compile(r"^\s{0,4}(\d{1,3})\s+(\S.*)$")

blocos = []  # sequência de ("texto", codigo, linhas) | ("comando", linhas) | ("item", n, linhas)
atual = None
esperado = int(sys.argv[3]) if len(sys.argv) > 3 else 1
cont_item = None
base_item = 0

def fechar():
    global atual
    if atual:
        blocos.append(atual)
    atual = None

i = 0
while i < len(linhas):
    l = linhas[i]
    s = l.strip()
    m_t = RE_TEXTO.search(l)
    m_i = RE_ITEM.match(l)
    if m_t:
        fechar()
        atual = ["texto", m_t.group(1), []]
    elif m_i and int(m_i.group(1)) == esperado:
        fechar()
        atual = ["item", esperado, [m_i.group(2)]]
        base_item = indent(l)
        cont_item = None
        esperado += 1
    elif atual and atual[0] == "item":
        # continuação do item: linhas recuadas; texto sem recuo inicia um comando
        if not s:
            fechar()
        elif any("JUSTIFICATIVA" in x for x in atual[2]):
            atual[2].append(s)
        elif indent(l) >= base_item + 2 and (
            cont_item is None or abs(indent(l) - cont_item) <= 1 or not re.search(r"[.:;!?”\"]$", atual[2][-1])
        ):
            if cont_item is None:
                cont_item = indent(l)
            atual[2].append(s)
        else:
            fechar()
            atual = ["comando", None, [s]]
    elif atual and atual[0] == "texto":
        atual[2].append(l)
        # comando "julgue" depois do texto fecha o bloco do texto
        if re.search(r"julgue", s, re.I) and indent(l) <= 4:
            # separa as linhas do comando (parágrafo final sem recuo)
            corpo = atual[2]
            j = len(corpo) - 1
            while j > 0 and corpo[j - 1].strip() and indent(corpo[j - 1]) <= indent(corpo[-1]) and not corpo[j - 1].strip().endswith("."):
                j -= 1
            cmd = [x.strip() for x in corpo[j:]]
            atual[2] = corpo[:j]
            fechar()
            blocos.append(["comando", None, cmd])
    elif s:
        if atual and atual[0] == "comando":
            atual[2].append(s)
        else:
            fechar()
            atual = ["comando", None, [s]]
    else:
        if atual and atual[0] == "comando" and atual[2] and atual[2][-1] != "":
            atual[2].append("")
    i += 1
fechar()

def paragrafos(ls):
    """Junta linhas preservando parágrafos (linha recuada >= 4 inicia parágrafo)."""
    out, cur, ant_fonte = [], "", False
    for l in ls:
        s = l.strip()
        if not s:
            if cur:
                out.append(cur)
                cur = ""
            continue
        novo = indent(l) >= 4 and indent(l) < 20
        fonte = indent(l) >= 20
        if (novo or (fonte and not ant_fonte)) and cur:
            out.append(cur)
            cur = ""
        ant_fonte = fonte
        cur = unir(cur, s)
    if cur:
        out.append(cur)
    return "\n\n".join(out)

INSTRUCOES = re.compile(r"Folha de Respostas|código C|configuração-padrão|Espaço livre|rascunho|apenadas|ERRADO\. A ausência|OBJETIVA --|comando a que", re.I)

def limpar_comando(ls):
    paragrafos_, cur = [], []
    for s in ls:
        if s == "":
            if cur:
                paragrafos_.append(cur)
            cur = []
        else:
            cur.append(s)
    if cur:
        paragrafos_.append(cur)
    bons = [juntar(p) for p in paragrafos_ if not INSTRUCOES.search(" ".join(p))]
    bons = [re.sub(r"^BLOCO [IVX]+\s+", "", b) for b in bons]
    return "\n\n".join(b for b in bons if b)

def juntar(ls):
    r = ""
    for s in ls:
        s = re.sub(r"\s{2,}", " ", s.strip())
        r = unir(r, s)
    return r

textos = {}
itens = []
comando = ""
texto_atual = None
for b in blocos:
    if b[0] == "texto":
        textos[b[1]] = f"Texto {b[1]}\n\n" + paragrafos(b[2])
        texto_atual = b[1]
    elif b[0] == "comando":
        c = limpar_comando(b[2])
        # Parágrafos que continuam a justificativa do item anterior.
        if itens and itens[-1].get("justificativa") is not None:
            pars = c.split("\n\n")
            while pars and re.match(r"^[a-zà-ú•\-–“”\"'(\[0-9]|^[A-ZÀ-Ú][^.]{0,40}”", pars[0]):
                itens[-1]["justificativa"] += " " + pars.pop(0)
            c = "\n\n".join(pars)
        if re.search(r"julgue|item|itens", c, re.I):
            comando = c
    else:
        refs = re.findall(r"texto\s+([0-9A-Z]+[A-Z0-9-]*)", comando, re.I)
        base = "\n\n".join(textos[r] for r in refs if r in textos)
        enunciado = juntar(b[2])
        justificativa = None
        m = re.search(r"\s*JUSTIFICATIVA\s*[-–—:]?\s*", enunciado)
        if m:
            justificativa = enunciado[m.end():].strip()
            enunciado = enunciado[: m.start()].strip()
        tb = (base + "\n\n" if base else "") + comando
        problema = None
        if re.search("[\U0001D400-\U0001D7FF]", tb + enunciado):
            problema = "fórmula matemática"
        elif re.search(r"\b(figura|imagem|foto|fotografia|gráfico|ilustração|diagrama|planilha a seguir|tabela precedente|tabela a seguir|quadro a seguir)\b", tb + " " + enunciado, re.I):
            problema = "depende de figura"
        itens.append({
            "problema": problema,
            "numero": b[1],
            "comando": comando,
            "texto_base": (base + "\n\n" if base else "") + comando,
            "enunciado": enunciado,
            "justificativa": justificativa,
        })

json.dump(itens, open(sys.argv[2], "w", encoding="utf8"), ensure_ascii=False, indent=1)
print(f"{len(itens)} itens; último número {itens[-1]['numero'] if itens else '-'}")
faltando = sorted(set(range(1, (itens[-1]["numero"] if itens else 0) + 1)) - {x["numero"] for x in itens})
print("faltando:", faltando)
