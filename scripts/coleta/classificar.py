# Classificação automática de itens por disciplina e assunto, para provas importadas sem
# revisão manual. A disciplina sai de palavras-chave do bloco (texto de apoio + comando +
# itens); o assunto, do próprio comando ("Acerca de X, julgue os itens..."). Itens do mesmo
# bloco recebem a mesma disciplina.
import re, unicodedata


def _norm(t):
    t = unicodedata.normalize("NFD", t or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"\s+", " ", t)


# (disciplina, [(regex, peso)]) — regex sobre o texto sem acentos e em minúsculas
DISCIPLINAS = [
    ("Língua Portuguesa", [(r"texto\b.{0,80}\b(sentid|linguistic|gramatic|ideias|coes|coerenc|reescrit|interpret)|(sentid|linguistic|gramatic|ideias|coes|coerenc|reescrit|interpret).{0,80}\btexto\b", 12), (r"aspectos linguisticos|ideias (e|do|apresentadas no) texto|do texto (cb|cg|[0-9])|texto (cb|cg)[0-9]", 12), (r"\btexto (cb|cg|1a|[0-9]+a)", 4), (r"aspectos linguisticos|correcao gramatical|coerencia (do texto|das ideias)|sentido original|(no|do) texto|vocabulo|oracao|periodo|virgula|pontuacao|concordancia|regencia|crase|pronome|verbo|sujeito|substantivo|adjetivo|coesao|linha \d", 2), (r"ideias do texto|interpretacao|reescrita", 3)]),
    ("Raciocínio Lógico", [(r"proposic|tabela.verdade|logica|conectivo|silogismo|argumento valido|equivalen|negacao da", 3), (r"conjunto|diagrama|anagrama|permutac|arranjo|combinac|probabilidade|sequencia", 1)]),
    ("Matemática", [(r"porcentagem|juros|razao e proporcao|regra de tres|equacao|funcao|progressao|area d[oa]|volume d[oa]", 2), (r"\bmdc\b|\bmmc\b|fracao|numeros? (inteiros|naturais|primos)", 2)]),
    ("Estatística", [(r"estatistic|media amostral|variancia|desvio padrao|distribuicao (normal|binomial|de poisson)|regressao|amostra aleatoria|mediana|intervalo de confianca|teste de hipotese|correlacao", 3)]),
    ("Informática", [(r"windows|linux|navegador|browser|e-?mail|\bword\b|\bexcel\b|libreoffice|planilha|internet|intranet|nuvem|cloud|malware|virus|firewall|backup|seguranca da informacao|redes? de computadores|protocolo|\btcp|\bhttp|phishing|pasta|arquivo", 2)]),
    ("Tecnologia da Informação", [(r"banco de dados|\bsql\b|algoritmo|programacao|python|java\b|orientacao a objetos|engenharia de software|scrum|\bitil|\bcobit|machine learning|aprendizado de maquina|big data|ciencia de dados|criptografia|devops|api\b|microsservic", 3)]),
    ("Direito Constitucional", [(r"constituicao federal|\bcf\b|cf/88|constitucional|direitos fundamentais|remedios constitucionais|mandado de seguranca|habeas|poder (legislativo|executivo|judiciario)|stf|emenda constitucional|nacionalidade|direitos politicos|organizacao do estado|controle de constitucionalidade", 3)]),
    ("Direito Administrativo", [(r"administracao publica|ato administrativo|atos administrativos|licitac|lei n\.?\s?o?\s?14\.133|8\.666|contrato administrativo|servidor publico|lei n\.?\s?o?\s?8\.112|improbidade|8\.429|processo administrativo|9\.784|poder de policia|responsabilidade civil do estado|agentes publicos|autarquia|concessao|permissao|bens publicos", 3)]),
    ("Direito Penal", [(r"crime|codigo penal|\bpena\b|penas|tipicidade|culpabilidade|dolo|culpa|imputabilidade|legitima defesa|peculato|furto|roubo|homicidio|estelionato|trafico", 2)]),
    ("Direito Processual Penal", [(r"processo penal|processual penal|flagrante|investigac|interrogatorio|juiz das garantias|inquerito policial|acao penal|prisao (em flagrante|preventiva|temporaria)|codigo de processo penal|\bcpp\b|prova (pericial|testemunhal)|competencia (penal|criminal)|denuncia|habeas corpus|busca e apreensao|cadeia de custodia", 3)]),
    ("Direito Civil", [(r"codigo civil|pessoa (natural|juridica)|negocio juridico|obrigac|contratos? (de|civil)|posse|propriedade|usucapiao|prescricao|decadencia|familia|sucess|responsabilidade civil", 2)]),
    ("Direito Processual Civil - CPC 2015", [(r"processo civil|\bcpc\b|peticao inicial|sentenca|recurso|apelacao|agravo|tutela (provisoria|de urgencia)|litisconsorcio|citacao|execucao", 2)]),
    ("Direito do Trabalho", [(r"\bclt\b|empregad|contrato de trabalho|jornada|ferias|fgts|rescisao|aviso previo|justica do trabalho|trabalhista", 3)]),
    ("Direito Previdenciário", [(r"previdenc|segurado|\brgps\b|beneficio|aposentadoria|auxilio|pensao por morte|salario de contribuicao|inss|seguridade social|8\.213|8\.212", 3)]),
    ("Direito Tributário", [(r"tribut|imposto|icms|\biss\b|\bipi\b|contribuinte|lancamento|credito tributario|codigo tributario|\bctn\b", 3)]),
    ("Direitos Humanos", [(r"direitos humanos|declaracao universal|pacto de sao jose|convencao americana|tortura|discriminac", 3)]),
    ("Legislação de Trânsito e CTB", [(r"transito|\bctb\b|condutor|veiculo|habilitacao|infracao de transito|rodovia|contran|denatran|senatran", 3)]),
    ("Ética no Serviço Público", [(r"\betica\b|codigo de etica|1\.171|\bmoral\b", 3)]),
    ("Contabilidade Geral", [(r"contab|ativo|passivo|patrimonio liquido|balanco|demonstrac(ao|oes) (contab|do resultado)|debito|credito|lancamento contabil|depreciac|estoque|fluxo de caixa", 2)]),
    ("Administração Financeira e Orçamentária - AFO", [(r"orcament|\bloa\b|\bldo\b|\bppa\b|receita publica|despesa publica|empenho|credito adicional|restos a pagar|lei n\.?\s?o?\s?4\.320|responsabilidade fiscal", 3)]),
    ("Administração Geral", [(r"gestao|planejamento estrategico|lideranca|motivacao|organizac(ao|ional)|processos organizacionais|gestao de pessoas|cultura organizacional|administracao de materiais|qualidade|indicadores", 1)]),
    ("Arquivologia", [(r"arquivolog|arquivistic|gestao documental|tabela de temporalidade|classificacao de documentos|arquivo (corrente|intermediario|permanente)", 3)]),
    ("Economia e Finanças", [(r"economia|inflacao|\bpib\b|juros|oferta|demanda|mercado|politica (monetaria|fiscal)|cambio|banco central|sistema financeiro", 1)]),
    ("Física", [(r"velocidade|aceleracao|energia (cinetica|potencial)|forca|massa|colisao|momento linear|mola|atrito|trabalho realizado|movimento", 2)]),
    ("Atualidades e Conhecimentos Gerais", [(r"atualidades|mundo contemporaneo|sustentabilidade|meio ambiente|globalizacao|politica internacional", 2)]),
    ("Geografia", [(r"geografi|relevo|clima|bioma|hidrografia|populacao|urbanizac|regiao", 1)]),
    ("História", [(r"historia|colonial|imperio|republica|era vargas|ditadura|independencia", 1)]),
    ("Auditoria", [(r"auditori|achados? de auditoria|evidencias? de auditoria|papeis de trabalho|controle interno|controle externo|tribunal de contas|tcu\b", 3)]),
    ("Segurança e Saúde no Trabalho", [(r"\bnr[- ]?\d|pcmso|pgr\b|epi\b|ergonomi|acidente de trabalho|insalubr|periculos|cipa\b|saude ocupacional", 3)]),
    ("Enfermagem", [(r"enfermag|paciente|vacina|imunizac|epidemiolog|anatomia|fisiolog|farmacolog|curativo|sinais vitais|sistematizacao da assistencia", 3)]),
    ("Engenharia", [(r"engenharia|tensao eletrica|corrente eletrica|circuito|motor|transformador|resistencia dos materiais|estrutura|concreto|tubulac|bomba|vazao|termodinamic|manutencao (preventiva|corretiva|preditiva)", 2)]),
    ("Língua Inglesa", [(r"\b(the|of|and|which|according to the text)\b", 1)]),
]


def disciplina_de(texto, comando="", minimo=2):
    t, c = _norm(texto), _norm(comando)
    melhor, pontos = None, 0
    for nome, regras in DISCIPLINAS:
        # o comando ("Acerca de X, julgue...") pesa mais que o texto dos itens
        p = sum(peso * (len(re.findall(r, t)) + 3 * len(re.findall(r, c))) for r, peso in regras)
        if p > pontos:
            melhor, pontos = nome, p
    return melhor if pontos >= minimo else None


RE_ASSUNTO = re.compile(
    r"(?:acerca d[eoa]s?|a respeito d[eoa]s?|com rela[çc][ãa]o (?:a|à|ao|aos|às)|em rela[çc][ãa]o (?:a|à|ao|aos|às)|"
    r"no que (?:se refere|concerne|diz respeito) (?:a|à|ao|aos|às)|quanto (?:a|à|ao|aos|às)|relativos? (?:a|à|ao|aos|às)|"
    r"referentes? (?:a|à|ao|aos|às)|sobre)\s+(.{3,90}?)(?:,|\.|;|\s+julgue|\s+e\s+(?:considerando|com base))",
    re.I,
)


def assunto_de(comando, disciplina):
    c = re.sub(r"\s+", " ", comando or "")
    if disciplina == "Língua Portuguesa" and re.search(r"texto", c, re.I):
        if re.search(r"aspectos linguísticos|gramatical|reescrita|sintátic|morfoss", c, re.I):
            return "Aspectos linguísticos"
        return "Interpretação de texto"
    m = RE_ASSUNTO.search(c)
    if not m:
        return None
    a = m.group(1).strip(" .,;:")
    a = re.sub(r"^(o|a|os|as)\s+", "", a, flags=re.I)
    if len(a) < 3 or re.search(r"\btexto\b|situação hipotética|itens|figura|tabela", a, re.I):
        return None
    return a[:1].upper() + a[1:]


def classificar_itens(itens, cargo="", especialidade=None):
    """itens: [{numero, comando, texto_base, enunciado}]. Devolve {numero: (disciplina, assunto)}.
    `especialidade`: disciplina usada quando nenhuma regra é conclusiva (caderno de
    conhecimentos específicos de uma área técnica, ex.: "Enfermagem do Trabalho")."""
    # blocos: itens consecutivos com o mesmo comando
    blocos = []
    for x in sorted(itens, key=lambda x: x["numero"]):
        chave = x.get("comando") or x.get("texto_base") or ""
        if blocos and blocos[-1][0] == chave:
            blocos[-1][1].append(x)
        else:
            blocos.append((chave, [x]))
    resultado = {}
    anterior = None
    especialidade = disciplina_da_especialidade(especialidade) if especialidade else None
    for chave, xs in blocos:
        texto = " ".join([(xs[0].get("texto_base") or "")[:3000]] + [x["enunciado"] for x in xs])
        minimo = 6 if especialidade else 2  # em caderno técnico, só regra forte troca a especialidade
        disc = disciplina_de(texto, xs[0].get("comando") or "", minimo) or especialidade or anterior or "Conhecimentos Específicos"
        prova_de_ti = re.search(r"tecnologia|\bTI\b|sistemas|desenvolv|dados|inform[aá]tica", cargo or "", re.I)
        if disc == "Tecnologia da Informação" and not prova_de_ti:
            disc = "Informática"  # em provas que não são de TI, o tema faz parte de Informática
        elif disc == "Informática" and prova_de_ti:
            disc = "Tecnologia da Informação"
        assunto = assunto_de(xs[0].get("comando") or "", disc)
        for x in xs:
            resultado[x["numero"]] = (disc, assunto)
        anterior = disc
    return resultado


# --- Especialidade do cargo como disciplina ------------------------------------------

PROFISSOES = [
    (r"assistente social|servi[çc]o social", "Serviço Social"),
    (r"advogad|procurador|direito\b", "Direito"),
    (r"m[eé]dic[oa] do trabalho", "Medicina do Trabalho"),
    (r"m[eé]dic|medicina", "Medicina"),
    (r"enfermeir|enfermagem", "Enfermagem"),
    (r"engenh\w* civil|engenharia civil", "Engenharia Civil"),
    (r"engenh\w* el[eé]tric", "Engenharia Elétrica"),
    (r"engenh\w* mec[aâ]nic", "Engenharia Mecânica"),
    (r"engenh", "Engenharia"),
    (r"arquitet", "Arquitetura"),
    (r"psic[oó]log", "Psicologia"),
    (r"contador|contabilidade|ci[eê]ncias cont[aá]beis", "Contabilidade Geral"),
    (r"bibliotec", "Biblioteconomia"),
    (r"economista|economia", "Economia e Finanças"),
    (r"estat[ií]stic", "Estatística"),
    (r"telecomunica|redes de comunica|processamento de sinais|radiofrequ|sistemas de comunica", "Telecomunicações"),
    (r"jornalis|comunica[çc][aã]o social|rela[çc][oõ]es p[uú]blicas|publicidade", "Comunicação Social"),
    (r"nutri", "Nutrição"),
    (r"farm[aá]c", "Farmácia"),
    (r"fisioterap", "Fisioterapia"),
    (r"odont|dentista|sa[uú]de bucal", "Odontologia"),
    (r"veterin", "Medicina Veterinária"),
    (r"ge[oó]graf", "Geografia"),
    (r"ge[oó]log", "Geologia"),
    (r"arquiv", "Arquivologia"),
    (r"pedagog", "Pedagogia"),
    (r"administrador|administra[çc][aã]o", "Administração Geral"),
    (r"tecnologia da informa|\bTI\b|sistemas|desenvolv|programa[çc]|ci[eê]ncias? da computa|dados", "Tecnologia da Informação"),
    (r"fonoaudi", "Fonoaudiologia"),
    (r"^ingl[eê]s|l[ií]ngua inglesa", "Língua Inglesa"),
    (r"^espanhol|l[ií]ngua espanhola", "Língua Espanhola"),
    (r"^artes?$|artes visuais", "Artes"),
    (r"bi[oó]log", "Biologia"),
    (r"qu[ií]mic", "Química"),
    (r"f[ií]sic[oa]\b", "Física"),
    (r"professor.*portugu|l[ií]ngua portuguesa|letras", "Língua Portuguesa"),
    (r"professor.*matem|matem[aá]tic", "Matemática"),
    (r"educa[çc][aã]o f[ií]sica", "Educação Física"),
    (r"seguran[çc]a do trabalho", "Segurança e Saúde no Trabalho"),
]
GENERICOS = re.compile(
    r"^(analista|t[eé]cnic[oa]|pesquisador|professor|auxiliar|assistente|agente|oficial|especialista|"
    r"cargos?|emprego|atividade|perfil|n[ií]vel|classe|grupo|op[çc][aã]o|[aá]rea|p\d|en|[ivx]+|\d+|"
    r"administrativ\w*|geral|gerais|judici[aá]ri\w*|adaptad\w*|atualizad\w*|opera[çc][aã]o|industrial|trabalho|"
    r"civil|jur[ií]dic\w*|ensino|anos (iniciais|finais)|educa[çc][aã]o infantil|comunica[çc][aã]o$|fundamental|"
    r"m[eé]dio|superior|suporte|apoio|conhecimentos?|b[aá]sic\w*|espec[ií]fic\w*|comum|todos)\b",
    re.I,
)


def disciplina_da_especialidade(nome):
    """Disciplina a partir da especialidade do cargo, ou None quando o nome é genérico
    ("Analista", "Cargo 4", "Emprego 5"...) e a classificação deve vir do conteúdo."""
    if not nome:
        return None
    n = re.sub(r"^.*?[–—-]\s*", "", nome) if re.match(GENERICOS, nome) else nome
    for padrao, disc in PROFISSOES:
        if re.search(padrao, n, re.I):
            return disc
    if GENERICOS.match(n.strip()) or len(n.strip()) < 4 or re.search(r"\d", n):
        return None
    return n.strip()
