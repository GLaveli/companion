import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AvatarGallery } from './components/AvatarGallery'
import { AnimationControls } from './components/AnimationControls'
import { AvatarLayoutControls } from './components/AvatarLayoutControls'
import { StageToolbar } from './components/StageToolbar'
import { VoiceControls } from './components/VoiceControls'
import { AvatarStage } from './avatar/AvatarStage'
import { flushAvatarLayoutSave, useAvatarLayout } from './avatar/layoutStore'
import { flushAvatarAnimationSave, useAvatarAnimation } from './avatar/animationStore'
import { getAvatarProvider } from './avatar/registry'
import { useStore } from './store'
import { useConversation } from './hooks/useConversation'
import { loadActiveVoiceBarLabel } from './voiceLabel'
import { formatCpuPercent, formatRamUsage, metricsTooltip } from './systemMetricsLabel'
import type { AvatarFile, SystemMetrics } from '../../shared/types'

const PHASE_LABEL: Record<string, string> = {
  idle: 'Pronta para conversar',
  listening: 'Ouvindo...',
  thinking: 'Pensando...',
  speaking: 'Falando...'
}

function formatLlmStatus(
  ready: boolean,
  message: string
): { shortLabel: string; detail: string; tooltip: string } {
  const modelMatch = message.match(/Modelo carregado:\s*(.+)/i)
  const modelName = modelMatch?.[1]?.trim()

  if (ready) {
    return {
      shortLabel: 'IA pronta',
      detail: modelName ?? '',
      tooltip: modelName
        ? `Verde: modelo de IA local carregado (${modelName}). A Lotus pode responder no chat.`
        : 'Verde: cérebro da Lotus carregado e pronto para conversar.'
    }
  }

  const waiting = message || 'Carregando o cérebro da Lotus…'
  return {
    shortLabel: 'Carregando IA',
    detail: waiting,
    tooltip: `Laranja: ${waiting} Aguarde para conversar.`
  }
}

export default function App(): React.JSX.Element {
  const { messages, phase, statusMessage, llmReady, avatarName, avatarKind } = useStore()
  const { sendText, startListening, stopListening } = useConversation()
  const [input, setInput] = useState('')
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [animationOpen, setAnimationOpen] = useState(false)
  const [layoutOpen, setLayoutOpen] = useState(false)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [avatarReady, setAvatarReady] = useState(false)
  const [voiceLabel, setVoiceLabel] = useState({ short: 'Lotus (natural) · Francisca', title: '' })
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const hydrateLayout = useAvatarLayout((s) => s.hydrate)
  const hydrateAnimation = useAvatarAnimation((s) => s.hydrate)
  const setChatTyping = useAvatarAnimation((s) => s.setChatTyping)

  const refreshVoiceLabel = useCallback(async (): Promise<void> => {
    try {
      setVoiceLabel(await loadActiveVoiceBarLabel())
    } catch (err) {
      console.error('[app] voice label failed:', err)
    }
  }, [])

  const applyAvatar = (file: AvatarFile | null): void => {
    if (!file) return
    useStore.getState().setAvatar(file.modelUrl, file.name, file.kind)
  }

  useEffect(() => {
    const off = window.companion.onStatus((s) => {
      useStore.getState().setStatus(s.message || statusMessage, s.llmReady)
    })
    window.companion.getStatus().then((s) => useStore.getState().setStatus(s.message, s.llmReady))

    const onUnload = (): void => {
      flushAvatarLayoutSave()
      flushAvatarAnimationSave()
    }
    window.addEventListener('beforeunload', onUnload)

    void (async () => {
      try {
        const layout = await window.companion.loadAvatarLayout()
        hydrateLayout(layout)

        const animation = await window.companion.loadAvatarAnimation()
        hydrateAnimation(animation)

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
        await refreshVoiceLabel()
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

  useEffect(() => {
    if (voiceOpen) void refreshVoiceLabel()
  }, [voiceOpen, refreshVoiceLabel])

  useEffect(() => {
    setChatTyping(input.trim().length > 0)
  }, [input, setChatTyping])

  useEffect(() => {
    let alive = true

    const refreshMetrics = async (): Promise<void> => {
      try {
        const metrics = await window.companion.getSystemMetrics()
        if (alive) setSystemMetrics(metrics)
      } catch {
        /* ignore transient IPC errors */
      }
    }

    void refreshMetrics()
    const timer = window.setInterval(() => void refreshMetrics(), 2000)

    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [])

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
  const llmStatus = useMemo(
    () => formatLlmStatus(llmReady, statusMessage),
    [llmReady, statusMessage]
  )
  const cpuText = systemMetrics ? formatCpuPercent(systemMetrics.cpuPercent) : '—'
  const ramText = systemMetrics ? formatRamUsage(systemMetrics) : '—'
  const cpuTip = metricsTooltip('cpu', systemMetrics)
  const ramTip = metricsTooltip('ram', systemMetrics)

  return (
    <div className="app">
      <div className="stage">
        {avatarReady ? <AvatarStage /> : null}
        <div className="badge">{PHASE_LABEL[phase]}</div>

        <div className="stage-tools-dock">
          <StageToolbar
            voiceOpen={voiceOpen}
            layoutOpen={layoutOpen}
            onGallery={() => setGalleryOpen(true)}
            onVoice={() => setVoiceOpen((v) => !v)}
            onAnimation={() => setAnimationOpen(true)}
            onLayout={() => setLayoutOpen((v) => !v)}
          />

          <AvatarLayoutControls open={layoutOpen} onClose={() => setLayoutOpen(false)} />
          <VoiceControls
            open={voiceOpen}
            onClose={() => setVoiceOpen(false)}
            onVoiceChange={() => void refreshVoiceLabel()}
          />
        </div>
      </div>

      <aside className="panel">
        <div className="panel-top">
          <header className="panel-header">
            <h1>Lotus</h1>
            <button
              type="button"
              className={`llm-indicator ${llmReady ? 'ready' : 'waiting'}`}
              aria-label={llmStatus.tooltip}
            >
              <span className={`dot ${llmReady ? 'on' : 'off'}`} aria-hidden="true" />
              <span className="llm-indicator-label">{llmStatus.shortLabel}</span>
              <span className="llm-indicator-tip">{llmStatus.tooltip}</span>
            </button>
          </header>
          {llmStatus.detail ? <p className="status">{llmStatus.detail}</p> : null}

          <div className="panel-meta" role="group" aria-label="Avatar, voz e uso de recursos">
            <span className="panel-meta-label">Avatar</span>
            <span className="panel-meta-value" title={avatarName ?? provider.defaultName}>
              {avatarName ?? provider.defaultName}
            </span>
            <span className="panel-meta-stat" tabIndex={0}>
              <span className="panel-meta-stat-label">CPU</span>
              <span className="panel-meta-stat-value">{cpuText}</span>
              <span className="panel-meta-stat-tip">{cpuTip}</span>
            </span>

            <span className="panel-meta-label">Voz</span>
            <span className="panel-meta-value" title={voiceLabel.title || voiceLabel.short}>
              {voiceLabel.short}
            </span>
            <span className="panel-meta-stat" tabIndex={0}>
              <span className="panel-meta-stat-label">RAM</span>
              <span className="panel-meta-stat-value">{ramText}</span>
              <span className="panel-meta-stat-tip">{ramTip}</span>
            </span>
          </div>
        </div>

        <div className="messages" ref={listRef}>
          {messages.length === 0 && (
            <div className="hint">
              Óii! Manda um oi pra Lotus — escreve aqui embaixo ou usa o microfone.
              <br />
              <br />
              Avatar Live2D com animação de corpo. Escolha um modelo na galeria.
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
            placeholder="Fala com a Lotus..."
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
      <AnimationControls open={animationOpen} onClose={() => setAnimationOpen(false)} />
    </div>
  )
}
