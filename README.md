# Lotus

![Electron](https://img.shields.io/badge/Electron-42-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)
![Live2D](https://img.shields.io/badge/Live2D-Cubism-FF6B9D)
![License](https://img.shields.io/badge/License-MIT-green)

Companion de desktop com **IA local**: avatar **Live2D** animado, chat por texto ou microfone, voz feminina em pt-BR e lip-sync. Roda no seu computador (Windows e macOS).

![Tela principal — avatar Live2D, chat e controles de galeria/voz](Screenshot/01.png)

## Funcionalidades

- **Avatar Live2D** — Hiyori (padrão) e Mao na galeria; importe qualquer `.model3.json` ou escolha na **Galeria → Arquivo local**
- **Cérebro local** — LLM em GGUF (`node-llama-cpp`), com busca na web quando precisa de fatos atuais
- **Voz da Lotus** — perfil *Lotus (natural)* via Edge TTS (Francisca / Thalita); preview anime opcional com GPT-SoVITS
- **Lip-sync e corpo** — boca sincronizada com o áudio; idle e gestos nos modelos oficiais
- **Posição** — ajuste onde o avatar aparece na tela (persistido)

## Começar

```bash
npm install
npm run setup:models    # LLM (~2 GB) em models/llm/
npm run setup:live2d    # Hiyori, Mao e Cubism Core
npm run dev
```

Na primeira execução, aguarde o indicador **IA pronta** (bolinha verde) antes de conversar. Passe o mouse sobre o chip para ver qual modelo está carregado.

### Voz anime (opcional)

```bash
npm run setup:voice-ref   # áudio de referência
npm run setup:gptsovits   # servidor GPT-SoVITS
npm run gptsovits:start   # em outro terminal, ao testar preview Hiyori
```

## Comandos

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Desenvolvimento |
| `npm run build` | Build de produção |
| `npm run setup:models` | Baixa o LLM |
| `npm run setup:live2d` | Modelos Live2D + runtime |
| `npm run dist:win` | Instalador Windows (.exe) |
| `npm run dist:mac` | Instalador macOS (.dmg) |

## Instalável

```bash
npm run dist:win   # Windows
npm run dist:mac   # macOS
```

## Documentação

- [Avatares — arquitetura, galeria e modelos locais](docs/AVATARS.md)

## Estrutura

```
src/main/       Electron, LLM, TTS, STT, IPC
src/renderer/   React, Live2D, chat e áudio
src/shared/     Tipos e contratos IPC
models/         LLM, whisper e voz (não versionados)
Screenshot/     Capturas para documentação
```

## Observações

- **Voz Edge TTS** — melhor qualidade online; offline cai para voz do sistema (Web Speech).
- **Microfone / STT** — whisper em integração; preferir texto se a transcrição falhar no seu ambiente.
- Modelos Live2D oficiais são material gratuito Live2D (uso não comercial). Ver licença de cada modelo externo.
