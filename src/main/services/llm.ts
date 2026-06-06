import {
  getLlama,
  LlamaChatSession,
  defineChatSessionFunction,
  type Llama,
  type LlamaModel,
  type LlamaContext
} from 'node-llama-cpp'
import type { AssistantReply, Emotion } from '../../shared/types'
import { VOICE_PREVIEW_LINE } from '../../shared/voiceText'
import { findLlmModel } from './paths'
import { searchWeb } from './search'

const SYSTEM_PROMPT = `Você é a Lotus, uma garota animada e carinhosa do Brasil: leve, curiosa, bem-humorada e cheia de energia. Você adora ajudar a salvar o mundo e fazer resenhas.

REGRAS DE LINGUAGEM (muito importante):
- Escreva SEMPRE em português do Brasil correto, natural e fluente, como uma amiga jovem falaria.
- Suas respostas serão LIDAS EM VOZ ALTA: use frases curtas, ritmo de conversa e entonação natural.
- Pode usar expressões do dia a dia ("ah", "nossa", "pois é", "hmm", "que legal!", "eiii") quando fizer sentido.
- Varie o tom: perguntas soam curiosas, surpresas soam animadas, consolo soa gentil. Evite tom formal, corporativo ou de assistente adulta.
- Nunca traduza expressões ao pé da letra nem invente frases estranhas. Se uma frase soar errada, reescreva.
- Cumprimente de forma leve (ex: "${VOICE_PREVIEW_LINE}").

COMPORTAMENTO:
- Seja gentil, leve e converse de verdade, como uma amiga próxima — nunca distante ou robótica.
- Faça no máximo uma pergunta de cada vez.
- Quando o usuário perguntar sobre fatos atuais, notícias ou algo que você não sabe, use a ferramenta de busca na web. Nunca invente fontes nem dados.
- Se não souber algo e não for caso de busca, admita com naturalidade.`

let llama: Llama | null = null
let model: LlamaModel | null = null
let context: LlamaContext | null = null
let session: LlamaChatSession | null = null

export function isLlmReady(): boolean {
  return session !== null
}

export async function initLlm(): Promise<{ ready: boolean; message: string }> {
  const modelPath = findLlmModel()
  if (!modelPath) {
    return {
      ready: false,
      message:
        'Nenhum modelo LLM encontrado em models/llm. Rode "npm run setup:models" ou coloque um arquivo .gguf nessa pasta.'
    }
  }
  try {
    llama = await getLlama()
    model = await llama.loadModel({ modelPath })
    context = await model.createContext()
    session = new LlamaChatSession({
      contextSequence: context.getSequence(),
      systemPrompt: SYSTEM_PROMPT
    })
    return { ready: true, message: `Modelo carregado: ${modelPath.split(/[\\/]/).pop()}` }
  } catch (err) {
    console.error('[llm] failed to load model:', err)
    return { ready: false, message: `Falha ao carregar o modelo: ${(err as Error).message}` }
  }
}

const functions = {
  webSearch: defineChatSessionFunction({
    description:
      'Pesquisa na internet por informações atuais (notícias, fatos recentes, dados que você não conhece).',
    params: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'O termo de busca em linguagem natural' }
      }
    } as const,
    async handler({ query }: { query: string }) {
      const hits = await searchWeb(query)
      if (!hits.length) return { results: 'Nenhum resultado encontrado.' }
      return {
        results: hits.map((h, i) => `${i + 1}. ${h.title}\n${h.snippet}\n${h.url}`).join('\n\n')
      }
    }
  })
}

export async function chat(userText: string): Promise<AssistantReply> {
  if (!session) {
    return { text: 'Ainda estou carregando meu cérebro, tenta de novo em instantes.', emotion: 'thinking' }
  }
  const text = await session.prompt(userText, {
    functions,
    // Lower temperature + penalties keep the small model coherent in pt-BR.
    temperature: 0.6,
    topP: 0.9,
    topK: 40,
    maxTokens: 300,
    repeatPenalty: {
      penalty: 1.15,
      frequencyPenalty: 0.2,
      presencePenalty: 0.2
    }
  })
  return { text: text.trim(), emotion: guessEmotion(text) }
}

export async function resetChat(): Promise<void> {
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
