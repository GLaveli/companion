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
import { LlmProfileSelect } from './components/LlmProfileSelect'
import { DevLogPanel } from './components/DevLogPanel'
import { StatusIndicator } from './components/StatusIndicator'
import { LotusTitle } from './components/LotusTitle'
import { useConversation } from './hooks/useConversation'
import { AgentConfirmDialog } from './agent'
import { loadActiveVoiceBarLabel } from './voiceLabel'
import { formatCpuPercent, formatRamUsage, metricsTooltip } from './systemMetricsLabel'
import type { AvatarFile, MemoryIndicatorState, SttIndicatorState, SystemMetrics } from '../../shared/types'

const PHASE_LABEL: Record<string, string> = {
  idle: 'Pronta para conversar',
  listening: 'Ouvindo… fale e pause',
  thinking: 'Pensando...',
  speaking: 'Falando...'
}

const MENTE_SETUP_CMD = 'npm run memory:qdrant'

function formatSttStatus(
  state: SttIndicatorState,
  detail: string
): { shortLabel: string; tooltip: string; indicatorClass: string; dotClass: string; detail: string } {
  if (state === 'ready') {
    return {
      shortLabel: 'Ouvido',
      tooltip: detail || 'Whisper pronto — microfone liberado.',
      indicatorClass: 'ready',
      dotClass: 'on',
      detail: ''
    }
  }

  if (state === 'loading') {
    return {
      shortLabel: 'Ouvido',
      tooltip: detail || 'Baixando Whisper tiny… primeira vez pode demorar.',
      indicatorClass: 'waiting',
      dotClass: 'loading',
      detail: detail || 'Preparando ouvido (Whisper)…'
    }
  }

  return {
    shortLabel: 'Ouvido',
    tooltip: detail || 'Ouvido indisponível — instale com npm run setup:stt ou use o teclado.',
    indicatorClass: 'waiting',
    dotClass: 'off',
    detail: detail || 'Ouvido indisponível.'
  }
}

function formatMemoryIndicator(
  state: MemoryIndicatorState,
  kind: 'memoria' | 'mente'
): { shortLabel: string; tooltip: string; indicatorClass: string; dotClass: string } {
  const name = kind === 'memoria' ? 'Memória' : 'Mente'

  if (state === 'ready') {
    return {
      shortLabel: name,
      tooltip: kind === 'memoria' ? 'Memória pronta.' : 'Mente pronta.',
      indicatorClass: 'ready',
      dotClass: 'on'
    }
  }

  if (state === 'offline') {
    return {
      shortLabel: name,
      tooltip:
        kind === 'memoria'
          ? 'Diário SQLite desconectado — a Lotus tenta reconectar a cada poucos segundos.'
          : `mind1 desconectado — a Lotus tenta reconectar. Se instalou agora:\n${MENTE_SETUP_CMD}\n(Docker Desktop aberto)`,
      indicatorClass: 'waiting',
      dotClass: 'off'
    }
  }

  return {
    shortLabel: name,
    tooltip:
      kind === 'memoria'
        ? 'Diário local incluído no app — activa ao iniciar ou quando reconectar.'
        : `Busca semântica inactiva. Para activar:\n${MENTE_SETUP_CMD}\n(Docker Desktop aberto)`,
    indicatorClass: 'inactive',
    dotClass: 'inactive'
  }
}

function formatLlmStatus(
  ready: boolean,
  message: string
): { shortLabel: string; detail: string; tooltip: string } {
  const modelMatch = message.match(/Modelo carregado:\s*(.+)/i)
  const rawName = modelMatch?.[1]?.trim()
  const profileName = rawName
    ?.split(/[.·]/)[0]
    ?.replace(/\s*RAM do sistema.*/i, '')
    ?.trim()

  if (ready) {
    const name = profileName || 'Hermes 3'
    return {
      shortLabel: 'IA pronta',
      detail: '',
      tooltip: `${name} carregado — pronta para conversar. CPU e RAM estão no painel abaixo.`
    }
  }

  if (message.includes('Nenhum cérebro')) {
    return {
      shortLabel: 'Sem modelo',
      detail: 'Baixe um cérebro no painel abaixo.',
      tooltip: message
    }
  }

  const waiting =
    message.includes('Carregando') || message.includes('Trocando')
      ? message
      : message.includes('Modelo carregado')
        ? 'Carregando o cérebro da Lotus…'
        : message || 'Carregando o cérebro da Lotus…'
  const detail = waiting.length > 64 ? 'Carregando o cérebro da Lotus…' : waiting
  return {
    shortLabel: 'Carregando IA',
    detail,
    tooltip: detail
  }
}

export default function App(): React.JSX.Element {
  const {
    messages,
    phase,
    statusMessage,
    llmReady,
    sttState,
    sttDetail,
    memoriaState,
    menteState,
    avatarName,
    avatarKind
  } = useStore()
  const { sendText, startListening, stopListening } = useConversation()
  const [input, setInput] = useState('')
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [animationOpen, setAnimationOpen] = useState(false)
  const [layoutOpen, setLayoutOpen] = useState(false)
  const [voiceOpen, setVoiceOpen] = useState(false)
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
      useStore.getState().setModelStatus(s)
    })
    const offLog = window.companion.onDevLog((entry) => {
      useStore.getState().pushDevLog(entry)
    })
    window.companion.getStatus().then((s) => useStore.getState().setModelStatus(s))

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
        await refreshVoiceLabel()
      } catch (err) {
        console.error('[app] init failed:', err)
      }
    })()

    return () => {
      off()
      offLog()
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
  const micLoading = sttState === 'loading'
  const micOffline = sttState === 'offline'
  const provider = useMemo(() => getAvatarProvider(avatarKind), [avatarKind])
  const llmStatus = useMemo(
    () => formatLlmStatus(llmReady, statusMessage),
    [llmReady, statusMessage]
  )
  const memoriaStatus = useMemo(
    () => formatMemoryIndicator(memoriaState, 'memoria'),
    [memoriaState]
  )
  const menteStatus = useMemo(() => formatMemoryIndicator(menteState, 'mente'), [menteState])
  const sttStatus = useMemo(() => formatSttStatus(sttState, sttDetail), [sttState, sttDetail])
  const badgeLabel = useMemo(() => {
    if (phase === 'idle' && micLoading) return 'Preparando ouvido…'
    return PHASE_LABEL[phase]
  }, [phase, micLoading])
  const cpuText = systemMetrics ? formatCpuPercent(systemMetrics.cpuPercent) : '—'
  const ramText = systemMetrics ? formatRamUsage(systemMetrics) : '—'
  const cpuTip = metricsTooltip('cpu', systemMetrics)
  const ramTip = metricsTooltip('ram', systemMetrics)

  return (
    <div className="app">
      <div className="stage">
        <AvatarStage />
        <div className="badge">{badgeLabel}</div>

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
            <LotusTitle />
            <div className="status-indicators" role="group" aria-label="Estado da IA e memória">
              <StatusIndicator
                label={llmStatus.shortLabel}
                tooltip={llmStatus.tooltip}
                indicatorClass={llmReady ? 'ready' : 'waiting'}
                dotClass={llmReady ? 'on' : 'off'}
              />
              <StatusIndicator
                label={sttStatus.shortLabel}
                tooltip={sttStatus.tooltip}
                indicatorClass={sttStatus.indicatorClass}
                dotClass={sttStatus.dotClass}
              />
              <StatusIndicator
                label={memoriaStatus.shortLabel}
                tooltip={memoriaStatus.tooltip}
                indicatorClass={memoriaStatus.indicatorClass}
                dotClass={memoriaStatus.dotClass}
              />
              <StatusIndicator
                label={menteStatus.shortLabel}
                tooltip={menteStatus.tooltip}
                indicatorClass={menteStatus.indicatorClass}
                dotClass={menteStatus.dotClass}
              />
            </div>
          </header>
          {sttStatus.detail || llmStatus.detail ? (
            <p className="status status--compact">{sttStatus.detail || llmStatus.detail}</p>
          ) : null}

          <div className="panel-meta" role="group" aria-label="Avatar, voz, cérebro e uso de recursos">
            <span className="panel-meta-label">Avatar</span>
            <span className="panel-meta-value" title={avatarName ?? provider.defaultName}>
              {avatarName ?? provider.defaultName}
            </span>

            <span className="panel-meta-label">Voz</span>
            <span className="panel-meta-value" title={voiceLabel.title || voiceLabel.short}>
              {voiceLabel.short}
            </span>

            <div className="panel-meta-stats" role="group" aria-label="Uso de CPU e RAM">
              <span className="panel-meta-stat" tabIndex={0}>
                <span className="panel-meta-stat-label">CPU</span>
                <span className="panel-meta-stat-value">{cpuText}</span>
                <span className="panel-meta-stat-tip">{cpuTip}</span>
              </span>
              <span className="panel-meta-stat" tabIndex={0}>
                <span className="panel-meta-stat-label">RAM</span>
                <span className="panel-meta-stat-value">{ramText}</span>
                <span className="panel-meta-stat-tip">{ramTip}</span>
              </span>
            </div>

            <LlmProfileSelect disabled={!llmReady && phase === 'thinking'} />
          </div>
        </div>

        <div className="messages" ref={listRef}>
          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>
              {m.content}
            </div>
          ))}
        </div>

        <form className="composer" onSubmit={onSubmit}>
          <button
            type="button"
            className={`mic ${micActive ? 'recording' : ''} ${micLoading ? 'mic--loading' : ''}`}
            disabled={micOffline}
            aria-busy={micLoading}
            onClick={() => {
              if (micOffline) return
              if (micLoading) return
              if (micActive) void stopListening()
              else void startListening()
            }}
            title={
              micLoading
                ? sttDetail
                : micOffline
                  ? sttDetail || 'Ouvido indisponível'
                  : micActive
                    ? 'Clique para enviar agora (ou pare de falar)'
                    : phase === 'speaking'
                      ? 'Interromper e falar'
                      : 'Clique e fale — envia ao pausar'
            }
          >
            {micLoading ? (
              <span className="mic-spinner" aria-hidden="true" />
            ) : micActive ? (
              '■'
            ) : (
              '🎤'
            )}
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              micLoading ? 'Preparando ouvido (Whisper)…' : 'Fala com a Lotus...'
            }
          />
          <button type="submit" disabled={!input.trim()}>
            Enviar
          </button>
        </form>

        <DevLogPanel />
      </aside>

      <AvatarGallery
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        onSelect={applyAvatar}
      />
      <AnimationControls open={animationOpen} onClose={() => setAnimationOpen(false)} />
      <AgentConfirmDialog />
    </div>
  )
}
