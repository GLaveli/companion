# Voz da Lotus — GPT-SoVITS

## Visão

O app suporta múltiplos **perfis de voz**. O usuário poderá, no futuro, clonar qualquer personagem (anime, VTuber, dubladora) a partir de um áudio de referência curto.

```
Conversa → TTS router (src/main/services/tts/)
              ├─ edge      → Francisca (fallback online, sempre disponível)
              └─ gptsovits → clone local via api_v2.py (porta 9880)
```

## Por que GPT-SoVITS

| Critério | Edge TTS | GPT-SoVITS |
|----------|----------|------------|
| Tom anime / personagem | Genérico | Clona timbre real |
| pt-BR natural | Bom | Cross-lingual (ref em JA/EN + texto pt) |
| Offline | Não | Sim (após setup) |
| Clonagem pelo usuário | Não | Sim (5s–1min de áudio) |
| Peso | Leve | Pesado (GPU recomendada) |

## Setup do motor (desenvolvedor)

GPT-SoVITS roda como **servidor Python separado** — o Electron só consome a API HTTP.

```bash
# 1. Instalar GPT-SoVITS (fora do npm)
git clone https://github.com/RVC-Boss/GPT-SoVITS.git
cd GPT-SoVITS
# Siga o README oficial: Python 3.10+, PyTorch, modelos pré-treinados

# 2. Subir a API
python api_v2.py -a 127.0.0.1 -p 9880 -c GPT_SoVITS/configs/tts_infer.yaml

# 3. No companion, coloque áudio de referência em models/voices/<nome>/ref.wav
npm run setup:voice
npm run dev
```

### Áudio de referência

- **Duração:** 3–10 segundos de fala limpa (sem música/ruído)
- **Formato:** WAV, mono, 16–48 kHz
- **prompt_text:** transcrição exata do que a personagem fala no clip
- **prompt_lang:** idioma do clip (`ja` para anime japonês, `en`, `zh`, etc.)
- **text_lang:** `pt` para a Lotus falar português (cross-lingual)

## Perfil de voz (`VoiceProfile`)

```typescript
{
  id: "yuki-anime",
  name: "Yuki",
  engine: "gptsovits",
  refAudioPath: "/path/to/ref.wav",
  promptText: "今日はいい天気ですね",
  promptLang: "ja",
  textLang: "pt",
  gptWeightsPath?: "...",   // opcional: modelo fine-tuned
  sovitsWeightsPath?: "..." // opcional: modelo fine-tuned
}
```

Perfis ficam em `~/Library/Application Support/project-companion/voice-profiles.json`.  
Áudios de referência em `.../voices/<id>/ref.wav`.

## Roadmap

### Fase 1 — Fundação (atual)
- [x] Router TTS com fallback Edge → GPT-SoVITS
- [x] Cliente HTTP `api_v2.py`
- [x] Persistência de perfis + perfil ativo
- [x] IPC: listar perfis, trocar ativo, status do servidor

### Fase 2 — Voz padrão anime
- [x] Perfil curado **Hiyori (preview anime)** — ref JP em `models/voices/hiyori-preview/ref.wav`
- [x] `npm run setup:voice-ref` gera a referência; UI **Voz** no painel para testar
- [ ] Tornar Hiyori preview a voz padrão após validação do usuário
- [ ] Auto-start do `api_v2.py` pelo Electron (opcional)

### Fase 3 — Clonagem pelo usuário (meta final)
- [ ] UI "Clonar voz" no painel
- [ ] Gravar ou importar WAV (3–10s)
- [ ] Transcrever prompt_text (Whisper/STT)
- [ ] Preview antes de salvar
- [ ] Galeria de vozes salvas (ligar avatar ↔ voz)
- [ ] Fine-tune opcional (1min+) para qualidade máxima

### Fase 4 — Produção
- [ ] Empacotar Python runtime + modelos no instalador
- [ ] Fila de síntese (evitar OOM em GPU compartilhada)
- [ ] Cache de frases frequentes

## API usada (`POST /tts`)

```json
{
  "text": "Oi! Tudo bem?",
  "text_lang": "pt",
  "ref_audio_path": "/abs/path/ref.wav",
  "prompt_text": "transcrição do ref",
  "prompt_lang": "ja",
  "speed_factor": 1.0,
  "text_split_method": "cut5",
  "media_type": "wav",
  "streaming_mode": false
}
```

Resposta: stream WAV (`audio/wav`).

## Fallback

Se GPT-SoVITS estiver offline ou o perfil ativo não tiver `refAudioPath`, o app usa **Edge TTS (Francisca)** automaticamente.
