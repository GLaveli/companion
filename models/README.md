# Pasta de modelos (assets de IA)

Esta pasta guarda os arquivos locais usados pela companion. Ela NAO e versionada
(veja `.gitignore`) porque os modelos sao grandes.

Estrutura:

- `llm/` -> arquivos `.gguf` (o "cerebro"). **Hermes 3** e o padrao do projeto;
  Qwen e alternativa leve opcional.
- `whisper/` -> `ggml-base.bin` (padrão) ou outro modelo + `whisper-cli` (`npm run setup:stt`).

## Como baixar

### Pela interface

Abra a Lotus com `npm run dev`. Se nao houver modelo em `llm/`, o painel **Cerebro**
oferece **Hermes 3** (padrao) ou **Qwen** (opcional).

### Pelo terminal

```bash
npm run setup:models        # Hermes 3 — padrao do projeto
npm run setup:models:qwen   # Qwen — opcional, para comparacao
npm run setup:stt           # Whisper base — microfone / transcrição
```

Voce tambem pode colocar manualmente qualquer `.gguf` em `models/llm/`.

## Avatar 3D (opcional)

Coloque um arquivo `.vrm` em `src/renderer/public/avatar.vrm` para usar um
avatar real. Sem ele, a companion usa um personagem provisorio (placeholder).
Voce encontra avatares VRM gratuitos no VRoid Hub (https://hub.vroid.com).
