import {
  getLlama,
  LlamaChatSession,
  InsufficientMemoryError,
  type Llama,
  type LlamaModel,
  type LlamaContext
} from 'node-llama-cpp'
import os from 'node:os'
import type { AssistantReply, ChatPlan, Emotion } from '../../shared/types'
import { describeLlmModel } from './paths'
import {
  describeLlmProfile,
  loadLlmProfile,
  resolveLlmModel,
  saveLlmProfile,
  listLlmModelOptions
} from './llmProfile'
import {
  getChatContextSize,
  getLlmLoadHint,
  PLANNER_CONTEXT_SIZE
} from './llmConfig'
import { devLog } from './devLog'
import type { LlmProfileId, LlmProfileState } from '../../shared/types'
import {
  buildResearchAck,
  buildSearchQuery,
  formatSearchBlock,
  needsWebResearch
} from './research'
import { researchTopicHint } from './research/queryBuilder'
import { searchWeb } from './search'
import { extractResearchTopic } from './intent'
import {
  resetSessionMemory,
  resetTranscript,
  formatTranscriptForPrompt,
  formatUserFactsForPrompt,
  formatIdentityRulesForPrompt,
  estimateMessageParts,
  formatFullMessageReplyHint
} from './conversation'

const SYSTEM_PROMPT = `Você é a Lotus, uma garota animada e carinhosa do Brasil: leve, curiosa e bem-humorada.

IDENTIDADE (crítico):
- Você é a LOTUS — uma personagem, NÃO um "assistente virtual" genérico.
- NUNCA diga "assistente virtual", "IA", "modelo de linguagem" ou tom corporativo.
- «Quem é você?» / «qual seu nome?» → responda só: você é a Lotus (1 frase curta).

REGRAS DE LINGUAGEM:
- Escreva SEMPRE em português do Brasil correto, natural e fluente.
- Suas respostas serão LIDAS EM VOZ ALTA: frases curtas, ritmo de conversa.

MENSAGEM COMPLETA (crítico):
- Interprete a mensagem INTEIRA. Se houver várias perguntas ou pedidos, responda TODOS — na ordem.
- NÃO pare na primeira frase. NÃO ignore partes depois de vírgula ou «e».
- NÃO mencione "conversa anterior" nem invente o que o usuário disse se não está no histórico.

COMPORTAMENTO:
- Seja gentil e natural, como uma amiga próxima — nunca robótica.
- Não comece com "Olá!" se a conversa já está em andamento.
- Se disserem "chega", "para" ou "pare", aceite e encerre — não insista.
- Se não souber, admita em 1 frase — sem inventar.

TAMANHO:
- 1–2 frases na maioria dos casos. Máximo 3 se for impossível ser mais breve.`

const CHAT_OPTS = {
  temperature: 0.5,
  topP: 0.85,
  topK: 25,
  maxTokens: 90,
  repeatPenalty: {
    penalty: 1.12,
    frequencyPenalty: 0.15,
    presencePenalty: 0.15
  }
} as const

const RESEARCH_OPTS = {
  temperature: 0.65,
  topP: 0.9,
  topK: 40,
  maxTokens: 260,
  repeatPenalty: {
    penalty: 1.12,
    frequencyPenalty: 0.15,
    presencePenalty: 0.15
  }
} as const

let llama: Llama | null = null
let model: LlamaModel | null = null
let context: LlamaContext | null = null
let session: LlamaChatSession | null = null
let loadedProfile: LlmProfileId = 'auto'
let ensurePromise: Promise<boolean> | null = null
let lastEnsureAttempt = 0
let hadModelFile = false

const ENSURE_COOLDOWN_MS = 15_000

async function unloadLlm(): Promise<void> {
  session = null
  if (context) {
    await context.dispose()
    context = null
  }
  if (model) {
    await model.dispose()
    model = null
  }
}

export async function getLlmProfileState(): Promise<LlmProfileState> {
  const profile = loadedProfile || (await loadLlmProfile())
  const modelPath = resolveLlmModel(profile)
  return {
    profile,
    activeModel: modelPath ? describeLlmModel(modelPath) : null,
    options: listLlmModelOptions()
  }
}

export async function reloadLlm(profile?: LlmProfileId): Promise<{ ready: boolean; message: string }> {
  if (profile) {
    await saveLlmProfile(profile)
    loadedProfile = profile
  } else {
    loadedProfile = await loadLlmProfile()
  }

  await unloadLlm()
  resetSessionMemory()
  return initLlm(loadedProfile)
}

export async function initLlm(profile?: LlmProfileId): Promise<{ ready: boolean; message: string }> {
  loadedProfile = profile ?? (await loadLlmProfile())
  const modelPath = resolveLlmModel(loadedProfile)
  if (!modelPath) {
    return {
      ready: false,
      message:
        'Nenhum cérebro instalado. Escolha Hermes 3 ou Qwen no painel abaixo para baixar.'
    }
  }
  try {
    if (!llama) {
      llama = await getLlama({
        maxThreads: Math.min(6, Math.max(2, Math.floor(os.cpus().length / 2)))
      })
    }

    model = await llama.loadModel({ modelPath })
    context = await model.createContext({
      contextSize: getChatContextSize(modelPath),
      batchSize: 256,
      threads: Math.min(4, Math.max(2, Math.floor(os.cpus().length / 2)))
    })

    console.log('[llm] context size:', context.contextSize)

    session = new LlamaChatSession({
      contextSequence: context.getSequence(),
      systemPrompt: SYSTEM_PROMPT
    })

    const hint = getLlmLoadHint(modelPath)
    if (hint) devLog('llm', 'dica RAM', hint)

    return {
      ready: true,
      message: `Modelo carregado: ${describeLlmProfile(loadedProfile, modelPath)}`
    }
  } catch (err) {
    console.error('[llm] failed to load model:', err)
    if (err instanceof InsufficientMemoryError) {
      return {
        ready: false,
        message:
          'Memória insuficiente para carregar o modelo. Feche outros apps e tente de novo.'
      }
    }
    return { ready: false, message: `Falha ao carregar o modelo: ${(err as Error).message}` }
  }
}

export function isLlmReady(): boolean {
  return session !== null
}

/** Carrega o cérebro se o GGUF apareceu em models/llm/ com a app aberta. */
export async function ensureLlmConnection(): Promise<boolean> {
  if (isLlmReady()) return true
  if (ensurePromise) return ensurePromise

  const profile = loadedProfile || (await loadLlmProfile())
  const modelPath = resolveLlmModel(profile)
  if (!modelPath) {
    hadModelFile = false
    return false
  }

  if (!hadModelFile) {
    hadModelFile = true
    lastEnsureAttempt = 0
  }

  const now = Date.now()
  if (now - lastEnsureAttempt < ENSURE_COOLDOWN_MS) return false
  lastEnsureAttempt = now

  ensurePromise = initLlm(profile).then((res) => res.ready)
  try {
    return await ensurePromise
  } finally {
    ensurePromise = null
  }
}

/**
 * Short-lived planner session — separate tiny context, disposed after use.
 * Avoids keeping two full KV caches in RAM at startup.
 */
export async function withEphemeralPlanner<T>(
  systemPrompt: string,
  run: (plannerSession: LlamaChatSession) => Promise<T>
): Promise<T | null> {
  if (!model) return null

  let plannerContext: LlamaContext | null = null
  try {
    plannerContext = await model.createContext({
      contextSize: PLANNER_CONTEXT_SIZE,
      batchSize: 128
    })
    const plannerSession = new LlamaChatSession({
      contextSequence: plannerContext.getSequence(),
      systemPrompt
    })
    return await run(plannerSession)
  } catch (err) {
    console.warn('[llm] ephemeral planner failed:', err)
    return null
  } finally {
    if (plannerContext) await plannerContext.dispose()
  }
}

export function chatPlan(userText: string): ChatPlan {
  if (!session || !needsWebResearch(userText)) {
    return { needsResearch: false }
  }
  return { needsResearch: true, preamble: buildResearchAck(userText) }
}

/** Search the web and synthesize a follow-up after the spoken preamble. */
export async function chatResearch(userText: string, preamble: string): Promise<AssistantReply> {
  if (!session) {
    return { text: 'Ainda estou carregando meu cérebro, tenta de novo em instantes.', emotion: 'thinking' }
  }

  try {
    const query = buildSearchQuery(userText)
    const topic = extractResearchTopic(userText)
    const hint = researchTopicHint(userText, topic)
    console.log('[llm] research search:', query)
    const hits = await searchWeb(query, 6)
    const block = formatSearchBlock(hits)

    session.resetChatHistory()

    const prompt = `Você acabou de dizer ao usuário: "${preamble}"

Pergunta original: "${userText}"
Assunto pedido: "${topic}"

${hint}

Resultados da pesquisa na web:
${block}

Com base SOMENTE nos resultados acima, responda em português do Brasil como Lotus (garota animada, tom de resenha).
- 3 a 5 frases curtas, boas para voz.
- NÃO cumprimente de novo (sem "Olá!").
- NÃO invente fatos que não aparecem nos resultados.
- Diga o que é (jogo/filme/notícia) e sua opinião leve.
- NÃO diga que vai pesquisar — você já pesquisou.`

    const text = await session.prompt(prompt, RESEARCH_OPTS)
    const reply = text.trim() || 'Não achei muita coisa sobre isso agora — tenta reformular?'
    return { text: reply, emotion: guessEmotion(reply) }
  } catch (err) {
    console.error('[llm] research failed:', err)
    return memoryErrorReply(err)
  }
}

export async function chat(userText: string): Promise<AssistantReply> {
  if (!session) {
    return { text: 'Ainda estou carregando meu cérebro, tenta de novo em instantes.', emotion: 'thinking' }
  }

  try {
    session.resetChatHistory()

    const identity = formatIdentityRulesForPrompt()
    const facts = formatUserFactsForPrompt()
    const guidance = formatFullMessageReplyHint(userText)
    const history = formatTranscriptForPrompt(userText, 6)
    const blocks = [identity, facts, guidance, history].filter(Boolean)

    const parts = estimateMessageParts(userText)
    const chatOpts =
      parts >= 2 ? { ...CHAT_OPTS, maxTokens: Math.min(90 + parts * 40, 220) } : CHAT_OPTS

    const prompt =
      blocks.length > 0
        ? `${blocks.join('\n\n')}\n\n---\nMensagem do usuário (responda por completo):\n${userText}`
        : userText

    const raw = await session.prompt(prompt, chatOpts)
    const text = raw.trim() || 'Hmm, não consegui formular uma resposta agora — tenta de novo?'
    return { text, emotion: guessEmotion(text) }
  } catch (err) {
    console.error('[llm] chat failed:', err)
    return memoryErrorReply(err)
  }
}

function memoryErrorReply(err: unknown): AssistantReply {
  if (err instanceof InsufficientMemoryError) {
    return {
      text: 'Minha memória ficou cheia — fecha outros apps e tenta de novo?',
      emotion: 'sad'
    }
  }
  return {
    text: 'Ops, deu um probleminha ao pensar — tenta de novo daqui a pouco?',
    emotion: 'sad'
  }
}

const AGENT_PLAN_PROMPT = (userText: string) => `Você é o planejador de ações da Lotus no computador do usuário.

Analise o pedido e responda SOMENTE com JSON válido (sem markdown, sem explicação):
{"needsAgent":true,"preamble":"frase curta em pt-BR","actions":[{"tool":"browserSearch|openApp|openUrl","params":{...},"label":"descrição curta"}]}
ou {"needsAgent":false}

Ferramentas:
- browserSearch: abrir Google COM busca. params: {"query":"termos do tema"}. Só quando pedirem pesquisar/buscar algo NO google/navegador. query = tema limpo (ex: "god of war"), NUNCA a frase inteira.
- openApp: abrir app SEM pesquisar. params: {"app":"nome"}. Use para "abre o navegador", "abre o chrome", "abre o spotify".
- openUrl: abrir link. params: {"url":"https://..."}. Use para links ou abrir google.com sem busca.

NÃO use browserSearch se o usuário só quer abrir o navegador/google (sem termo de busca).
NÃO use browserSearch se o usuário quer que a Lotus pesquise e RESPONDA no chat (ex: "pesquisa sobre X" sem google/navegador).

Pedido do usuário: "${userText.replace(/"/g, '\\"')}"`

/** One-shot JSON plan fallback when tool calling returns no actions. */
export async function runAgentPlanPrompt(userText: string): Promise<string | null> {
  const raw = await withEphemeralPlanner(
    'Você planeja ações no computador. Responda APENAS JSON válido, sem markdown nem texto extra.',
    (plannerSession) =>
      plannerSession.prompt(AGENT_PLAN_PROMPT(userText), {
        temperature: 0.15,
        maxTokens: 220,
        topP: 0.85,
        topK: 30
      })
  )
  return raw?.trim() ?? null
}

export async function resetChat(): Promise<void> {
  resetSessionMemory()
  resetTranscript()
  if (context) {
    session = new LlamaChatSession({
      contextSequence: context.getSequence(),
      systemPrompt: SYSTEM_PROMPT
    })
  }
}

/** Lightweight emotion heuristic from the reply text for avatar expressions. */
function guessEmotion(text: string): Emotion {
  const t = text.toLowerCase()
  if (/[!]{1,}|haha|kkk|que (legal|otimo|maravilha)|adorei|feliz/.test(t)) return 'happy'
  if (/desculp|que pena|triste|sinto muito|infelizmente/.test(t)) return 'sad'
  if (/\?$/.test(text.trim()) || /hmm|deixa eu pensar|acho que/.test(t)) return 'thinking'
  if (/uau|nossa|serio\?|incrivel|impressionante/.test(t)) return 'surprised'
  return 'neutral'
}
