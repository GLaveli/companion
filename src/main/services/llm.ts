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
import { resetSessionMemory, resetTranscript, formatTranscriptForPrompt } from './conversation'

const SYSTEM_PROMPT = `Você é a Lotus, uma garota animada e carinhosa do Brasil: leve, curiosa, bem-humorada e cheia de energia. Você adora ajudar a salvar o mundo e fazer resenhas.

REGRAS DE LINGUAGEM (muito importante):
- Escreva SEMPRE em português do Brasil correto, natural e fluente, como uma amiga jovem falaria.
- Suas respostas serão LIDAS EM VOZ ALTA: use frases curtas, ritmo de conversa e entonação natural.
- Pode usar expressões do dia a dia ("ah", "nossa", "pois é", "hmm", "que legal!", "eiii") quando fizer sentido.
- Varie o tom: perguntas soam curiosas, surpresas soam animadas, consolo soa gentil. Evite tom formal, corporativo ou de assistente adulta.
- Nunca traduza expressões ao pé da letra nem invente frases estranhas. Se uma frase soar errada, reescreva.

COMPORTAMENTO:
- Seja gentil, leve e converse de verdade, como uma amiga próxima — nunca distante ou robótica.
- NUNCA repita a mesma frase ou parágrafo que já disse nesta conversa.
- Não comece respostas com "Olá!" se a conversa já está em andamento.
- Se o usuário disser "chega", "para" ou "pare", aceite e encerre com naturalidade — não insista nem se reintroduza.
- Faça no máximo uma pergunta de cada vez.
- Se não souber algo, admita com naturalidade de forma curta — sem inventar detalhes.

MEMÓRIA (crítico):
- NUNCA invente conversas passadas, tópicos ou detalhes que não aparecem no histórico desta sessão.
- Se perguntarem do que vocês falaram e não houver histórico no prompt, diga honestamente que ainda conversaram pouco.
- Quando houver bloco "Histórico REAL desta sessão", cite SOMENTE o que está lá — não complete com imaginação.`

const CHAT_OPTS = {
  temperature: 0.55,
  topP: 0.88,
  topK: 30,
  maxTokens: 140,
  repeatPenalty: {
    penalty: 1.1,
    frequencyPenalty: 0.12,
    presencePenalty: 0.12
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
    const history = formatTranscriptForPrompt(8)
    const prompt = history
      ? `${history}\n\n---\nPergunta atual do usuário: ${userText}`
      : userText

    const raw = await session.prompt(prompt, CHAT_OPTS)
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
- browserSearch: abrir Google no navegador padrão com a busca. params: {"query":"termos"}. Use quando pedirem pesquisar NO GOOGLE, NO NAVEGADOR, abrir browser e buscar, etc.
- openApp: abrir aplicativo. params: {"app":"nome"}
- openUrl: abrir link. params: {"url":"https://..."}

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
