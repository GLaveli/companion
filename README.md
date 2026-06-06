# Project Companion (Lotus)

Companion de desktop com IA local: um avatar 3D que ouve pelo microfone, pensa
com um modelo de linguagem rodando no seu proprio computador, pesquisa na
internet quando precisa e responde com voz feminina enquanto faz lip-sync.

Funciona em Windows e macOS (app Electron).

## Como funciona (visao geral)

```
Microfone -> whisper.cpp (transcricao) -> LLM local (node-llama-cpp)
   -> [busca na web opcional] -> texto -> voz (Edge TTS) -> avatar 3D fala
```

- Cerebro: LLM local em formato GGUF via `node-llama-cpp` (roda no processo principal).
- Ouvir: `whisper.cpp` via `nodejs-whisper` (transcricao offline em portugues).
- Voz: Edge TTS (voz feminina pt-BR "Francisca", gratuita, online) com fallback
  offline para a voz do sistema (Web Speech API).
- Avatar: modelo VRM com `@pixiv/three-vrm` + React Three Fiber. Sem um arquivo
  `.vrm`, usa um personagem provisorio que tambem faz lip-sync.
- Pesquisa: DuckDuckGo (sem chave de API), exposto ao LLM como ferramenta.

## Primeiros passos

1. Instalar dependencias:

   ```bash
   npm install
   ```

2. Baixar o cerebro (modelo LLM leve, ~2 GB):

   ```bash
   npm run setup:models
   ```

3. Avatar 3D: o app usa uma catgirl maid provisoria ate voce escolher um modelo.
   Clique em "Trocar avatar" e selecione um arquivo `.vrm` ou `.glb`.

   Formatos:
   - `.vrm` (VRoid Hub, Booth) — melhor para lip-sync e expressoes faciais.
   - `.glb` (Sketchfab) — modelos bonitos; baixe manualmente no site.

   Exemplo (Erikha no Sketchfab):
   https://sketchfab.com/3d-models/erikha-0c1f5ae3b5b64a92a9733ab60af7dcbb
   1. Crie conta gratuita no Sketchfab
   2. Baixe o modelo (botao Download, formato GLB)
   3. No app: "Trocar avatar" e selecione o arquivo .glb

   VRoid Hub (catgirl/maid com expressoes): https://hub.vroid.com

4. Rodar em modo de desenvolvimento:

   ```bash
   npm run dev
   ```

## Gerar o instalavel

```bash
npm run dist:win   # Windows (.exe NSIS)
npm run dist:mac   # macOS (.dmg)
```

## Estrutura

- `src/main/` - processo principal (Electron): janela, IPC e servicos de IA.
  - `services/llm.ts` - carrega o GGUF e conversa (com function-calling de busca).
  - `services/stt.ts` - transcricao com whisper.cpp.
  - `services/tts.ts` - sintese de voz (Edge TTS).
  - `services/search.ts` - busca na web (DuckDuckGo).
- `src/preload/` - ponte segura entre interface e back-end.
- `src/renderer/` - interface React: cena 3D, audio e conversa.
- `models/` - assets de IA (nao versionados).

## Observacoes

- A primeira transcricao por voz compila o `whisper.cpp` e baixa o modelo
  `base` automaticamente (pode demorar na primeira vez).
- A voz feminina de melhor qualidade (Edge TTS) precisa de internet. Sem
  internet, a companion usa a voz do sistema operacional.
