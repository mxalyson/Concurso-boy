# Localiza cada questão no PDF (coordenadas de linhas via pdftotext -bbox-layout) e
# recorta a região como imagem — para figuras, tabelas e fórmulas que não sobrevivem
# à extração de texto.
#
# Uso como módulo:
#   reg = regioes("prova.pdf", modo="ce", primeiro=1)
#   reg[37] -> {"item": [seg, ...], "contexto": [seg, ...]}   (seg = (pagina, x0, y0, x1, y1) em pontos)
#   renderizar("prova.pdf", reg[37]["item"], "saida/37-enunciado")  -> ["saida/37-enunciado.png", ...]
import html, os, re, subprocess, tempfile

RE_PAGINA = re.compile(r'<page width="([\d.]+)" height="([\d.]+)">(.*?)</page>', re.S)
RE_LINHA = re.compile(r'<line xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</line>', re.S)
RE_PALAVRA = re.compile(r"<word[^>]*>(.*?)</word>", re.S)
CABECALHO = re.compile(r"^(CEBRASPE\s*[–-]|--\s*PROVA|-- ?CONHEC|Espaço livre|Tipo \w+ ?[–-] ?Página|\d{3}[A-Z0-9_]*N\d+$)", re.I)


def ler_linhas(pdf, lixo=None):
    """Lê as linhas de cada página: (pagina, col, x0, y0, x1, y1, texto, x_justificativa, palavras).
    col 0 = esquerda, 1 = direita, -1 = largura total; palavras = [(x0, x1, texto)]."""
    xml = subprocess.run(["pdftotext", "-bbox-layout", pdf, "-"], capture_output=True, text=True).stdout
    paginas = []
    for p, m in enumerate(RE_PAGINA.finditer(xml), start=1):
        w, h = float(m.group(1)), float(m.group(2))
        linhas = []
        for lm in RE_LINHA.finditer(m.group(3)):
            x0, y0, x1, y1 = map(float, lm.group(1, 2, 3, 4))
            palavras = [(float(a), float(b), html.unescape(t)) for a, b, t in
                        re.findall(r'<word xMin="([\d.]+)" yMin="[\d.]+" xMax="([\d.]+)" yMax="[\d.]+">(.*?)</word>', lm.group(5), re.S)]
            texto = " ".join(t for _, _, t in palavras).strip()
            # onde começa uma justificativa/gabarito comentado nesta linha ("forte": a palavra
            # JUSTIFICATIVA; "fraco": linha iniciada por CERTO./ERRADO./ITEM ANULADO)
            jx = None
            for a, b, t in palavras:
                k = t.find("JUSTIFICATIVA")
                if k >= 0:
                    jx = ("forte", a + (b - a) * k / max(1, len(t)))
                    break
            if jx is None and palavras and (re.match(r"(CERTO|ERRADO)\.", palavras[0][2])
                                            or texto.startswith("ITEM ANULADO")):
                jx = ("fraco", palavras[0][0])
            if not texto:
                continue
            if y0 < h * 0.045 or y1 > h * 0.965 or CABECALHO.search(texto) or (lixo and re.search(lixo, texto)):
                continue  # cabeçalho/rodapé
            meio = w / 2
            if x0 < meio - 8 and x1 > meio + 40:
                col = -1  # linha que atravessa as duas colunas (títulos, capa)
            else:
                col = 0 if x0 < meio - 8 else 1
            linhas.append((p, col, x0, y0, x1, y1, texto, jx, palavras))
        paginas.append({"numero": p, "w": w, "h": h, "linhas": linhas})
    # só provas "com justificativa" usam as marcações; nas demais elas são ignoradas
    fortes = sum(1 for pg in paginas for l in pg["linhas"] if l[7] and l[7][0] == "forte")
    for pg in paginas:
        pg["linhas"] = [l[:7] + ((l[7][1] if l[7] and fortes >= 3 else None),) + l[8:] for l in pg["linhas"]]
    return paginas


def ordem_leitura(paginas):
    """Linhas em ordem de leitura: página, coluna esquerda, coluna direita. Linhas que se
    sobrepõem verticalmente (ex.: número do item e o texto ao lado) formam uma mesma faixa,
    ordenada da esquerda para a direita."""
    saida = []
    for pg in paginas:
        for col in (-1, 0, 1):
            faixas = []
            for l in sorted((l for l in pg["linhas"] if l[1] == col), key=lambda l: l[3]):
                if faixas:
                    f = faixas[-1]
                    altura = min(l[5] - l[3], f["y1"] - f["y0"]) or 1
                    if min(l[5], f["y1"]) - max(l[3], f["y0"]) > 0.5 * altura:
                        f["linhas"].append(l)
                        f["y1"] = max(f["y1"], l[5])
                        continue
                faixas.append({"y0": l[3], "y1": l[5], "linhas": [l]})
            for f in faixas:
                saida += sorted(f["linhas"], key=lambda l: l[2])
    return saida


def limites_coluna(paginas):
    lim = {}
    for pg in paginas:
        meio = pg["w"] / 2
        for col in (0, 1):
            ls = [l for l in pg["linhas"] if l[1] == col]
            if ls:
                x0 = min(l[2] for l in ls) - 4
                x1 = max(l[4] for l in ls) + 4
                # cada coluna fica restrita à sua metade da página
                x0, x1 = (x0, min(x1, meio + 1)) if col == 0 else (max(x0, meio - 1), x1)
                lim[(pg["numero"], col)] = (x0, x1, max(l[5] for l in ls) + 4)
            else:
                lim[(pg["numero"], col)] = ((0, meio) if col == 0 else (meio, pg["w"])) + (pg["h"] * 0.95,)
    return lim


def regioes(pdf, modo="ce", primeiro=1, ultimo=None, lixo=None, detalhes=False):
    """Para cada número de questão: segmentos do item e do contexto (texto/comando que o antecede).
    Com `detalhes`, devolve também as linhas (ordem de leitura) e os limites das colunas."""
    paginas = ler_linhas(pdf, lixo)
    lim = limites_coluna(paginas)
    linhas = ordem_leitura(paginas)
    margem = {}
    for pg in paginas:
        for col in (0, 1):
            ls = [l for l in pg["linhas"] if l[1] == col]
            if ls:
                margem[(pg["numero"], col)] = min(l[2] for l in ls)

    # 1) marcadores de início de questão
    inicios = []  # (indice_linha, numero)
    esperado = primeiro
    for i, l in enumerate(linhas):
        if l[1] < 0:
            continue
        palavras = l[6].split()
        if modo == "me" and len(palavras) == 2 and re.fullmatch(r"Quest[ãa]o|QUESTÃO", palavras[0]):
            palavras = palavras[1:]  # Cebraspe: "Questão 12"
        if palavras and palavras[0] == str(esperado):
            perto_margem = l[2] <= margem.get((l[0], l[1]), l[2]) + 12 or modo == "me" and l[6].startswith("Quest")
            if perto_margem and (modo == "me" and len(palavras) == 1 or modo == "ce"):
                inicios.append((i, esperado))
                esperado += 1
                if ultimo and esperado > ultimo:
                    break

    # 2) fim de cada item e contexto de cada bloco
    resultado = {}
    contexto_atual = None
    fim_anterior = 0
    corte_anterior = False
    for k, (i, n) in enumerate(inicios):
        prox = inicios[k + 1][0] if k + 1 < len(inicios) else len(linhas)
        fim = prox
        fim_just = None
        corte = False  # item termina numa justificativa: não estende o recorte
        mascaras = []
        if modo == "ce":
            # Provas "com justificativa" trazem a resposta logo após o item: o recorte
            # termina nessa linha e o trecho da justificativa é coberto (mascara).
            jl = next((j for j in range(i, prox) if linhas[j][7] is not None), None)
            if jl is not None:
                lj = linhas[jl]
                fim = jl if lj[7] <= lj[2] + 2 else jl + 1
                x0c, x1c, _ = lim[(lj[0], lj[1])]
                mascaras.append((lj[0], max(x0c, lj[7] - 1), lj[3] - 1, x1c, lj[5] + 3))
                corte = True
                fim_just = _fim_justificativa(linhas, i, jl, prox, margem)
            else:
                fim = _fim_item_ce(linhas, i, prox, margem, lim)
        # contexto: linhas entre o fim do item anterior e o início deste
        entre = list(range(fim_anterior, i))
        desde = linhas[fim_anterior - 1] if corte_anterior else None
        if k == 0:
            entre = [j for j in entre if linhas[j][0] == linhas[i][0]]  # nunca inclui a capa
        if modo == "me":
            entre = []  # na múltipla escolha o texto de apoio fica dentro da própria questão
        if entre and any(linhas[j][1] >= 0 for j in entre):
            # novo bloco: o contexto é calculado uma vez, até o primeiro item do bloco
            contexto_atual = {
                "segs": segmentos(linhas, entre, lim, ate=linhas[i], desde=desde),
                "texto": " ".join(linhas[j][6] for j in entre),
                "indices": entre,
            }
        resultado[n] = {
            "item": segmentos(linhas, list(range(i, fim)), lim,
                              ate=None if corte else (linhas[fim] if fim < len(linhas) else None)),
            "mascaras": mascaras,
            "contexto": contexto_atual["segs"] if contexto_atual else [],
            "texto_contexto": contexto_atual["texto"] if contexto_atual else "",
            "idx_item": list(range(i, fim)),
            "idx_contexto": contexto_atual["indices"] if contexto_atual else [],
        }
        fim_anterior = fim_just or fim
        corte_anterior = corte
    if detalhes:
        return resultado, linhas, lim
    return resultado


def _fim_justificativa(linhas, i, jl, prox, margem):
    """A justificativa segue em linhas alinhadas ao texto do item, sem salto vertical."""
    rel = lambda l: l[2] - margem.get((l[0], l[1]), l[2])
    ref = rel(linhas[i + 1]) if i + 1 < jl else rel(linhas[jl])
    j = jl + 1
    while j < prox:
        l, ant = linhas[j], linhas[j - 1]
        if l[1] < 0 or abs(rel(l) - ref) > 3:
            break
        mesma_coluna = (l[0], l[1]) == (ant[0], ant[1])
        if mesma_coluna and l[3] - ant[5] > 1.5 * (ant[5] - ant[3]):
            break
        j += 1
    return j


def _fim_item_ce(linhas, i, prox, margem, lim):
    """O item termina na primeira linha sem recuo (comando/texto seguinte) ou num parágrafo
    novo recuado depois de frase terminada (situação hipotética seguinte)."""
    num = linhas[i]
    base_rel = num[2] - margem.get((num[0], num[1]), num[2])
    texto_rel = None
    if i + 1 < prox:
        seg = linhas[i + 1]
        texto_rel = seg[2] - margem.get((seg[0], seg[1]), seg[2])
    for j in range(i + 1, prox):
        lj, ant = linhas[j], linhas[j - 1]
        if lj[1] < 0:
            return j
        rel = lj[2] - margem.get((lj[0], lj[1]), lj[2])
        x0c, x1c, _ = lim[(lj[0], lj[1])]
        larga = (lj[4] - lj[2]) > 0.6 * (x1c - x0c)
        if rel <= base_rel + 3 and j > i + 1:
            return j
        frase_terminou = re.search(r"[.:;?!”]$", ant[6])
        if (texto_rel is not None and rel > texto_rel + 4 and larga
                and frase_terminou and lj[6][:1].isupper()):
            return j
        # material desalinhado (gráfico, tabela) depois do fim do item: só pertence
        # ao item se ele anuncia algo "a seguir"/"abaixo"
        if texto_rel is not None and abs(rel - texto_rel) > 4 and frase_terminou:
            texto_item = " ".join(linhas[k][6] for k in range(i, j))
            if not re.search(r"a seguir|abaixo|seguinte", texto_item, re.I):
                return j
    return prox


def segmentos(linhas, indices, lim, ate=None, desde=None):
    """Agrupa linhas por (página, coluna) em retângulos. Estende o último até a próxima âncora
    (para incluir figuras sem texto logo abaixo). Com `desde`, o primeiro retângulo começa logo
    abaixo dessa linha (figuras sem texto antes do comando)."""
    grupos = []
    for j in indices:
        l = linhas[j]
        if l[1] < 0:
            continue
        chave = (l[0], l[1])
        if grupos and grupos[-1][0] == chave:
            g = grupos[-1]
            g[2] = min(g[2], l[3])
            g[3] = max(g[3], l[5])
        else:
            grupos.append([chave, None, l[3], l[5]])
    segs = []
    if grupos and desde is not None and (desde[0], desde[1]) == grupos[0][0]:
        grupos[0][2] = min(grupos[0][2], desde[5] + 4)
    for idx, (chave, _, y0, y1) in enumerate(grupos):
        x0, x1, ybaixo = lim[chave]
        ultimo = idx == len(grupos) - 1
        if not ultimo:
            y1 = max(y1, ybaixo)  # continua em outra coluna/página: vai até o fim desta coluna
        elif ate is not None and (ate[0], ate[1]) == chave:
            y1 = max(y1, ate[3] - 2)  # até a próxima âncora (inclui figuras entre as linhas)
        elif ate is not None:
            y1 = max(y1, ybaixo)
        segs.append((chave[0], max(0, x0), max(0, y0 - 3), x1, y1 + 2))
    return segs


def renderizar(pdf, segs, prefixo, dpi=150, mascaras=()):
    """Renderiza os segmentos como PNG (escala de cinza, otimizado). Retorna os caminhos gerados.
    `mascaras`: retângulos (pagina, x0, y0, x1, y1) pintados de branco (ex.: justificativas)."""
    from PIL import Image, ImageDraw

    saidas = []
    escala = dpi / 72
    for k, (p, x0, y0, x1, y1) in enumerate(segs):
        if y1 - y0 < 6:
            continue
        arquivo = f"{prefixo}{'' if len(segs) == 1 else f'-{k + 1}'}.png"
        with tempfile.TemporaryDirectory() as tmp:
            base = os.path.join(tmp, "r")
            subprocess.run(
                ["pdftoppm", "-r", str(dpi), "-gray", "-f", str(p), "-l", str(p),
                 "-x", str(int(x0 * escala)), "-y", str(int(y0 * escala)),
                 "-W", str(int((x1 - x0) * escala)), "-H", str(int((y1 - y0) * escala)),
                 "-png", "-singlefile", pdf, base],
                check=True,
            )
            img = Image.open(base + ".png").convert("L")
            for mp, mx0, my0, mx1, my1 in mascaras:
                if mp == p and mx0 < x1 and mx1 > x0 and my0 < y1 and my1 > y0:
                    ImageDraw.Draw(img).rectangle(
                        [(mx0 - x0) * escala, (my0 - y0) * escala, (mx1 - x0) * escala, (my1 - y0) * escala], fill=255)
            # reduz para 16 tons de cinza: arquivos bem menores, texto nítido
            img = img.quantize(colors=16)
            os.makedirs(os.path.dirname(arquivo) or ".", exist_ok=True)
            img.save(arquivo, optimize=True)
        saidas.append(arquivo)
    return saidas


if __name__ == "__main__":
    import json, sys

    pdf, modo, primeiro = sys.argv[1], sys.argv[2], int(sys.argv[3])
    r = regioes(pdf, modo, primeiro)
    print(json.dumps({n: {"item": v["item"], "contexto": v["contexto"]} for n, v in list(r.items())[:8]}, indent=1))
    print(len(r), "questões localizadas")
