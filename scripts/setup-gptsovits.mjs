#!/usr/bin/env node
/**
 * Guides GPT-SoVITS setup for Project Companion voice cloning.
 * GPT-SoVITS is a separate Python project — not an npm dependency.
 */
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const voicesDir = join(root, 'models', 'voices')
const gptDir = join(root, 'vendor', 'GPT-SoVITS')

console.log(`
=== GPT-SoVITS — clonagem de voz (Project Companion) ===

O companion usa GPT-SoVITS via API HTTP local (porta 9880).
Documentacao completa: docs/VOICE.md

PASSO 1 — Clonar GPT-SoVITS (se ainda nao tiver)
  git clone https://github.com/RVC-Boss/GPT-SoVITS.git ${gptDir}
  cd ${gptDir}
  # Siga o README: Python 3.10+, pip install -r requirements.txt, baixar pretrained models

PASSO 2 — Subir o servidor
  cd ${gptDir}
  python api_v2.py -a 127.0.0.1 -p 9880 -c GPT_SoVITS/configs/tts_infer.yaml

PASSO 3 — Audio de referencia (ja gerado para Hiyori preview)
  npm run setup:voice-ref
  # Cria models/voices/hiyori-preview/ref.wav (tom anime JP, cross-lingual pt)
  Com meta (futuro UI) ou registre via voiceStore.addClonedVoiceProfile:
    - prompt_text: transcricao exata do clip
    - prompt_lang: ja (anime JP), en, zh...
    - text_lang: pt (Lotus fala portugues)

PASSO 4 — Testar no app
  npm run dev
  # Troque o perfil ativo para o clone (UI em breve; hoje via voice-profiles.json)

Dica: ref audio limpo, sem BGM. Personagens anime funcionam bem com prompt_lang=ja e text_lang=pt.
`)

await mkdir(voicesDir, { recursive: true })
await mkdir(join(voicesDir, 'example'), { recursive: true })

if (!existsSync(gptDir)) {
  console.log(`Pasta vendor/GPT-SoVITS ainda nao existe — clone o repositorio quando estiver pronto.\n`)
} else {
  console.log(`Encontrado: ${gptDir}\n`)
}

console.log(`Pasta de vozes: ${voicesDir}`)
