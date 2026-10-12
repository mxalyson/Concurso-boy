// Área/carreira de uma prova (como nos sites de questões: "Segurança Pública", "Tribunais"...),
// deduzida do órgão e do cargo quando a fonte não informa. Sem dependência do banco.

const REGRAS: [RegExp, string][] = [
  [/pol[ií]cia|policial|\bPF\b|\bDPF\b|\bPRF\b|\bPC[ -]?[A-Z]{2}\b|\bPM[ -]?[A-Z]{2}\b|\bPCDF\b|\bPC-DF\b|soldado|delegado|escriv[aã]o|perito|papiloscop|agente penitenci|pol[ií]cia penal|guarda (civil|municipal)|bombeiro/i, "Segurança Pública"],
  [/\bTJ|\bTRT|\bTRF|\bTRE|\bSTJ|\bSTF|\bTST|\bTSE|\bCNJ|judici[aá]ri|tribunal de justi|escrevente|oficial de justi/i, "Tribunais"],
  [/\bTCU|\bTCE|\bTCM|\bCGU|\bCGE|controle externo|controladoria|auditor de controle/i, "Controle e Gestão"],
  [/receita|\bSEFAZ|\bSEFIN|auditor[- ]fiscal|fiscal de tributos|tribut[aá]ri/i, "Fiscal"],
  [/banco|banc[aá]ri|\bBB\b|\bCEF\b|caixa econ|BANESE|BANRISUL|BRB|BNB|BASA|escritur[aá]rio/i, "Bancária"],
  [/\bINSS|seguro social|previd/i, "Previdência e Seguridade"],
  [/assembleia|\bALE[ -]|c[aâ]mara|senado|legislativ/i, "Legislativa"],
  [/minist[eé]rio p[uú]blico|\bMP[ -]?[A-Z]{2}|\bMPU|defensoria|procuradoria|\bPGE|\bPGM|\bAGU/i, "Funções Essenciais à Justiça"],
  [/sa[uú]de|hospital|enfermeir|m[eé]dico|\bSES\b|\bSUS\b|farmac|odont|fisioter/i, "Saúde"],
  [/professor|educa[çc][aã]o|pedagog|escola/i, "Educação"],
  [/tecnologia da informa|\bTI\b|desenvolv|sistemas|ci[eê]ncia de dados/i, "Tecnologia da Informação (T.I.)"],
  [/conselho (regional|federal)|\bCR[A-Z]{1,3}\b|\bCF[A-Z]{1,3}\b/i, "Conselhos de Fiscalização"],
];

export function areaPorRegras(...textos: (string | null | undefined)[]): string | null {
  const t = textos.filter(Boolean).join(" | ");
  if (!t) return null;
  return REGRAS.find(([re]) => re.test(t))?.[1] ?? null;
}
