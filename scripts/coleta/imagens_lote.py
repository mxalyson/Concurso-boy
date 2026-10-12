# Anexa às questões que dependem de figura, tabela ou fórmula apenas as figuras da prova
# original. O texto (comando, texto de apoio, enunciado, alternativas) continua como texto,
# remontado a partir do PDF, com [[img:N]] no ponto em que cada figura aparece.
import os, re, unicodedata

from PIL import Image
from recortes import regioes
from figuras import montar, separar_alternativas


def _palavras(t):
    t = unicodedata.normalize("NFD", t or "").encode("ascii", "ignore").decode().lower()
    return [w for w in re.findall(r"[a-z0-9]{3,}", t)]


def cobertura(texto, referencia):
    """Fração das palavras de `texto` presentes em `referencia`."""
    p = _palavras(texto)
    if not p:
        return 1.0
    ref = set(_palavras(referencia))
    return sum(1 for w in p if w in ref) / len(p)


def anexar_imagens(questoes, fontes, pasta_imagens, prefixo, modo, lixo=None, forcar=()):
    """questoes: lista de dicts (numero, texto_base, enunciado, problema...). fontes: [(pdf, primeiro_numero)].
    Para cada questão com problema (ou listada em `forcar`), recorta só as figuras e remonta o texto."""
    reg = {}
    for pdf, primeiro in fontes:
        r, linhas, lim = regioes(pdf, modo, primeiro, lixo=lixo, detalhes=True)
        for n, v in r.items():
            reg[n] = (pdf, v, linhas, lim)
    total = 0
    for q in questoes:
        n = q["numero"]
        if not (q.get("problema") or n in forcar) or n not in reg:
            continue
        pdf, r, linhas, lim = reg[n]
        imagens = []

        def marcador(arquivo):
            src = os.path.relpath(arquivo, pasta_imagens)
            if not any(i["src"] == src for i in imagens):
                with Image.open(arquivo) as im:  # tamanho em pixels (150 dpi): a tela usa para a escala
                    imagens.append({"src": src, "parte": "inline", "largura": im.width, "altura": im.height})
            return f"[[img:{next(k for k, i in enumerate(imagens) if i['src'] == src)}]]"

        def escolher(original, texto):
            """Texto remontado do PDF, salvo quando a região não contém o texto inteiro
            (ex.: texto de apoio que começa na página anterior): aí o extraído vem antes."""
            if cobertura(original, texto) < 0.85 and cobertura(re.sub(r"\[\[img:\d+\]\]", "", texto), original) >= 0.85:
                return original.strip() + "\n" + "\n".join(re.findall(r"\[\[img:\d+\]\]", texto))
            return texto

        # texto de apoio / comando do bloco
        if r["idx_contexto"]:
            idx = r["idx_contexto"]
            texto, n_img = montar(pdf, linhas, lim, idx, r["contexto"], -1,
                                  os.path.join(pasta_imagens, prefixo, f"b{idx[0]}-apoio"), marcador)
            if n_img:
                q["texto_base"] = escolher(q.get("texto_base") or "", texto)

        # item
        texto, n_img = montar(pdf, linhas, lim, r["idx_item"], r["item"], n,
                              os.path.join(pasta_imagens, prefixo, f"{n}"), marcador, r.get("mascaras", ()))
        if n_img:
            if modo == "me":
                enunciado, alternativas = separar_alternativas(texto)
                q["enunciado"] = enunciado
                if len(alternativas) == len(q.get("alternativas") or []):
                    q["alternativas"] = alternativas
            else:
                q["enunciado"] = texto
        if imagens:
            q["imagens"] = imagens
            total += 1
        else:
            # o PDF não tem figura nem fórmula nesta região: o alerta era falso (ex.: "fita diagrama")
            q["problema"] = None
    return total
