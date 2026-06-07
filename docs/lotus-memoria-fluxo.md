---
title: Memória da Lotus — SQLite + Qdrant
author: ReDLotuS / Project Companion
date: Junho 2026
---

# Memória da Lotus — SQLite + Qdrant

Documento de referência: como a Lotus **salva**, **recupera** e **posiciona** memória local (SQLite, Qdrant e buffer RAM).

---

## 1. Três camadas de memória

| Camada | Onde | Papel | Persiste ao fechar? |
|--------|------|-------|---------------------|
| **Buffer RAM** | `transcript.ts` | Contexto imediato para o Hermes (últimos turnos) | Não |
| **SQLite** (`lotus.db`) | `userData/memory/` | Diário estruturado — turnos, eventos, busca por palavra | Sim |
| **Qdrant** (`mind1`) | Docker :6333 | Lembrança por **significado** (vetores) | Sim |

**Regra de ouro:** SQLite responde *o quê / quando*; Qdrant responde *sobre o quê* (similaridade semântica).

---

## 2. Fluxo de escrita (quando salva)

```
Você fala ou escreve
        │
        ▼
  Renderer: recordTurn(user | assistant)
        │
        ▼
  Main: recordTranscriptTurn()
        │
        ├──► Buffer RAM (até 48 turnos)
        │
        ├──► SQLite INSERT em `turns` + FTS5 automático
        │
        └──► Qdrant indexMemoryPoint() — async, não bloqueia o chat
              (embedding fastembed → upsert em lotus_memory)
```

### 2.1 Cada mensagem do chat

Toda mensagem (usuário e Lotus) passa por `recordTranscriptTurn`:

1. **RAM** — push imediato no array em memória.
2. **SQLite** — `INSERT INTO turns` + índice FTS5 via trigger.
3. **Qdrant** — vetor do texto; se mind1 offline, o turno fica só no SQLite.

Arquivo: `src/main/services/conversation/transcript.ts`

### 2.2 Eventos estruturados (não são turnos)

| Evento | Quando acontece | SQLite | Qdrant |
|--------|-----------------|--------|--------|
| `browser_search` | «Pesquisa no Google…» | tabela `events` com `{ query }` | `"Pesquisa no Google: {query}"` |
| `agent_action` | Agente executa uma tool | tabela `events` com tool + params | `"{toolId}: {mensagem}"` |

Arquivos: `browserSearch.ts`, `agent/index.ts`

### 2.3 Na abertura do app

1. `initMemory()` — abre SQLite, cria sessão, carrega últimos **48 turnos**.
2. `hydrateTranscript()` — repõe o buffer RAM.
3. **Qdrant** conecta **2,5 s depois** (não compete com Live2D + Hermes no boot).

Arquivo: `src/main/index.ts`

---

## 3. Fluxo de leitura (quando pega os dados)

```
                    ┌─────────────────────────────────────┐
                    │         Mensagem do usuário          │
                    └─────────────────┬───────────────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              │                       │                       │
              ▼                       ▼                       ▼
     «Lembra / do que         «Pesquisa no            Conversa normal
      falamos sobre X?»         Google…»                 (chat)
              │                       │                       │
              ▼                       ▼                       ▼
     tryRecallShortcut         tryBrowserSearch          chat() + Hermes
              │                       │                       │
     ┌────────┴────────┐              │                       │
     │ Com tópico X?   │              │                       │
     ▼                 ▼              ▼                       ▼
  Qdrant          SQLite FTS    SQLite events          Buffer RAM
  (semântico)     (palavras)    (cronológico)          (8 turnos no prompt)
     │                 │              │                       │
     └────────┬────────┘              │                       │
              ▼                       ▼                       ▼
        Resposta pronta          Abre Google            Resposta gerada
        (sem Hermes)             + confirmação          pelo LLM
```

### 3.1 Chat normal — só RAM

O Hermes recebe no máximo **8 turnos** via `formatTranscriptForPrompt(8)`:

- Bloco: *«Histórico REAL desta sessão (use só isso — nunca invente conversas)»*
- **Não** consulta SQLite nem Qdrant diretamente neste caminho.
- Objetivo: coerência imediata, baixo custo de contexto.

Arquivo: `src/main/services/llm.ts` → função `chat()`

### 3.2 Atalhos de recall — SQLite + Qdrant

Ordem no IPC `conversationShortcut`:

1. `tryRecallShortcut` — memória
2. `tryBrowserSearchCommand` — Google
3. `tryConversationShortcut` — oi / chega

Se a frase contém «lembra», «do que falamos», «pesquisei», etc., **não chama o Hermes**.

| Tipo de pergunta | Fonte primária | Fallback |
|------------------|----------------|----------|
| «Do que falamos sobre **jogos**?» | **Qdrant** (semântico) | SQLite FTS5 |
| «Lembra o que falamos?» (sem tópico) | SQLite cronológico | Buffer RAM |
| «O que pesquisei no Google?» | SQLite `events` | — |

Arquivo: `src/main/services/conversation/transcript.ts` → `buildRecallReply()`

### 3.3 Agente — memória RAM separada (45 min)

`agent/memory.ts` guarda fingerprints de ações recentes (anti-repetição). **Não** usa SQLite/Qdrant de conversa.

---

## 4. O que cada banco guarda

### SQLite (`lotus.db`)

Local: pasta `memory/` dentro do `userData` do Electron.

```
sessions   → id, started_at, last_active_at  (1 sessão por boot)
turns      → role (user|assistant), content, timestamp
events     → browser_search | agent_action + payload JSON
turns_fts  → FTS5 espelhando turns (busca por palavra)
```

### Qdrant (collection `lotus_memory`)

- Vetor: **1024 dimensões** (modelo multilingual-e5-large via fastembed)
- Payload: `{ role, content, at, sessionId, kind }`
- IDs de turnos = autoincrement do SQLite
- IDs de eventos = `1_000_000_000 + event.id` (evita colisão)

Comando para subir: `npm run memory:qdrant` (container **mind1**, porta **6333**)

---

## 5. Sequência completa — exemplo recall

```
1. Usuário: "Lembra do que falamos sobre PS5?"
2. recordTurn(user)  →  RAM + SQLite + Qdrant (async)
3. conversationShortcut detecta recall
4. extractRecallTopic → "PS5"
5. searchQdrant("PS5") → hits semânticos
6. Resposta montada por regras (sem Hermes)
```

## Sequência — chat normal

```
1. Usuário: "O que acha do Zelda?"
2. recordTurn(user)  →  RAM + SQLite + Qdrant (async)
3. Atalhos não aplicam → agente → chatPlan → chat()
4. formatTranscriptForPrompt(8) → injeta histórico recente
5. Hermes gera resposta
6. recordTurn(assistant)  →  RAM + SQLite + Qdrant (async)
```

---

## 6. Posicionamento estratégico

```
ESCREVER sempre  →  RAM + SQLite (+ Qdrant se online)
LER no chat      →  só RAM (últimos 8 turnos)
LER no recall     →  Qdrant → SQLite FTS/eventos → RAM
```

### Pontos fortes

- Escrita não bloqueia o chat (Qdrant assíncrono).
- Recall honesto: se não acha, informa — não inventa.
- SQLite funciona **sem Docker**; Qdrant é opcional mas poderoso para pt-BR.

### Limitações atuais

1. **Qdrant não entra no prompt do chat normal** — só no atalho «lembra…».
2. **Sem reindexação automática** — turnos salvos com Qdrant offline ficam só no SQLite.
3. **`llmReset` limpa RAM + sessão Hermes** — **não** apaga SQLite nem Qdrant.
4. **Qdrant sobe 2,5 s após o boot** — primeiros turnos podem perder indexação vetorial.

### Próximos passos sugeridos

- **RAG no `chat()`** — buscar Qdrant antes do Hermes quando a pergunta referencia passado.
- **Reindex SQLite → Qdrant** quando mind1 volta online.
- **UI de memória** — ver e apagar entradas; retenção configurável.

---

## 7. Arquivos principais

```
src/main/services/memory/
  db.ts          — SQLite (schema, sessões, migrations)
  store.ts       — persistTurn, persistEvent, FTS, recall topic
  embeddings.ts  — fastembed (vetores locais)
  qdrant.ts      — indexação e busca semântica
  health.ts      — health check Memória / Mente

src/main/services/conversation/
  transcript.ts  — buffer RAM, recordTranscriptTurn, buildRecallReply
  recall.ts      — tryRecallShortcut

docs/MEMORY.md   — guia operacional (Docker, env vars)
```

---

*Project Companion — Lotus · ReDLotuS · 2026*
