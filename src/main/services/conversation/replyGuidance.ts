/** Estima quantas perguntas/pedidos distintos há na mensagem (inclui ? implícito). */
export function estimateMessageParts(text: string): number {
  const t = text.trim()
  if (!t) return 1

  const explicit = (t.match(/\?/g) ?? []).length
  const questionWords = (
    t.match(/\b(?:qual|como|quem|por\s*que|pq|o\s+que|onde|quando|quantos?|pode|podia)\b/gi) ?? []
  ).length
  const clauses = t.split(/[,;]/).map((s) => s.trim()).filter((s) => s.length > 4).length

  let parts = explicit
  if (parts === 0 && questionWords > 0) parts = questionWords
  if (clauses > 1) parts = Math.max(parts, clauses)
  if (questionWords > 1) parts = Math.max(parts, questionWords)

  return Math.max(1, parts)
}

/** Instrução para o LLM interpretar a mensagem inteira — sem atalhos de frase fixa. */
export function formatFullMessageReplyHint(userText: string): string {
  const parts = estimateMessageParts(userText)
  const lines = [
    'INTERPRETAÇÃO DA MENSAGEM (obrigatório):',
    '- Leia a mensagem INTEIRA — não pare na primeira frase ou na primeira pergunta.',
    '- Responda TODAS as perguntas e pedidos presentes, na ordem natural, em português do Brasil.',
    '- Se ele disser algo sobre si E perguntar algo sobre você, responda as duas coisas.',
    '- NUNCA invente detalhes de conversas anteriores que não estão no histórico acima.'
  ]

  if (parts >= 2) {
    lines.push(
      `- Esta mensagem parece ter cerca de ${parts} partes — cubra todas em até ${Math.min(parts + 1, 6)} frases curtas.`
    )
  } else {
    lines.push('- Responda de forma completa mas concisa (1–2 frases na maioria dos casos).')
  }

  return lines.join('\n')
}
