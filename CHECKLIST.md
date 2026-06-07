# Lotus — Checklist

Roadmap do projeto. Atualizado conforme o produto evolui.

## Prioridade principal

- [ ] **Agente de IA no computador** — permitir que a Lotus abra apps e navegadores, faça pesquisas e ações úteis no SO em nome do usuário (automação / agente local com permissões claras e confirmações quando necessário)
  - [x] Base modular (`main/services/agent/`, `renderer/src/agent/`)
  - [x] Ferramentas iniciais: abrir link, abrir app, **browserSearch** (`shell.openExternal` → Google)
  - [x] Planner via LLM + fallback heurístico
  - [x] Memória de ações + resposta irônica em repetição
  - [x] **Navegador sem Playwright** — abre Google via navegador padrão (sem dialog de permissão)
  - [ ] Mais ferramentas (teclado global, arquivos, janelas)

### Cérebro do agente — avaliação (Hermes e alternativas)

**Hoje a Lotus:** Qwen GGUF + `node-llama-cpp` + ferramentas próprias no Electron (3 tools). **Não** cria/move arquivos ainda.

| Opção | Arquivos/pastas | Encaixe na Lotus | Licença | Notas |
|--------|-----------------|------------------|---------|--------|
| **[Hermes Agent](https://github.com/NousResearch/hermes-agent)** (Nous Research) | ✅ `read_file`, `patch`, `terminal`, toolset `file` | ⚠️ Sidecar Python — não é lib Electron | MIT | Agente completo: memória, skills, cron, `computer_use`. Pesado; pensado para VPS/CLI, não avatar desktop |
| **[Hermes 3](https://huggingface.co/NousResearch/Hermes-3-Llama-3.1-8B-GGUF)** (só modelo) | Indireto — via function calling | ✅ **Melhor encaixe** — troca GGUF no `node-llama-cpp` | Apache 2.0 | Fine-tune para tools/agent; GGUF oficial; pt-BR ok mas não foco |
| **[DeskGenie](https://github.com/hemantvirmani/DeskGenie)** | ✅ renomear, organizar, PDFs | ⚠️ App Python separado (LangGraph) | Open | Foco desktop/files; inspirar design de tools |
| **[UgoAI](https://github.com/ijeziermf/UgoAI)** | ✅ read/write/move/zip + approval | ⚠️ Python + Ollama sidecar | — | Filesystem completo; padrão de permissões útil |
| **[Open Interpreter](https://github.com/OpenInterpreter/open-interpreter)** | ✅ via código Python/shell | ⚠️ Sidecar | MIT | Muito poderoso; risco de segurança |
| **Ferramentas Lotus nativas** | Implementar `openFolder`, `createFile`, `moveFile` | ✅ Mantém arquitetura atual | — | Menor risco; confirmação por ação |

**Recomendação para a Lotus (3 camadas):**

1. **Curto prazo:** ferramentas de arquivo nativas no agente atual (como Hermes faz, mas dentro do Electron).
2. **Médio prazo:** testar **Hermes 3 8B GGUF** como cérebro (melhor planejamento de tools que Qwen pequeno) — persona Lotus continua no system prompt.
  - [x] `setup:models` baixa Hermes 3; `setup:models:qwen` baixa Qwen leve — **os dois podem coexistir**
  - [x] Seletor **Cérebro** no painel (Auto / Hermes 3 / Qwen leve)
  - [x] Agente usa **function calling** nativo (Hermes) para planejar tools
  - [ ] Avaliar RAM/latência vs Qwen em máquinas mais fracas
3. **Longo prazo (opcional):** Hermes Agent como **processo sidecar** só para tarefas complexas de SO — Lotus UI + voz; Hermes executa terminal/files. Evitar substituir tudo de uma vez.

**Hermes Agent inteiro como cérebro?** Possível via subprocess + API local, mas duplicaria LLM, exigiria Python/uv, e foge do app desktop integrado. **Hermes 3 como modelo** é o caminho mais limpo.

### Agente de navegador — notas

**Padrão atual:** `shell.openExternal` com URL do Google — instantâneo, não bloqueia a Lotus.

**Opt-in futuro (avançado):** Playwright, nut.js ou AppleScript se precisar digitar na tela — com permissões explícitas.

## Prioridade média

- [ ] **Conversa mais natural** — menos respostas robóticas, cumprimentos variados, “chega/para” reconhecidos, pesquisa no assunto certo (Stellar Blade ≠ Parov Stelar)
  - [x] Atalhos sem LLM (oi, chega, para)
  - [x] Memória de cumprimento + queries de pesquisa corrigidas
  - [x] **Memória persistente** — SQLite (diário) + **Qdrant** (busca semântica) + fastembed local ([docs/MEMORY.md](docs/MEMORY.md))
  - [ ] Revisar prompt + modelo GGUF maior ou fine-tune pt-BR
- [ ] **Microfone / STT** — substituir ou adaptar o Whisper para transcrição que rode de fato no Electron
- [ ] **Instaladores** — gerar e testar `.exe` (Windows) e `.dmg` (macOS) com `electron-builder`
- [ ] **Voz anime (GPT-SoVITS)** — explorar depois; **voz padrão mantida:** *Lotus (natural) · Francisca* (Edge TTS)

## Concluído

- [x] App Electron + React + chat + LLM local (GGUF)
- [x] Avatar Live2D (Hiyori/Mao, galeria, persistência, posição)
- [x] Lip-sync, idle e gestos
- [x] Busca web robusta + pesquisa paralela no chat
- [x] TTS Edge (Francisca) + pipeline por frases
- [x] UI: menu ⚙, painel Avatar/Voz/CPU/RAM, indicador IA pronta
- [x] Olhar: seguir mouse, olhar para o chat, olhar para você (câmera / MediaPipe)
- [x] README e screenshots no GitHub
- [x] Interrupção de fala (nova mensagem / microfone)

## Polish (não bloqueia uso)

- [x] Suavização e dead zone do olhar (mouse e câmera)
- [ ] Validar empacotamento em máquinas Windows e macOS reais

---

Decisões de produto: **voz atual aprovada por enquanto**; anime e agente de SO entram quando houver tempo, com agente de SO como próximo foco grande.
