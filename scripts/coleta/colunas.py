# Extrai texto de PDF em duas colunas, na ordem de leitura (coluna esquerda, depois direita).
# Uso: python3 colunas.py arquivo.pdf [fração_do_corte=0.5]
import subprocess, sys, re

pdf = sys.argv[1]
corte = float(sys.argv[2]) if len(sys.argv) > 2 else 0.5
info = subprocess.run(["pdfinfo", pdf], capture_output=True, text=True).stdout
paginas = int(re.search(r"Pages:\s+(\d+)", info).group(1))
w, h = map(float, re.search(r"Page size:\s+([\d.]+) x ([\d.]+)", info).groups())
saida = []
for p in range(1, paginas + 1):
    meio = int(w * corte)
    for x, larg in ((0, meio), (meio, int(w) - meio)):
        t = subprocess.run(
            ["pdftotext", "-layout", "-f", str(p), "-l", str(p), "-x", str(x), "-y", "0", "-W", str(larg), "-H", str(int(h)), pdf, "-"],
            capture_output=True, text=True,
        ).stdout
        ls = t.split("\n")
        ind = [len(l) - len(l.lstrip(" ")) for l in ls if l.strip()]
        m = min(ind) if ind else 0
        saida.append("\n".join(l[m:] if l.strip() else "" for l in ls))
    saida.append(f"\n@@PAGINA {p}@@\n")
print("\n".join(saida))
