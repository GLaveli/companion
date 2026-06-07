/**
 * Gera docs/lotus-memoria-fluxo.pdf a partir do conteúdo estruturado.
 * Uso: node scripts/generate-memory-pdf.mjs
 */
import PDFDocument from 'pdfkit'
import { createWriteStream } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outPath = join(__dirname, '../docs/lotus-memoria-fluxo.pdf')

const doc = new PDFDocument({
  size: 'A4',
  margins: { top: 54, bottom: 54, left: 54, right: 54 },
  info: {
    Title: 'Memória da Lotus — SQLite + Qdrant',
    Author: 'ReDLotuS / Project Companion',
    Subject: 'Fluxo de memória local da Lotus'
  }
})

doc.pipe(createWriteStream(outPath))

const W = doc.page.width - doc.page.margins.left - doc.page.margins.right
const M = doc.page.margins.left

function heading(text, size = 16) {
  doc.moveDown(0.6).font('Helvetica-Bold').fontSize(size).fillColor('#1a1a2e').text(text, M, doc.y, { width: W })
  doc.moveDown(0.3)
}

function subheading(text) {
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#2d2d44').text(text, M, doc.y, { width: W })
  doc.moveDown(0.2)
}

function body(text) {
  doc.font('Helvetica').fontSize(10).fillColor('#333').text(text, M, doc.y, { width: W, lineGap: 3 })
  doc.moveDown(0.35)
}

function mono(text) {
  doc.font('Courier').fontSize(8.5).fillColor('#222').text(text, M, doc.y, { width: W, lineGap: 1.5 })
  doc.moveDown(0.4)
}

function table(rows) {
  const colW = [W * 0.22, W * 0.28, W * 0.32, W * 0.18]
  let y = doc.y
  const rowH = 18
  doc.font('Helvetica-Bold').fontSize(8.5)
  rows[0].forEach((cell, i) => {
    doc.text(cell, M + colW.slice(0, i).reduce((a, b) => a + b, 0), y, { width: colW[i] - 4 })
  })
  y += rowH
  doc.font('Helvetica').fontSize(8.5)
  for (let r = 1; r < rows.length; r++) {
    if (y > doc.page.height - 80) {
      doc.addPage()
      y = doc.page.margins.top
    }
    rows[r].forEach((cell, i) => {
      doc.text(cell, M + colW.slice(0, i).reduce((a, b) => a + b, 0), y, { width: colW[i] - 4 })
    })
    y += rowH
  }
  doc.y = y + 8
}

function ensureSpace(h = 120) {
  if (doc.y > doc.page.height - h) doc.addPage()
}

// Capa
doc.font('Helvetica-Bold').fontSize(22).fillColor('#6b4ce6').text('Memória da Lotus', M, 120, { width: W })
doc.font('Helvetica').fontSize(14).fillColor('#444').text('SQLite + Qdrant — fluxo de escrita e leitura', M, doc.y + 8, { width: W })
doc.moveDown(2)
doc.fontSize(10).fillColor('#666').text('Project Companion · ReDLotuS · Junho 2026', M, doc.y, { width: W })
doc.addPage()

heading('1. Três camadas de memória')
table([
  ['Camada', 'Onde', 'Papel', 'Persiste?'],
  ['Buffer RAM', 'transcript.ts', 'Contexto imediato Hermes', 'Não'],
  ['SQLite', 'userData/memory/', 'Diário: turnos, eventos, FTS', 'Sim'],
  ['Qdrant', 'Docker mind1 :6333', 'Lembrança semântica (vetores)', 'Sim']
])
body('Regra de ouro: SQLite responde o quê / quando; Qdrant responde sobre o quê (similaridade de significado).')

heading('2. Fluxo de escrita (quando salva)')
mono(`Você fala ou escreve
       │
       ▼
 Renderer: recordTurn(user | assistant)
       │
       ▼
 Main: recordTranscriptTurn()
       │
       ├──► Buffer RAM (até 48 turnos)
       ├──► SQLite INSERT turns + FTS5 automático
       └──► Qdrant indexMemoryPoint() — async, não bloqueia`)

subheading('2.1 Cada mensagem do chat')
body('Toda mensagem passa por recordTranscriptTurn: (1) RAM push imediato, (2) SQLite INSERT + trigger FTS5, (3) Qdrant embedding async. Se mind1 offline, fica só no SQLite.')
body('Arquivo: src/main/services/conversation/transcript.ts')

subheading('2.2 Eventos estruturados')
table([
  ['Evento', 'Quando', 'SQLite', 'Qdrant'],
  ['browser_search', 'Pesquisa no Google', 'events {query}', 'Pesquisa no Google: …'],
  ['agent_action', 'Agente executa tool', 'events tool+params', 'toolId: mensagem']
])

subheading('2.3 Na abertura do app')
body('initMemory() carrega últimos 48 turnos → hydrateTranscript() repõe RAM. Qdrant conecta 2,5 s depois (não compete com Live2D + Hermes no boot).')

ensureSpace()
heading('3. Fluxo de leitura (quando pega os dados)')
mono(`                    Mensagem do usuário
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
  «Lembra / do que      «Pesquisa no         Conversa normal
   falamos sobre X?»      Google…»              (chat)
         │                    │                    │
         ▼                    ▼                    ▼
  tryRecallShortcut    tryBrowserSearch       chat() + Hermes
         │                    │                    │
  Qdrant → SQLite FTS   SQLite events         Buffer RAM
  (semântico)           (cronológico)         (8 turnos no prompt)`)

subheading('3.1 Chat normal — só RAM')
body('Hermes recebe no máximo 8 turnos via formatTranscriptForPrompt(8). Não consulta SQLite nem Qdrant neste caminho. Objetivo: coerência imediata, baixo custo de contexto.')
body('Arquivo: src/main/services/llm.ts → chat()')

subheading('3.2 Atalhos de recall — SQLite + Qdrant')
body('Ordem no IPC conversationShortcut: (1) tryRecallShortcut, (2) tryBrowserSearchCommand, (3) tryConversationShortcut. Se detecta «lembra», «do que falamos», «pesquisei» — não chama Hermes.')
table([
  ['Pergunta', 'Fonte primária', 'Fallback'],
  ['Do que falamos sobre X?', 'Qdrant semântico', 'SQLite FTS5'],
  ['Lembra o que falamos?', 'SQLite cronológico', 'Buffer RAM'],
  ['O que pesquisei no Google?', 'SQLite events', '—']
])

subheading('3.3 Agente — memória RAM separada (45 min)')
body('agent/memory.ts guarda fingerprints de ações recentes (anti-repetição). Não usa SQLite/Qdrant de conversa.')

ensureSpace()
heading('4. O que cada banco guarda')
subheading('SQLite (lotus.db)')
mono(`sessions   → id, started_at, last_active_at (1 sessão por boot)
turns      → role, content, timestamp
events     → browser_search | agent_action + JSON
turns_fts  → FTS5 espelhando turns`)

subheading('Qdrant (collection lotus_memory)')
body('Vetor 1024d (multilingual-e5-large). Payload: role, content, at, sessionId, kind. IDs eventos = 1_000_000_000 + event.id. Comando: npm run memory:qdrant')

heading('5. Sequência — exemplo recall')
mono(`1. Usuário: "Lembra do que falamos sobre PS5?"
2. recordTurn(user) → RAM + SQLite + Qdrant (async)
3. conversationShortcut detecta recall
4. extractRecallTopic → "PS5"
5. searchQdrant("PS5") → hits semânticos
6. Resposta montada por regras (sem Hermes)`)

subheading('Sequência — chat normal')
mono(`1. Usuário: "O que acha do Zelda?"
2. recordTurn(user) → RAM + SQLite + Qdrant (async)
3. Atalhos não aplicam → agente → chatPlan → chat()
4. formatTranscriptForPrompt(8) → histórico recente
5. Hermes gera resposta
6. recordTurn(assistant) → RAM + SQLite + Qdrant (async)`)

ensureSpace()
heading('6. Posicionamento estratégico')
mono(`ESCREVER sempre  →  RAM + SQLite (+ Qdrant se online)
LER no chat      →  só RAM (últimos 8 turnos)
LER no recall     →  Qdrant → SQLite FTS/eventos → RAM`)

subheading('Pontos fortes')
body('• Escrita não bloqueia o chat (Qdrant assíncrono).\n• Recall honesto: se não acha, informa — não inventa.\n• SQLite funciona sem Docker; Qdrant opcional para pt-BR.')

subheading('Limitações atuais')
body('• Qdrant não entra no prompt do chat normal — só no atalho «lembra…».\n• Sem reindexação automática quando mind1 volta online.\n• llmReset limpa RAM + Hermes — não apaga SQLite/Qdrant.\n• Qdrant sobe 2,5 s após boot — primeiros turnos podem perder vetor.')

subheading('Próximos passos sugeridos')
body('• RAG no chat() quando a pergunta referencia passado.\n• Reindex SQLite → Qdrant ao conectar mind1.\n• UI para ver e apagar memórias; retenção configurável.')

heading('7. Arquivos principais')
mono(`src/main/services/memory/
  db.ts, store.ts, embeddings.ts, qdrant.ts, health.ts
src/main/services/conversation/
  transcript.ts, recall.ts
docs/MEMORY.md — guia operacional (Docker, env vars)`)

doc.end()

await new Promise((resolve, reject) => {
  doc.on('end', resolve)
  doc.on('error', reject)
})

console.log('PDF gerado:', outPath)
