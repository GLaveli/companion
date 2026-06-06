# Pasta de modelos (assets de IA)

Esta pasta guarda os arquivos locais usados pela companion. Ela NAO e versionada
(veja `.gitignore`) porque os modelos sao grandes.

Estrutura:

- `llm/` -> coloque aqui um arquivo `.gguf` (o "cerebro"). O primeiro `.gguf`
  encontrado e carregado automaticamente.
- `whisper/` -> modelos do whisper.cpp (baixados automaticamente pelo nodejs-whisper).

## Como baixar automaticamente

```bash
npm run setup:models
```

Isso baixa um modelo LLM leve (Qwen2.5 3B Instruct, ~2 GB) para `llm/`.

## Avatar 3D (opcional)

Coloque um arquivo `.vrm` em `src/renderer/public/avatar.vrm` para usar um
avatar real. Sem ele, a companion usa um personagem provisorio (placeholder).
Voce encontra avatares VRM gratuitos no VRoid Hub (https://hub.vroid.com).
