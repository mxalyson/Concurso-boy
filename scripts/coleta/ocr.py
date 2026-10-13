# Texto de PDF sem camada de texto (escaneado ou com letras convertidas em curvas), via OCR
# (tesseract, idioma por). Cada página é renderizada, dividida nas colunas pela faixa branca
# vertical perto do meio e lida coluna a coluna, no mesmo formato de saída do colunas.py.
# Uso: python3 ocr.py arquivo.pdf [dpi=300] > texto.txt
# Requer poppler-utils, tesseract-ocr + tesseract-ocr-por, Pillow e numpy.
import os, re, subprocess, sys, tempfile

import numpy as np
from PIL import Image

AMBIENTE = {**os.environ, "OMP_THREAD_LIMIT": "1"}  # várias threads por página deixam o tesseract muito lento


def calha(img):
    """Coluna x da faixa branca vertical mais larga entre 35% e 65% da largura (ou None)."""
    a = np.asarray(img.convert("L")) < 160
    h, w = a.shape
    corpo = a[int(h * 0.08) : int(h * 0.94)]  # ignora cabeçalho e rodapé, que costumam cruzar a página
    tinta = corpo.sum(axis=0)
    ini, fim = int(w * 0.35), int(w * 0.65)
    melhor, inicio, larg = None, None, 0
    for x in range(ini, fim):
        if tinta[x] <= 2:
            inicio = x if inicio is None else inicio
            if x - inicio + 1 > larg:
                larg, melhor = x - inicio + 1, (inicio + x) // 2
        else:
            inicio = None
    return melhor if larg >= w * 0.008 else None


def ler(img):
    with tempfile.NamedTemporaryFile(suffix=".png") as f:
        img.save(f.name)
        r = subprocess.run(["tesseract", f.name, "-", "-l", "por", "--psm", "4"], capture_output=True, text=True, env=AMBIENTE)
    return r.stdout.replace("\f", "")


FUNCIONAIS = {"a", "o", "e", "as", "os", "de", "da", "do", "das", "dos", "em", "na", "no", "nas", "nos", "que", "se", "um", "uma",
              "ao", "aos", "à", "às", "por", "para", "com", "é", "como", "mais", "seu", "sua", "pelo", "pela"}
_ortografia = None


def _conhecida(p):
    global _ortografia
    if _ortografia is None:
        try:
            from spellchecker import SpellChecker
            _ortografia = SpellChecker(language="pt")
        except ImportError:
            _ortografia = False
    return bool(_ortografia) and (p in FUNCIONAIS or (len(p) >= 3 and p in _ortografia))


def _segmentar(p, profundidade=0):
    """Divide palavra colada pelo OCR ("emque", "autilização") em palavras conhecidas,
    exigindo que um dos pedaços seja palavra funcional curta."""
    if profundidade > 2:
        return None
    for i in range(1, len(p)):
        esq, dir_ = p[:i], p[i:]
        if esq in FUNCIONAIS and _conhecida(dir_):
            return [esq, dir_]
        if dir_ in FUNCIONAIS and _conhecida(esq):
            return [esq, dir_]
        if esq in FUNCIONAIS:
            resto = _segmentar(dir_, profundidade + 1)
            if resto:
                return [esq] + resto
    return None


def _romano(t):
    return t.replace("l", "I").replace("|", "I").replace("1", "I")


def corrigir(texto):
    """Erros típicos do tesseract em provas: romanos (Il, Ill, lV, "lell" = I e II) e palavras coladas."""
    def token(m):
        w = m.group(0)
        nucleo, pont = re.match(r"^(.*?)([.,;:)]*)$", w).groups()
        # sequência de romanos com "e" colado: IllelV -> III e IV
        if re.fullmatch(r"[IlV|]{1,4}(?:e[IlV|]{1,4})*", nucleo) and re.search(r"[l|]", nucleo) or re.fullmatch(r"(?:[IlV|]{1,4}e)+[IlV|]{1,4}", nucleo):
            partes = [_romano(x) for x in nucleo.split("e")]
            if all(re.fullmatch(r"I{1,3}|IV|VI{0,3}|V", x) for x in partes):
                return " e ".join(partes) + pont
        baixa = nucleo.lower()
        if len(baixa) >= 4 and baixa.isalpha() and _ortografia is not False and not _conhecida(baixa):
            seg = _segmentar(baixa)
            if seg:
                pos, saida = 0, []
                for pedaco in seg:  # preserva maiúsculas do original
                    saida.append(nucleo[pos : pos + len(pedaco)])
                    pos += len(pedaco)
                return " ".join(saida) + pont
        return w

    return "\n".join(re.sub(r"\S+", token, l) for l in texto.split("\n"))


def ocr(pdf, dpi=300, paginas=None):
    saida = []
    with tempfile.TemporaryDirectory(prefix="ocr-") as tmp:
        faixa = ["-f", "1", "-l", str(paginas)] if paginas else []
        subprocess.run(["pdftoppm", "-r", str(dpi), "-gray", "-png", *faixa, pdf, os.path.join(tmp, "p")], check=True)
        for i, nome in enumerate(sorted(os.listdir(tmp), key=lambda n: int(n.split("-")[-1].split(".")[0])), 1):
            img = Image.open(os.path.join(tmp, nome))
            x = calha(img)
            partes = [img] if x is None else [img.crop((0, 0, x, img.height)), img.crop((x, 0, img.width, img.height))]
            for p in partes:
                saida.append(corrigir(ler(p)))
            saida.append(f"\n@@PAGINA {i}@@\n")
    return "\n".join(saida)


if __name__ == "__main__":
    print(ocr(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 300))
