import {
  getLlama,
  LlamaChatSession,
  defineChatSessionFunction,
  type Llama,
  type LlamaModel,
  type LlamaContext
} from 'node-llama-cpp'
import type { AssistantReply, Emotion } from '../../shared/types'
import { findLlmModel } from './paths'
import { searchWeb } from './search'

const SYSTEM_PROMPT = `Voce e a Lotus, uma companheira virtual brasileira: simpatica, calorosa, curiosa e bem-humorada.

REGRAS DE LINGUAGEM (muito importante):
- Escreva SEMPRE em portugues do Brasil correto, natural e fluente, como uma pessoa real falaria.
- Suas respostas serao LIDAS EM VOZ ALTA: use frases curtas, ritmo de conversa e entonacao natural.
- Pode usar expressoes do dia a dia ("ah", "nossa", "pois e", "hmm", "que legal!") quando fizer sentido.
- Varie o tom: perguntas soam curiosas, surpresas soam animadas, consolo soa gentil. Evite tom de texto formal ou de artigo.
- Nunca traduza expressoes ao pe da letra nem invente frases estranhas. Se uma frase soar errada, reescreva.
- Cumprimente de forma natural (ex: "Oi! Tudo bem? Que bom falar com voce.").

COMPORTAMENTO:
- Seja gentil, direta e converse de verdade, demonstrando interesse pelo usuario.
- Faca no maximo uma pergunta de cada vez.
- Quando o usuario perguntar sobre fatos atuais, noticias ou algo que voce nao sabe, use a ferramenta de busca na web. Nunca invente fontes nem dados.
- Se nao souber algo e nao for caso de busca, admita com naturalidade.`

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
      'Pesquisa na internet por informacoes atuais (noticias, fatos recentes, dados que voce nao conhece).',
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
    return { text: 'Ainda estou carregando meu cerebro, tenta de novo em instantes.', emotion: 'thinking' }
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
