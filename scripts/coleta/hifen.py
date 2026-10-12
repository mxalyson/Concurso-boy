import re, sys, os
try:
    from spellchecker import SpellChecker
    _DIC = SpellChecker(language="pt").word_frequency.dictionary
except Exception:  # sem dicionário, cai nas heurísticas
    _DIC = None

CLITICOS = r"(se|me|te|lhe|lhes|o|a|os|as|nos|vos|lo|la|los|las|no|na|ia|ão|ás|á|emos|eis|ei)"
PREFIXOS_HIFEN = {
    "ex", "vice", "vizo", "sócio", "pós", "pré", "pró", "recém", "além", "aquém", "sem", "bem",
    "decreto", "salário", "auxílio", "bolsa", "vale", "guarda", "porta", "abaixo", "mal", "pré",
    "médico", "político", "econômico", "jurídico", "técnico", "científico", "norte", "sul", "luso",
    "afro", "greco", "ítalo", "teuto", "anglo", "franco", "nipo", "sino", "ibero", "sul-americano",
    "pau", "beija", "conta", "ponta", "segunda", "terça", "quarta", "quinta", "sexta",
}


def unir(cur, s):
    """Junta duas linhas tratando a hifenização de fim de linha."""
    if not cur:
        return s
    if cur.endswith("-") and s[:1].islower():
        m_frag = re.search(r"([\wÀ-ú]+)-$", cur)
        frag = m_frag.group(1).lower() if m_frag else ""
        resto = re.match(r"[\wÀ-ú]+", s)
        resto = resto.group(0).lower() if resto else ""
        if _DIC is not None and frag and resto:
            if (frag + resto) in _DIC:
                return cur[:-1] + s
            if frag in _DIC and (resto in _DIC or re.fullmatch(CLITICOS, resto)):
                return cur + s
        manter = (
            re.match(CLITICOS + r"(\b|[-.,;:])", s) and len(frag) > 2  # ênclise/mesóclise
            or frag in PREFIXOS_HIFEN
            or s[:1] == "h"
            or (frag and frag[-1] in "aeiou" and s[:1] == frag[-1])  # micro-ondas, anti-inflamatório
        )
        return cur + s if manter else cur[:-1] + s
    return cur + " " + s
