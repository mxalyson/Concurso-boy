# Converte o texto (extraído por colunas) de uma prova de múltipla escolha no
# formato FGV/FCC: número da questão sozinho na linha, enunciado, alternativas (A)–(E),
# títulos de disciplina entre as questões.
# Uso: python3 fgv.py texto.txt saida.json [lixo_regex] [primeiro_numero]
import json, re, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hifen import unir

texto = open(sys.argv[1], encoding="utf8").read()
lixo_extra = re.compile(sys.argv[3]) if len(sys.argv) > 3 and sys.argv[3] else None
esperado = int(sys.argv[4]) if len(sys.argv) > 4 else 1

if "@@PAGINA 1@@" in texto:
    texto = texto.split("@@PAGINA 1@@", 1)[1]  # pula a capa
texto = re.sub("[\uf000-\uf0ff\u25cf\u25aa]", "•", texto)
linhas = texto.split("\n")

def indent(l):
    return len(l) - len(l.lstrip(" "))

def eh_lixo(s):
    if not s:
        return False
    if s.startswith("@@PAGINA") or s in ("FGV", "FCC") or re.fullmatch(r"\d{1,2}", s) and False:
        return True
    if lixo_extra and lixo_extra.search(s):
        return True
    return False

RE_ALT = re.compile(r"^\(([A-E])\)\s*(.*)$")

itens = []
disciplina = None
base = None  # texto de apoio pendente
buffer = []  # linhas soltas entre questões
atual = None  # {"numero","linhas","alts":[[letra,texto]],"disciplina"}
estado = None  # "enunciado" | "alt"

def fechar_item():
    global atual
    if atual:
        itens.append(atual)
    atual = None

def heading(s, proxima):
    return (
        proxima is not None
        and len(s) < 70
        and not re.search(r"[.:;?,)]$", s)
        and s[:1].isupper()
        and not RE_ALT.match(s)
        and not s.isdigit()
    )

# Pré-filtra lixo mantendo linhas vazias
limpas = [l.rstrip() for l in linhas if not eh_lixo(l.strip())]

def proxima_nao_vazia(i):
    for j in range(i + 1, len(limpas)):
        if limpas[j].strip():
            return limpas[j].strip()
    return None

i = 0
while i < len(limpas):
    l = limpas[i]
    s = l.strip()
    if s.isdigit() and int(s) == esperado:
        fechar_item()
        # linhas soltas acumuladas: título de disciplina e/ou texto de apoio
        soltas = [x for x in buffer if x.strip()]
        if soltas:
            # o último título curto antes do número é a disciplina
            if heading(soltas[-1].strip(), s) and len(soltas[-1].split()) <= 8:
                disciplina = soltas[-1].strip()
                soltas = soltas[:-1]
            if soltas:
                cand = [x for x in soltas if not (heading(x.strip(), "x") and len(x.split()) <= 8)]
                if cand and len(" ".join(cand)) > 120:
                    base = "\n".join(cand)
        buffer = []
        atual = {"numero": esperado, "linhas": [], "alts": [], "disciplina": disciplina, "base": base}
        esperado += 1
        estado = "enunciado"
    elif atual is None:
        buffer.append(l)
    else:
        m = RE_ALT.match(s)
        prox = "ABCDE"[len(atual["alts"])] if len(atual["alts"]) < 5 else None
        if m and m.group(1) == prox:
            atual["alts"].append([m.group(1), m.group(2)])
            estado = "alt"
        elif estado == "alt":
            if not s:
                if len(atual["alts"]) == 5:
                    estado = "fim"
            elif indent(l) >= 2 and len(atual["alts"]) >= 1:
                atual["alts"][-1][1] = unir(atual["alts"][-1][1], s)
            elif len(atual["alts"]) < 5:
                atual["alts"][-1][1] = unir(atual["alts"][-1][1], s)
            else:
                estado = "fim"
                buffer.append(l)
        elif estado == "fim":
            buffer.append(l)
        else:
            atual["linhas"].append(l)
    i += 1
fechar_item()

def juntar_paragrafos(ls):
    out, cur = [], ""
    for l in ls:
        s = re.sub(r"\s{2,}", " ", l.strip())
        if not s:
            if cur:
                out.append(cur)
            cur = ""
            continue
        if cur.endswith("-") and s[:1].islower():
            cur = unir(cur, s)
        elif cur and (re.search(r"[.:?!”]$", cur) and (s[:1].isupper() or s[:1] in "•“\"(")) and len(cur) > 0:
            # frases curtas terminadas em ponto seguidas de maiúscula: mantém quebra de linha
            out.append(cur)
            cur = s
        else:
            cur = (cur + " " + s).strip()
    if cur:
        out.append(cur)
    return "\n".join(out)

saida = []
for it in itens:
    enun = juntar_paragrafos(it["linhas"])
    alts = [{"letra": a, "texto": re.sub(r"\s{2,}", " ", t).strip()} for a, t in it["alts"]]
    problema = None
    tudo = enun + " " + " ".join(a["texto"] for a in alts)
    if len(alts) != 5:
        problema = f"{len(alts)} alternativas"
    elif re.search(r"\b(figura|imagem|foto|fotografia|gráfico|ilustração|charge|tirinha|quadrinho|tabela|quadro|diagrama|esquema|mapa|planilha|cartaz|anúncio)\b", tudo, re.I) or re.search(r"(forma|peça|desenho)s? abaixo", tudo, re.I):
        problema = "depende de figura/tabela"
    elif any(re.fullmatch(r"\s*\d+\s*", x) for x in it["linhas"]) or re.search(r"[\U0001D400-\U0001D7FF√∑∫]", tudo):
        problema = "fórmula"
    elif any(not a["texto"] or a["texto"] in (".",) for a in alts):
        problema = "alternativa vazia"
    saida.append({
        "numero": it["numero"],
        "secao": it["disciplina"],
        "texto_base": it["base"] if it["base"] and re.search(r"texto|trecho|fragmento|poema|frase", enun, re.I) else None,
        "enunciado": enun,
        "alternativas": alts,
        "problema": problema,
    })

json.dump(saida, open(sys.argv[2], "w", encoding="utf8"), ensure_ascii=False, indent=1)
print(f"{len(saida)} questões; última {saida[-1]['numero'] if saida else '-'}; com problema: {[x['numero'] for x in saida if x['problema']]}")
