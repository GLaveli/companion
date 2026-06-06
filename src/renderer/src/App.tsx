import { useEffect, useMemo, useRef, useState } from 'react'
import { AvatarGallery } from './components/AvatarGallery'
import { AvatarLayoutControls } from './components/AvatarLayoutControls'
import { VoiceControls } from './components/VoiceControls'
import { AvatarStage } from './avatar/AvatarStage'
import { flushAvatarLayoutSave, useAvatarLayout } from './avatar/layoutStore'
import { getAvatarProvider } from './avatar/registry'
import { useStore } from './store'
import { useConversation } from './hooks/useConversation'
import type { AvatarFile } from '../../shared/types'

const PHASE_LABEL: Record<string, string> = {
  idle: 'Pronta para conversar',
  listening: 'Ouvindo...',
  thinking: 'Pensando...',
  speaking: 'Falando...'
}

export default function App(): React.JSX.Element {
  const { messages, phase, statusMessage, llmReady, avatarName, avatarKind } = useStore()
  const { sendText, startListening, stopListening } = useConversation()
  const [input, setInput] = useState('')
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [layoutOpen, setLayoutOpen] = useState(false)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [avatarReady, setAvatarReady] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const hydrateLayout = useAvatarLayout((s) => s.hydrate)

  const applyAvatar = (file: AvatarFile | null): void => {
    if (!file) return
    useStore.getState().setAvatar(file.modelUrl, file.name, file.kind)
  }

  useEffect(() => {
    const off = window.companion.onStatus((s) => {
      useStore.getState().setStatus(s.message || statusMessage, s.llmReady)
    })
    window.companion.getStatus().then((s) => useStore.getState().setStatus(s.message, s.llmReady))

    const onUnload = (): void => flushAvatarLayoutSave()
    window.addEventListener('beforeunload', onUnload)

    void (async () => {
      try {
        const layout = await window.companion.loadAvatarLayout()
        hydrateLayout(layout)

        const saved = await window.companion.loadAvatar()
        const provider = getAvatarProvider(null)
        const isLive2dModel =
          saved?.kind === 'live2d' && saved.modelUrl.toLowerCase().includes('model3.json')

        if (saved && isLive2dModel) {
          applyAvatar(saved)
        } else {
          useStore.getState().setAvatar(
            provider.defaultModelUrl,
            provider.defaultName,
            provider.id
          )
        }
        setAvatarReady(true)
      } catch (err) {
        console.error('[app] init failed:', err)
        setAvatarReady(true)
      }
    })()

    return () => {
      off()
      window.removeEventListener('beforeunload', onUnload)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onPickAvatar = async (): Promise<void> => {
    const file = await window.companion.pickAvatar()
    applyAvatar(file)
  }

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const scrollToBottom = (): void => {
      el.scrollTop = el.scrollHeight
    }
    scrollToBottom()
    requestAnimationFrame(scrollToBottom)
  }, [messages])

  const onSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    const text = input
    setInput('')
    void sendText(text)
  }

  const micActive = phase === 'listening'
  const provider = useMemo(() => getAvatarProvider(avatarKind), [avatarKind])

  return (
    <div className="app">
      <div className="stage">
        {avatarReady ? <AvatarStage /> : null}
        <div className="badge">{PHASE_LABEL[phase]}</div>
        <button
          type="button"
          className={`layout-toggle ${layoutOpen ? 'active' : ''}`}
          onClick={() => setLayoutOpen((v) => !v)}
          title="Ajustar posicao do avatar"
        >
          Posicao
        </button>
        <AvatarLayoutControls open={layoutOpen} onClose={() => setLayoutOpen(false)} />
      </div>

      <aside className="panel">
        <header className="panel-header">
          <h1>Lotus</h1>
          <span className={`dot ${llmReady ? 'on' : 'off'}`} title={statusMessage} />
        </header>
        <p className="status">{statusMessage}</p>

        <div className="avatar-bar">
          <button type="button" className="avatar-btn primary" onClick={() => setGalleryOpen(true)}>
            Galeria
          </button>
          <button type="button" className="avatar-btn" onClick={() => void onPickAvatar()}>
            Arquivo local
          </button>
          <button
            type="button"
            className={`avatar-btn ${voiceOpen ? 'active' : ''}`}
            onClick={() => setVoiceOpen((v) => !v)}
          >
            Voz
          </button>
          <span className="avatar-name" title={avatarName ?? ''}>
            {avatarName ?? provider.defaultName}
          </span>
        </div>

        <VoiceControls open={voiceOpen} onClose={() => setVoiceOpen(false)} />

        <div className="messages" ref={listRef}>
          {messages.length === 0 && (
            <div className="hint">
              Diga ola para a Lotus! Use o microfone ou escreva uma mensagem abaixo.
              <br />
              <br />
              Avatar Live2D com animacao de corpo. Escolha um modelo na galeria ou aponte para um
              arquivo <code>.model3.json</code> seu.
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>
              {m.content}
            </div>
          ))}
        </div>

        <form className="composer" onSubmit={onSubmit}>
          <button
            type="button"
            className={`mic ${micActive ? 'recording' : ''}`}
            onClick={() => (micActive ? void stopListening() : void startListening())}
            title={micActive ? 'Parar e enviar' : 'Falar'}
          >
            {micActive ? '■' : '🎤'}
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escreva para a Lotus..."
            disabled={phase === 'thinking'}
          />
          <button type="submit" disabled={!input.trim() || phase === 'thinking'}>
            Enviar
          </button>
        </form>
      </aside>

      <AvatarGallery
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        onSelect={applyAvatar}
      />
    </div>
  )
}
