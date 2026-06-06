import { getLlama, LlamaChatSession } from 'node-llama-cpp'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const modelPath = join(__dirname, '..', 'models', 'llm', 'Qwen2.5-3B-Instruct-Q4_K_M.gguf')

console.log('Carregando modelo...')
const llama = await getLlama()
const model = await llama.loadModel({ modelPath })
const context = await model.createContext()
const session = new LlamaChatSession({
  contextSequence: context.getSequence(),
  systemPrompt: 'Você é a Lotus, uma garota animada que fala português do Brasil. Seja breve e leve.'
})

console.log('Perguntando...')
const answer = await session.prompt('Ola! Quem e voce? Responda em uma frase curta.')
console.log('RESPOSTA:', answer)
await llama.dispose()
