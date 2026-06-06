import { useCallback, useEffect, useState } from 'react'
import { playWithAnalyser, speakWithWebSpeech } from '../audio/player'
import type { GptSoVitsStatus, VoiceListEntry } from '../../../shared/types'
import { VoiceEdgeTunePanel } from './VoiceEdgeTunePanel'

import { VOICE_PREVIEW_LINE } from '../../../shared/voiceText'

export function VoiceControls({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}): React.JSX.Element | null {
  const [voices, setVoices] = useState<VoiceListEntry[]>([])
  const [gptStatus, setGptStatus] = useState<GptSoVitsStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [tuningId, setTuningId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const [list, status] = await Promise.all([
      window.companion.listVoices(),
      window.companion.getGptSoVitsStatus()
    ])
    setVoices(list)
    setGptStatus(status)
  }, [])

  useEffect(() => {
    if (!open) return
    void refresh()
  }, [open, refresh])

  const onSelect = async (id: string): Promise<void> => {
    setError('')
    setBusy(true)
    try {
      await window.companion.setActiveVoice(id)
      await refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const onPreview = async (): Promise<void> => {
    setError('')
    setBusy(true)
    try {
      const tts =
        typeof window.companion.previewVoice === 'function'
          ? await window.companion.previewVoice()
          : await window.companion.speak(VOICE_PREVIEW_LINE, 'happy')
      if (tts.audioUrl && !tts.useWebSpeechFallback) {
        const playback = await playWithAnalyser(tts.audioUrl)
        await playback.done
      } else {
        await speakWithWebSpeech(VOICE_PREVIEW_LINE)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  return (
    <div className="voice-controls" onClick={(e) => e.stopPropagation()}>
      <header className="voice-controls-header">
        <strong>Voz da Lotus</strong>
        <button type="button" className="voice-close" onClick={onClose} title="Fechar">
          ✕
        </button>
      </header>

      <p className="voice-note">
        Padrão do sistema: <em>Lotus (natural)</em>. Teste <em>Hiyori (preview anime)</em> com
        GPT-SoVITS antes de definir como voz fixa dela.
      </p>

      <p className={`voice-server ${gptStatus?.online ? 'on' : 'off'}`}>
        GPT-SoVITS: {gptStatus?.message ?? 'verificando...'}
      </p>

      <ul className="voice-list">
        {voices.map((voice) => {
          const needsGpt = voice.engine === 'gptsovits'
          const disabled = busy || (needsGpt && !voice.available)
          const hint =
            needsGpt && !voice.available
              ? 'Rode npm run setup:voice-ref'
              : needsGpt && !gptStatus?.online
                ? 'Servidor offline — fallback Edge ao falar'
                : voice.description

          return (
            <li key={voice.id} className="voice-item-wrap">
              <div className="voice-item-row">
                <button
                  type="button"
                  className={`voice-pick ${voice.active ? 'active' : ''}`}
                  disabled={disabled}
                  aria-pressed={voice.active}
                  onClick={() => void onSelect(voice.id)}
                >
                  <span className="voice-pick-row">
                    <span className="voice-name">{voice.name}</span>
                    <span className="voice-engine">{voice.engine}</span>
                  </span>
                  {hint ? <span className="voice-hint">{hint}</span> : null}
                </button>
                {voice.engine === 'edge' ? (
                  <button
                    type="button"
                    className={`voice-tune-btn ${tuningId === voice.id ? 'active' : ''}`}
                    disabled={busy}
                    title="Ajustar tom e velocidade"
                    aria-label={`Ajustar voz ${voice.name}`}
                    onClick={() => setTuningId((id) => (id === voice.id ? null : voice.id))}
                  >
                    ⚙
                  </button>
                ) : null}
              </div>
              {tuningId === voice.id && voice.engine === 'edge' ? (
                <VoiceEdgeTunePanel
                  profileId={voice.id}
                  profileName={voice.name}
                  onClose={() => setTuningId(null)}
                />
              ) : null}
            </li>
          )
        })}
      </ul>

      <div className="voice-actions">
        <button type="button" className="voice-preview" disabled={busy} onClick={() => void onPreview()}>
          Ouvir preview
        </button>
        <button type="button" className="voice-refresh" disabled={busy} onClick={() => void refresh()}>
          Atualizar
        </button>
      </div>

      {error ? <p className="voice-error">{error}</p> : null}
    </div>
  )
}
