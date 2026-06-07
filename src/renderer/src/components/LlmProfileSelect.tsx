import { useCallback, useEffect, useState } from 'react'
import type {
  LlmDownloadProgress,
  LlmModelOption,
  LlmProfileId,
  LlmProfileState
} from '../../../shared/types'

const PROFILE_LABEL: Record<LlmProfileId, string> = {
  auto: 'Auto',
  hermes: 'Hermes 3',
  qwen: 'Qwen leve'
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 MB'
  return `${(bytes / 1e6).toFixed(0)} MB`
}

export function LlmProfileSelect({
  disabled = false
}: {
  disabled?: boolean
}): React.JSX.Element {
  const [state, setState] = useState<LlmProfileState | null>(null)
  const [busy, setBusy] = useState(false)
  const [download, setDownload] = useState<LlmDownloadProgress | null>(null)
  const [error, setError] = useState('')

  const refresh = useCallback(async (): Promise<void> => {
    try {
      setState(await window.companion.getLlmProfile())
    } catch (err) {
      console.error('[llm-profile] load failed:', err)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const off = window.companion.onLlmDownloadProgress((progress) => {
      setDownload(progress)
    })
    return off
  }, [])

  const hasAnyModel = state?.options.some((o) => o.available) ?? false
  const missing = state?.options.filter((o) => !o.available) ?? []
  const downloading = download?.phase === 'downloading'

  const onChange = async (profile: LlmProfileId): Promise<void> => {
    if (!state || profile === state.profile || busy || downloading) return
    setBusy(true)
    setError('')
    try {
      setState(await window.companion.setLlmProfile(profile))
    } catch (err) {
      console.error('[llm-profile] switch failed:', err)
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const startDownload = async (option: LlmModelOption): Promise<void> => {
    if (busy || downloading) return
    setBusy(true)
    setError('')
    setDownload({
      profileId: option.id,
      phase: 'downloading',
      percent: 0,
      receivedBytes: 0,
      totalBytes: 0,
      message: `Preparando ${PROFILE_LABEL[option.id]}…`
    })
    try {
      const result = await window.companion.downloadLlmModel(option.id)
      setState(result.state)
      if (!result.ok) {
        setError(result.error ?? 'Falha no download.')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
      setDownload(null)
    }
  }

  const cancelDownload = async (): Promise<void> => {
    try {
      await window.companion.cancelLlmDownload()
    } catch (err) {
      console.error('[llm-profile] cancel failed:', err)
    }
  }

  const current = state?.profile ?? 'auto'
  const currentOption = state?.options.find((o) => o.id === current)
  const optionHint = current === 'auto' ? undefined : currentOption?.ramHint

  return (
    <div className="llm-brain-panel">
      <span className="panel-meta-label">Cérebro</span>

      {!hasAnyModel ? (
        <div className="llm-brain-setup">
          <p className="llm-brain-setup-hint">
            Nenhum modelo instalado. Escolha <strong>um</strong> para baixar agora — o outro pode
            instalar depois pelo mesmo painel.
          </p>
          <div className="llm-brain-choices">
            {state?.options.map((option) => (
              <button
                key={option.id}
                type="button"
                className="llm-brain-choice"
                disabled={disabled || busy || downloading}
                onClick={() => void startDownload(option)}
              >
                <span className="llm-brain-choice-title">{PROFILE_LABEL[option.id]}</span>
                <span className="llm-brain-choice-meta">
                  {option.sizeHint} · {option.ramHint}
                </span>
                <span className="llm-brain-choice-desc">{option.description}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <label className="llm-profile-select">
            <select
              value={current}
              disabled={disabled || busy || downloading || !state}
              onChange={(e) => void onChange(e.target.value as LlmProfileId)}
              title={
                optionHint
                  ? `${PROFILE_LABEL[current]} · ${optionHint}`
                  : 'Escolha o modelo local (Hermes = padrão do projeto)'
              }
            >
              <option value="auto">Auto (Hermes se existir)</option>
              <option
                value="hermes"
                disabled={!state?.options.find((o) => o.id === 'hermes')?.available}
              >
                Hermes 3 · ~6–8 GB RAM
              </option>
              <option
                value="qwen"
                disabled={!state?.options.find((o) => o.id === 'qwen')?.available}
              >
                Qwen 2.5 · ~3–4 GB RAM
              </option>
            </select>
          </label>

          {missing.length > 0 ? (
            <div className="llm-brain-missing">
              {missing.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className="llm-brain-download-btn"
                  disabled={disabled || busy || downloading}
                  onClick={() => void startDownload(option)}
                  title={option.description}
                >
                  Baixar {PROFILE_LABEL[option.id]} ({option.sizeHint})
                </button>
              ))}
            </div>
          ) : null}
        </>
      )}

      {download && download.phase === 'downloading' ? (
        <div className="llm-download-progress" role="status" aria-live="polite">
          <progress max={100} value={download.percent || undefined} />
          <span className="llm-download-message">{download.message}</span>
          {download.totalBytes ? (
            <span className="llm-download-bytes">
              {formatBytes(download.receivedBytes)} / {formatBytes(download.totalBytes)}
            </span>
          ) : null}
          <button type="button" className="llm-download-cancel" onClick={() => void cancelDownload()}>
            Cancelar
          </button>
        </div>
      ) : null}

      {error ? <p className="llm-brain-error">{error}</p> : null}
    </div>
  )
}
