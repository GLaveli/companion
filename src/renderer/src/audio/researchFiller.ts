/** Fun facts spoken while web research runs (short, good for TTS). */
const CURIOSITIES = [
  'o primeiro PlayStation saiu no Japão em 1994.',
  'Kratos quase se chamava Dominus nos rascunhos do God of War original.',
  'avatares Live2D usam física de boneco de papel — bem estilo anime.',
  'a voz da Lotus passa pelo Edge TTS, a mesma tech dos narradores da Microsoft.',
  'jogos da Santa Monica Studio levam anos porque cada pedacinho de combate é polido.',
  'no Norse mythology, Laufey é mãe de Loki — no jogo ela virou esposa do Kratos.',
  'muitos trailers de State of Play vazam antes, mas a Sony ainda surpreende.',
  'resenha boa não precisa ser longa: duas frases sinceras valem mais que um textão.',
  'o cérebro da Lotus roda local no seu PC — nada vai pra nuvem no chat.',
  'lip-sync em tempo real mede o volume do áudio pra mover a boca do avatar.',
  'jogos exclusivos de PlayStation costumam nascer em estúdios pequenos dentro da Sony.',
  'Faye no God of War 2018 aparece pouco, mas muda tudo na história do Kratos e do Atreus.'
]

const GAME_CURIOSITIES = [
  'God of War 2018 ganhou Jogo do Ano em 2019.',
  'Ragnarök continuou a história nórdica e fechou o arco do Atreus.',
  'Santa Monica Studio fica na Califórnia e existe desde 1999.',
  'muita gente acha que Kratos só grita, mas no reboot ele quase sussurra.'
]

let lastIndex = -1

function pickFrom(pool: string[], avoid?: Set<number>): string {
  if (pool.length === 1) return pool[0]
  let idx = Math.floor(Math.random() * pool.length)
  let guard = 0
  while ((idx === lastIndex || avoid?.has(idx)) && guard++ < 20) {
    idx = Math.floor(Math.random() * pool.length)
  }
  lastIndex = idx
  avoid?.add(idx)
  return pool[idx]
}

/** Short label for "pesquiso sobre X". */
export function extractResearchTopic(userText: string): string {
  const t = userText.trim()
  if (/god of war/i.test(t)) return 'esse God of War'

  const about = t.match(
    /(?:o que acha do|o que você acha do|sabe sobre|me fala sobre|fala sobre|sobre)\s+(.+?)\??$/i
  )?.[1]
  if (about) {
    const short = about.trim().replace(/\?+$/, '')
    return short.length > 45 ? `${short.slice(0, 42)}…` : short
  }

  const novo = t.match(/(?:novo|nova)\s+(.+?)\??$/i)?.[1]
  if (novo) return `esse ${novo.trim()}`

  return 'isso'
}

/** One spoken filler line while search + LLM run. */
export function pickResearchFiller(userText: string, used = new Set<number>()): string {
  const topic = extractResearchTopic(userText)
  const pool = /god of war|jogo|game|playstation/i.test(userText)
    ? [...GAME_CURIOSITIES, ...CURIOSITIES]
    : CURIOSITIES
  const fact = pickFrom(pool, used)

  const templates = [
    `Enquanto eu pesquiso sobre ${topic}, sabia que ${fact}`,
    `Opa, espera aí — pesquisando ${topic}... sabia que ${fact}`,
    `Já já te conto! Enquanto isso: ${fact.charAt(0).toUpperCase()}${fact.slice(1)}`
  ]
  return templates[Math.floor(Math.random() * templates.length)]
}
