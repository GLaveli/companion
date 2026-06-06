import { useCallback, useEffect, useState } from 'react'
import { playWithAnalyser, speakWithWebSpeech } from '../audio/player'
import type { EdgeVoiceSettings } from '../../../shared/types'

import { VOICE_PREVIEW_LINE } from '../../../shared/voiceText'

const EDGE_VOICES = [
  { id: 'pt-BR-FranciscaNeural', label: 'Francisca (suave)' },
  { id: 'pt-BR-ThalitaNeural', label: 'Thalita (jovem)' }
]

const DEFAULTS: EdgeVoiceSettings = {
  pitch: 10,
  rate: 4,
  volume: 0,
  edgeVoice: 'pt-BR-FranciscaNeural'
}

export function VoiceEdgeTunePanel({
  profileId,
  profileName,
  onClose
}: {
  profileId: string
  profileName: string
  onClose: () => void
}): React.JSX.Element {
  const [settings, setSettings] = useState<EdgeVoiceSettings>(DEFAULTS)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    void (async () => {
      setError('')
      try {
        if (typeof window.companion.getEdgeVoiceSettings !== 'function') {
          setSettings(DEFAULTS)
          return
        }
        setSettings(await window.companion.getEdgeVoiceSettings(profileId))
      } catch (err) {
        setSettings(DEFAULTS)
        setError((err as Error).message)
      }
    })()
  }, [profileId])

  const persist = useCallback(
    async (next: EdgeVoiceSettings): Promise<void> => {
      setSettings(next)
      if (typeof window.companion.saveEdgeVoiceSettings !== 'function') return
      try {
        await window.companion.saveEdgeVoiceSettings(profileId, next)
      } catch (err) {
        setError((err as Error).message)
      }
    },
    [profileId]
  )

  const onReset = (): void => {
    void persist({ ...DEFAULTS })
  }

  const onTest = async (): Promise<void> => {
    setError('')
    setBusy(true)
    try {
      await window.companion.saveEdgeVoiceSettings(profileId, settings)
      const preview =
        typeof window.companion.previewEdgeVoice === 'function'
          ? await window.companion.previewEdgeVoice(profileId)
          : await window.companion.speak(VOICE_PREVIEW_LINE, 'happy')
      if (preview.audioUrl && !preview.useWebSpeechFallback) {
        const playback = await playWithAnalyser(preview.audioUrl)
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

  return (
    <div className="voice-tune" onClick={(e) => e.stopPropagation()}>
      <header className="voice-tune-header">
        <strong>Ajustar — {profileName}</strong>
        <button type="button" className="voice-close" onClick={onClose} title="Fechar ajustes">
          ✕
        </button>
      </header>

      <p className="voice-note">Tom, velocidade e volume base (Edge TTS). Emoção da conversa ainda modula a fala.</p>

      <label className="voice-tune-row">
        <span>Tom (pitch)</span>
        <input
          type="range"
          min={-5}
          max={25}
          step={1}
          value={settings.pitch}
          disabled={busy}
          onChange={(e) => void persist({ ...settings, pitch: Number(e.target.value) })}
        />
        <em>{settings.pitch > 0 ? `+${settings.pitch}%` : `${settings.pitch}%`}</em>
      </label>

      <label className="voice-tune-row">
        <span>Velocidade</span>
        <input
          type="range"
          min={-15}
          max={20}
          step={1}
          value={settings.rate}
          disabled={busy}
          onChange={(e) => void persist({ ...settings, rate: Number(e.target.value) })}
        />
        <em>{settings.rate > 0 ? `+${settings.rate}%` : `${settings.rate}%`}</em>
      </label>

      <label className="voice-tune-row">
        <span>Volume</span>
        <input
          type="range"
          min={-15}
          max={15}
          step={1}
          value={settings.volume}
          disabled={busy}
          onChange={(e) => void persist({ ...settings, volume: Number(e.target.value) })}
        />
        <em>{settings.volume > 0 ? `+${settings.volume}%` : `${settings.volume}%`}</em>
      </label>

      <label className="voice-tune-select">
        <span>Voz neural</span>
        <select
          value={settings.edgeVoice}
          disabled={busy}
          onChange={(e) => void persist({ ...settings, edgeVoice: e.target.value })}
        >
          {EDGE_VOICES.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </label>

      <div className="voice-tune-actions">
        <button type="button" className="voice-preview" disabled={busy} onClick={() => void onTest()}>
          Ouvir teste
        </button>
        <button type="button" className="voice-refresh" disabled={busy} onClick={onReset}>
          Restaurar padrão
        </button>
      </div>

      {error ? <p className="voice-error">{error}</p> : null}
    </div>
  )
}
