import { useEffect, useState } from 'react'
import type { AvatarFile, CatalogAvatar, VroidLink } from '../../../shared/types'

export function AvatarGallery({
  open,
  onClose,
  onSelect
}: {
  open: boolean
  onClose: () => void
  onSelect: (file: AvatarFile) => void
}): React.JSX.Element | null {
  const [curated, setCurated] = useState<CatalogAvatar[]>([])
  const [links, setLinks] = useState<VroidLink[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    void (async () => {
      try {
        const [c, v] = await Promise.all([
          window.companion.catalogCurated(),
          window.companion.catalogVroid()
        ])
        setCurated(c)
        setLinks(v)
        setError('')
      } catch (e) {
        setError((e as Error).message)
      }
    })()
  }, [open])

  const useAvatar = async (avatar: CatalogAvatar): Promise<void> => {
    setError('')
    setBusy(true)
    try {
      const file = await window.companion.catalogDownload(avatar.modelUrl, avatar.name)
      onSelect(file)
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const pickLocal = async (): Promise<void> => {
    setError('')
    setBusy(true)
    try {
      const file = await window.companion.pickAvatar()
      if (file) {
        onSelect(file)
        onClose()
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  return (
    <div className="gallery-overlay" onClick={onClose}>
      <div className="gallery-modal" onClick={(e) => e.stopPropagation()}>
        <header className="gallery-header">
          <h2>Escolher avatar Live2D</h2>
          <button type="button" className="gallery-close" onClick={onClose}>
            ✕
          </button>
        </header>

        {error ? <p className="gallery-error">{error}</p> : null}

        <div className="gallery-actions">
          <button
            type="button"
            className="gallery-local-btn"
            disabled={busy}
            onClick={() => void pickLocal()}
          >
            Arquivo local…
          </button>
          <span className="gallery-local-hint">Selecione um <code>.model3.json</code> no seu computador</span>
        </div>

        <p className="gallery-note">Modelos inclusos no app (animação de corpo: idle e gestos):</p>

        <div className="gallery-grid">
          {curated.map((a) => (
            <button
              key={a.id}
              type="button"
              className="gallery-card"
              disabled={busy}
              onClick={() => void useAvatar(a)}
            >
              <img src={a.thumbnailUrl} alt={a.name} loading="lazy" />
              <div className="gallery-card-info">
                <strong>{a.name}</strong>
                <span>{a.license}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="vroid-list">
          <p className="gallery-note">Fontes grátis para baixar mais modelos:</p>
          {links.map((v) => (
            <a key={v.url} className="vroid-card" href={v.url} target="_blank" rel="noreferrer">
              <strong>{v.name}</strong>
              <span>{v.note}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
