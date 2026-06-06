import { useEffect, useRef, useState } from 'react'
import { Scene } from './scene/Scene'
import { useStore } from './store'
import { useConversation } from './hooks/useConversation'

const PHASE_LABEL: Record<string, string> = {
  idle: 'Pronta para conversar',
  listening: 'Ouvindo...',
  thinking: 'Pensando...',
  speaking: 'Falando...'
}

export default function App(): React.JSX.Element {
  const { messages, phase, statusMessage, llmReady, avatarName } = useStore()
  const { sendText, startListening, stopListening } = useConversation()
  const [input, setInput] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const blobUrlRef = useRef<string | null>(null)

  const applyAvatar = (file: { name: string; kind: 'vrm' | 'glb'; data: Uint8Array } | null): void => {
    if (!file) return
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
    const blob = new Blob([file.data as unknown as BlobPart], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    blobUrlRef.current = url
    useStore.getState().setAvatar(url, file.name, file.kind)
  }

  useEffect(() => {
    const off = window.companion.onStatus((s) => {
      useStore.getState().setStatus(s.message || statusMessage, s.llmReady)
    })
    window.companion.getStatus().then((s) => useStore.getState().setStatus(s.message, s.llmReady))
    window.companion.loadAvatar().then(applyAvatar)
    return off
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onPickAvatar = async (): Promise<void> => {
    const file = await window.companion.pickAvatar()
    applyAvatar(file)
  }

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const onSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    const text = input
    setInput('')
    void sendText(text)
  }

  const micActive = phase === 'listening'

  return (
    <div className="app">
      <div className="stage">
        <Scene />
        <div className="badge">{PHASE_LABEL[phase]}</div>
      </div>

      <aside className="panel">
        <header className="panel-header">
          <h1>Lotus</h1>
          <span className={`dot ${llmReady ? 'on' : 'off'}`} title={statusMessage} />
        </header>
        <p className="status">{statusMessage}</p>

        <div className="avatar-bar">
          <button type="button" className="avatar-btn" onClick={() => void onPickAvatar()}>
            Trocar avatar
          </button>
          <span className="avatar-name" title={avatarName ?? ''}>
            {avatarName ?? 'catgirl maid (provisorio)'}
          </span>
        </div>

        <div className="messages" ref={listRef}>
          {messages.length === 0 && (
            <div className="hint">
              Diga ola para a Lotus! Use o microfone ou escreva uma mensagem abaixo.
              <br />
              <br />
              Quer um avatar bonito? Baixe um .vrm (VRoid Hub) ou .glb (Sketchfab) e clique em
              &quot;Trocar avatar&quot;.
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
    </div>
  )
}
