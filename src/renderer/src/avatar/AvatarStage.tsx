import { useCallback, useMemo } from 'react'
import { useStore } from '../store'
import { getAvatarProvider } from './registry'

/**
 * Provider-agnostic avatar host. Swap engines via `registry.ts` — no changes
 * needed in App, conversation hooks, or audio pipeline.
 */
export function AvatarStage(): React.JSX.Element {
  const avatarUrl = useStore((s) => s.avatarUrl)
  const avatarKind = useStore((s) => s.avatarKind)
  const setAvatar = useStore((s) => s.setAvatar)

  const provider = useMemo(() => getAvatarProvider(avatarKind), [avatarKind])
  const modelUrl = avatarUrl ?? provider.defaultModelUrl

  const handleError = useCallback(() => {
    console.warn(`[avatar] ${provider.id} failed — falling back to default model`)
    setAvatar(provider.defaultModelUrl, provider.defaultName, provider.id)
  }, [provider, setAvatar])

  const View = provider.View

  return (
    <div className="avatar-stage" data-provider={provider.id}>
      <View key={`${provider.id}:${modelUrl}`} modelUrl={modelUrl} onError={handleError} />
    </div>
  )
}
