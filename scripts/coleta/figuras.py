# Separa, numa região da prova (item ou texto de apoio), o texto das figuras. A detecção usa
# os objetos gráficos do próprio PDF (imagens e desenhos vetoriais, via PyMuPDF), então a
# figura recortada nunca leva o texto da pergunta:
#   - figuras, gráficos e tabelas (imagens + desenhos agrupados) → imagem num parágrafo próprio;
#   - fórmulas (fonte matemática, frações com traço) → imagem pequena dentro da frase;
#   - o resto é texto, remontado das linhas do PDF, com [[img:N]] no ponto de cada imagem.
import os, re

import pymupdf
from PIL import Image

from hifen import unir

RESPOSTA = re.compile(r"\s*(?:JUSTIFICATIVA\b|ITEM ANULADO|^(?:CERTO|ERRADO)\.(?:\s|$)).*$")
ALTERNATIVA = re.compile(r"^\(([A-E])\)\s*")
SIMBOLICO = re.compile(r"^[\d.,;:()\[\]{}=<>≤≥≠≈+\-−–×÷/|^~*'%!∞…·]+$")
MATEMATICA = re.compile(r"[\U0001D400-\U0001D7FF-∑∫√∏]")

_docs = {}
_cache = {}


def _pagina(pdf, p):
    if pdf not in _docs:
        _docs[pdf] = pymupdf.open(pdf)
    return _docs[pdf][p - 1]


def _juntar(rects, tol):
    """Agrupa retângulos que se tocam (com tolerância) até estabilizar."""
    grupos = [[pymupdf.Rect(r), [i]] for i, r in enumerate(rects)]
    mudou = True
    while mudou:
        mudou = False
        saida = []
        for r, ids in grupos:
            for g in saida:
                if g[0].x0 - tol <= r.x1 and r.x0 <= g[0].x1 + tol and g[0].y0 - tol <= r.y1 and r.y0 <= g[0].y1 + tol:
                    g[0] |= r
                    g[1] += ids
                    mudou = True
                    break
            else:
                saida.append([r, ids])
        grupos = saida
    return grupos


def objetos(pdf, p):
    """Figuras (imagens/desenhos agrupados) e fórmulas da página: [(rect, tipo)], tipo 'figura' | 'formula'."""
    if (pdf, p) in _cache:
        return _cache[(pdf, p)]
    pg = _pagina(pdf, p)
    H = pg.rect.height
    graficos, tem_imagem, tracos = [], [], []
    for info in pg.get_image_info():
        r = pymupdf.Rect(info["bbox"]) & pg.rect
        if r.width > 4 and r.height > 4:
            graficos.append(r)
            tem_imagem.append(True)
    for d in pg.get_drawings():
        r = pymupdf.Rect(d["rect"])
        if r.y1 < H * 0.06 or r.y0 > H * 0.95:
            continue  # cabeçalho/rodapé
        if r.width < 3 and r.height > H * 0.3:
            continue  # divisória das colunas
        fill = d.get("fill")
        if fill and min(fill) > 0.97 and not d.get("color"):
            continue  # fundo branco
        if r.height <= 2 and 2 <= r.width <= 300:
            tracos.append(r)  # possível traço de fração
        graficos.append(r)
        tem_imagem.append(False)

    palavras = pg.get_text("words")  # x0, y0, x1, y1, texto, bloco, linha, n
    meio = pg.rect.width / 2
    spans, linhas_dict, tamanhos = [], [], {}
    for b in pg.get_text("dict")["blocks"]:
        for l in b.get("lines", []):
            texto_l = "".join(sp["text"] for sp in l["spans"]).strip()
            if texto_l:
                linhas_dict.append((pymupdf.Rect(l["bbox"]), max(sp["size"] for sp in l["spans"] if sp["text"].strip())))
            for sp in l["spans"]:
                tamanhos[round(sp["size"])] = tamanhos.get(round(sp["size"]), 0) + len(sp["text"])
                if sp["text"].strip() and (sp["font"].startswith("Cambria") or "Math" in sp["font"] or MATEMATICA.search(sp["text"])):
                    spans.append(pymupdf.Rect(sp["bbox"]))
    corpo = max(tamanhos, key=tamanhos.get) if tamanhos else 10  # tamanho do texto corrido
    numeros = [pymupdf.Rect(sp["bbox"]) for b in pg.get_text("dict")["blocks"] for l in b.get("lines", [])
               for sp in l["spans"] if re.fullmatch(r"\s*\d{1,3}\s*", sp["text"]) and sp["flags"] & 16]

    saida = []
    for r, ids in _juntar(graficos, 8):
        imagem = any(tem_imagem[i] for i in ids)
        if not imagem and (r.height < 12 or r.width < 20):
            continue  # traços soltos, sublinhados, separadores
        dentro = [w for w in palavras if pymupdf.Rect(w[:4]).intersects(r)]
        if not imagem and dentro:
            # moldura em volta de um parágrafo comum (não é tabela): linhas longas de texto
            linhas = {}
            for w in dentro:
                linhas.setdefault((w[5], w[6]), []).append(w)
            longas = sum(1 for ws in linhas.values() if max(w[2] for w in ws) - min(w[0] for w in ws) > 0.6 * r.width)
            if longas >= max(2, 0.7 * len(linhas)):
                continue
        # rótulos que saem um pouco da área desenhada (título, eixos, legendas): linhas em
        # fonte menor que a do texto, encostadas na figura e na mesma coluna
        mudou = True
        while mudou:
            mudou = False
            for lr, tam in linhas_dict:
                if lr in r or tam >= corpo - 0.5 and not lr.intersects(r):
                    continue
                if ((lr.x0 + lr.x1) / 2 < meio) != ((r.x0 + r.x1) / 2 < meio) and r.width < meio:
                    continue
                if lr.intersects(pymupdf.Rect(r.x0 - 12, r.y0 - 10, r.x1 + 12, r.y1 + 10)):
                    r |= lr
                    mudou = True
        saida.append((r, "figura"))

    if len(saida) > 1:
        # partes da mesma figura (ex.: gráfico e legenda), sem juntar colunas diferentes
        lados = {}
        for r, _ in saida:
            lado = "ambos" if r.width >= meio else (r.x0 + r.x1) / 2 < meio
            lados.setdefault(lado, []).append(r)
        saida = [(r, "figura") for rs in lados.values() for r, _ in _juntar(rs, 20)]

    # fórmulas: sequências de palavras em fonte matemática (com operadores e números entre
    # elas) e frações (traço curto com texto logo acima e abaixo)
    def matematica(w):
        r = pymupdf.Rect(w[:4])
        return any((r & m).get_area() > 0.4 * max(r.get_area(), 0.01) for m in spans)

    por_linha = {}
    for w in palavras:
        por_linha.setdefault((w[5], w[6]), []).append(w)
    trechos = []
    for ws in por_linha.values():
        ws.sort(key=lambda w: w[0])
        mat = [matematica(w) for w in ws]
        mudou = True
        while mudou:  # operadores/números colados a uma fórmula fazem parte dela
            mudou = False
            for k, w in enumerate(ws):
                if mat[k] or not SIMBOLICO.match(w[4]):
                    continue
                vizinho = any(0 <= q < len(ws) and mat[q] and abs((ws[q][0] if q > k else ws[q][2]) - (w[2] if q > k else w[0])) < 10
                              for q in (k - 1, k + 1))
                if vizinho:
                    mat[k] = mudou = True
        n_mat = sum(len(w[4]) for k, w in enumerate(ws) if mat[k])
        if n_mat >= 0.5 * sum(len(w[4]) for w in ws):
            r = pymupdf.Rect(ws[0][:4])
            for w in ws[1:]:
                r |= pymupdf.Rect(w[:4])
            trechos.append(r)
            continue
        atual = None
        for k, w in enumerate(ws):
            if mat[k]:
                r = pymupdf.Rect(w[:4])
                atual = (atual | r) if atual is not None and r.x0 - atual.x1 < 8 else r
                if k + 1 == len(ws) or not mat[k + 1]:
                    so_numero = all(re.fullmatch(r"[\d.,;:()%]+", x[4]) for x in ws if pymupdf.Rect(x[:4]).intersects(atual))
                    if not so_numero:  # número comum (ex.: "0,1.") continua como texto
                        trechos.append(atual)
                    atual = None
    for m in spans:  # trechos matemáticos sem palavra correspondente (índices soltos)
        if not any(m.intersects(t) for t in trechos):
            trechos.append(m)
    for t in tracos:
        if any(t.intersects(f) for f, _ in saida):
            continue
        acima = [pymupdf.Rect(w[:4]) for w in palavras if (w[1] + w[3]) / 2 < t.y0 and w[3] > t.y0 - 12 and w[0] < t.x1 and w[2] > t.x0]
        abaixo = [pymupdf.Rect(w[:4]) for w in palavras if (w[1] + w[3]) / 2 > t.y1 and w[1] < t.y1 + 12 and w[0] < t.x1 and w[2] > t.x0]
        formula = lambda ws: all(matematica(w) or SIMBOLICO.match(w[4]) for w in ws)
        acima_w = [w for w in palavras if (w[1] + w[3]) / 2 < t.y0 and w[3] > t.y0 - 12 and w[0] < t.x1 and w[2] > t.x0]
        abaixo_w = [w for w in palavras if (w[1] + w[3]) / 2 > t.y1 and w[1] < t.y1 + 12 and w[0] < t.x1 and w[2] > t.x0]
        if acima and abaixo and formula(acima_w) and formula(abaixo_w):
            r = pymupdf.Rect(t)
            for w in acima + abaixo:
                r |= w
            trechos.append(r)
    # junta partes da mesma fórmula (índices, somatórios, frações): lado a lado com alguma
    # sobreposição vertical, ou uma contida na faixa da outra — sem colar linhas vizinhas
    def mesma(a, b):
        sob = min(a.y1, b.y1) - max(a.y0, b.y0)
        gap = max(a.x0, b.x0) - min(a.x1, b.x1)
        if sob < 0.2 * min(a.height, b.height):
            return False
        if gap <= 6:
            return True
        # vão curto sem nenhuma palavra: símbolo sem texto (ex.: "≠" mal mapeado)
        x0, x1 = min(a.x1, b.x1), max(a.x0, b.x0)
        y0, y1 = max(a.y0, b.y0), min(a.y1, b.y1)
        return gap <= 16 and not any(w[0] < x1 and w[2] > x0 and w[1] < y1 and w[3] > y0 for w in palavras)

    grupos = [pymupdf.Rect(r) for r in trechos]
    mudou = True
    while mudou:
        mudou = False
        for a in range(len(grupos)):
            for b in range(a + 1, len(grupos)):
                if mesma(grupos[a], grupos[b]):
                    grupos[a] |= grupos.pop(b)
                    mudou = True
                    break
            if mudou:
                break
    for r in grupos:
        if any(r.intersects(f) for f, _ in saida):
            continue
        # número do item (negrito) colado à fórmula não entra no recorte
        for nr in numeros:
            if nr.intersects(r) and nr.x0 <= r.x0 + 1:
                r = pymupdf.Rect(nr.x1 + 2.5, r.y0, r.x1, r.y1)
        if r.width > 2:
            saida.append((r, "formula"))
    _cache[(pdf, p)] = saida
    return saida


def renderizar(pdf, p, rect, arquivo, dpi=150, mascaras=()):
    pg = _pagina(pdf, p)
    folga = 3 if rect.height > 30 else 1.2  # fórmulas: margem mínima para não pegar letras vizinhas
    clip = pymupdf.Rect(rect.x0 - folga, rect.y0 - 1.5, rect.x1 + folga, rect.y1 + 1.5) & pg.rect
    pix = pg.get_pixmap(clip=clip, dpi=dpi, colorspace=pymupdf.csGRAY)
    img = Image.frombytes("L", (pix.width, pix.height), pix.samples)
    escala = dpi / 72
    for m in mascaras:  # justificativas/respostas nunca aparecem
        if m[0] == p:
            mr = pymupdf.Rect(m[1:]) & clip
            if not mr.is_empty:
                img.paste(255, (int((mr.x0 - clip.x0) * escala), int((mr.y0 - clip.y0) * escala),
                                int((mr.x1 - clip.x0) * escala) + 1, int((mr.y1 - clip.y0) * escala) + 1))
    os.makedirs(os.path.dirname(arquivo) or ".", exist_ok=True)
    img.quantize(colors=16).save(arquivo, optimize=True)
    return arquivo


def _no_segmento(segs, p, r):
    cx, cy = (r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2
    for si, (sp, x0, y0, x1, y1) in enumerate(segs):
        if sp == p and x0 - 2 <= cx <= x1 + 2 and y0 - 2 <= cy <= y1 + 2:
            return si
    return None


def _novo_paragrafo(ant, l, lim):
    if ant is None:
        return False
    if ALTERNATIVA.match(l[6]):
        return True
    if (ant[0], ant[1]) != (l[0], l[1]):
        return False  # continua na outra coluna/página
    h = l[5] - l[3]
    if l[3] - ant[5] > 0.9 * h:
        return True
    x0c, x1c, _ = lim[(ant[0], ant[1])]
    terminou = re.search(r"[.:;?!”]$", ant[6])
    curta = (ant[4] - ant[2]) < 0.85 * (x1c - x0c - 8)
    return bool(terminou and (l[2] > ant[2] + 5 or curta))


def montar(pdf, linhas, lim, indices, segs, numero, prefixo, marcador, mascaras=()):
    """Remonta o texto da região com as figuras e fórmulas como imagens.
    `marcador(arquivo)` devolve o [[img:N]] de cada imagem. Devolve (texto, nº de imagens)
    ou (None, 0) quando a região não tem figura nem fórmula."""
    objs = []  # (segmento, rect, tipo, pagina)
    for p in sorted({s[0] for s in segs}):
        for r, tipo in objetos(pdf, p):
            si = _no_segmento(segs, p, r)
            if si is not None:
                objs.append((si, r, tipo, p))
    if not objs:
        return None, 0
    arquivos = {}

    def arquivo_de(o):
        chave = (o[3], tuple(round(v, 1) for v in o[1]))
        if chave not in arquivos:
            arquivos[chave] = renderizar(pdf, o[3], o[1], f"{prefixo}-{len(arquivos) + 1}.png", mascaras=mascaras)
        return arquivos[chave]

    def ordem(l):
        si = _no_segmento(segs, l[0], pymupdf.Rect(l[2], l[3], l[4], l[5]))
        return si if si is not None else 0

    figuras = [o for o in objs if o[2] == "figura"]
    formulas = [o for o in objs if o[2] == "formula"]

    def destino(l, wx0, wx1, wt):
        """Para onde vai uma palavra: 'figura' (some), uma fórmula (vira a imagem) ou None (texto)."""
        cx, cy = (wx0 + wx1) / 2, (l[3] + l[5]) / 2
        if any(o[3] == l[0] and o[1].x0 <= cx <= o[1].x1 and o[1].y0 <= cy <= o[1].y1 for o in figuras):
            return "figura"
        f = next((o for o in formulas if o[3] == l[0] and o[1].x0 - 1 <= cx <= o[1].x1 + 1 and o[1].y0 - 4 <= cy <= o[1].y1 + 4), None)
        if f is None and (SIMBOLICO.match(wt) or MATEMATICA.search(wt)):
            # índice/operador solto colado a uma fórmula
            f = next((o for o in formulas if o[3] == l[0] and o[1].y0 - 4 <= cy <= o[1].y1 + 4
                      and (0 <= wx0 - o[1].x1 < 8 or 0 <= o[1].x0 - wx1 < 8)), None)
        return f

    elems = []
    for pos, j in enumerate(indices):
        l = linhas[j]
        if l[1] < 0:
            continue
        y = (l[3] + l[5]) / 2
        dest = [destino(l, *w) for w in l[8]]
        fs = [d for d in dest if d not in (None, "figura")]
        if dest and all(d is not None for d in dest) and fs:
            y = max(f[1].y1 for f in fs)  # linha só de fórmula (numerador, índice): vai na posição da fórmula
        elems.append((ordem(l), y, pos, "t", l))
    def y_figura(o):
        # texto ao lado da figura (contorno): a figura entra depois desse texto
        lado = any(linhas[j][0] == o[3] and linhas[j][3] < o[1].y1 and linhas[j][5] > o[1].y0
                   and (linhas[j][2] >= o[1].x1 - 2 or linhas[j][4] <= o[1].x0 + 2) for j in indices)
        return o[1].y1 - 0.5 if lado else (o[1].y0 + o[1].y1) / 2

    elems += [(o[0], y_figura(o), -1, "f", o) for o in figuras]
    elems.sort(key=lambda e: (e[0], e[1], e[2]))

    usadas = set()
    paragrafos, atual, ant, primeira = [], "", None, True
    for _, _, _, tipo, v in elems:
        if tipo == "f":
            if atual:
                paragrafos.append(atual)
            paragrafos.append(marcador(arquivo_de(v)))
            atual, ant = "", None
            continue
        l = v
        if numero > 0 and l[6].strip() == str(numero):
            continue  # número do item numa linha à parte
        partes = []
        for wx0, wx1, wt in l[8]:
            f = destino(l, wx0, wx1, wt)
            if f == "figura":
                continue
            if f is not None:
                if id(f) not in usadas:
                    partes.append(marcador(arquivo_de(f)))
                    usadas.add(id(f))
                continue
            partes.append(wt)
        t = RESPOSTA.split(" ".join(partes).strip())[0].strip()
        if primeira and t:
            t = re.sub(rf"^{numero}\s+", "", t) if numero > 0 else t
            primeira = False
        if not t or re.fullmatch(r"[.,;:]+", t):
            continue
        if _novo_paragrafo(ant, l, lim) and atual:
            paragrafos.append(atual)
            atual = ""
        atual = unir(atual, t) if atual.endswith("-") else (atual + " " + t).strip()
        ant = l
    if atual:
        paragrafos.append(atual)
    texto = "\n".join(paragrafos).strip()
    texto = re.sub(r"(\]\]|\w) ([.,;:!?)])(?=\s|$)", r"\1\2", texto)  # pontuação colada (troca de fonte)
    return texto, len(arquivos)


def separar_alternativas(texto):
    """Separa enunciado e alternativas (A)–(E) de um texto montado."""
    partes = re.split(r"(?m)^\(([A-E])\)\s*", texto)
    if len(partes) < 3:
        return texto, []
    enunciado = partes[0].strip()
    alternativas = [{"letra": partes[i], "texto": re.sub(r"^[.,;]\s*", "", partes[i + 1].strip())} for i in range(1, len(partes) - 1, 2)]
    return enunciado, alternativas
