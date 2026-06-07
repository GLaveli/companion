/** Perguntas sobre memória passada — não devem disparar pesquisa web. */
export function isMemoryRecallIntent(text: string): boolean {
  const t = text.trim().toLowerCase()
  if (
    /\b(lembra|lembrar|lembro|memória|memoria|última conversa|ultima conversa|conversa anterior|retoma|continuar de onde|pesquisei|pesquisamos|busquei|buscamos)\b/i.test(
      t
    )
  ) {
    return true
  }
  if (/\b(sobre o que|do que)\s+(?:j[aá]\s+)?(?:convers|fal)/i.test(t)) return true
  if (/\bo que (?:a gente |nós |nos |j[aá]\s+)?(?:convers|fal)(?:amos|ávamos|avamos)?\b/i.test(t)) {
    return true
  }
  if (/\bnossa conversa\b/i.test(t)) return true
  if (/\b(?:j[aá]|ja)\s+falamos\b/i.test(t)) return true
  if (/\bfalamos\s+(?:no\s+)?passado\b/i.test(t)) return true
  if (/\bconversamos\s+(?:no\s+)?passado\b/i.test(t)) return true
  if (/\bfalamos\b.*\b(?:sobre|de)\b/i.test(t)) return true
  if (/\b(?:antes|atr[aá]s|atras|passado|mais tempo)\b.*\b(?:convers|fal)(?:amos|ávamos|avamos)?\b/i.test(t)) {
    return true
  }
  if (/\b(?:convers|fal)(?:amos|ávamos|avamos)?\b.*\b(?:antes|atr[aá]s|atras|passado|mais tempo)\b/i.test(t)) {
    return true
  }
  return false
}
