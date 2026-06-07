import type { AgentMemoryEntry } from './memory'

const IRONIC_LINES: Array<(entry: AgentMemoryEntry) => string> = [
  (e) => {
    const q = e.params.query ?? e.params.app ?? 'isso'
    return `Eiii, mas eu já fiz isso agora há pouco! A busca por "${q}" já está no navegador — dá uma olhada na aba!`
  },
  (e) => {
    const q = e.params.query ?? 'isso'
    return `Sério? De novo "${q}"? Eu acabei de pesquisar — olha o Google que deixei aberto!`
  },
  (e) => {
    const q = e.params.query ?? 'isso'
    return `Hmm… a gente já buscou "${q}" juntos. Tá tudo aí no navegador, prometo!`
  },
  (e) => {
    const q = e.params.query ?? 'isso'
    return `Opa opa, calma! Já pesquisei "${q}" — não precisa repetir, confia em mim!`
  }
]

export function buildIronicReply(entry: AgentMemoryEntry): string {
  const idx = Math.min(entry.repeatCount, IRONIC_LINES.length - 1)
  return IRONIC_LINES[idx](entry)
}
