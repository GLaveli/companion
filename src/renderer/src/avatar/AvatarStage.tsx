import { useCallback, useMemo } from 'react'
import { useStore } from '../store'
import { useFaceTracker } from './faceTracking/useFaceTracker'
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

  useFaceTracker()

  const handleError = useCallback(() => {
    if (modelUrl === provider.defaultModelUrl) {
      console.error(`[avatar] default model failed to load: ${provider.defaultModelUrl}`)
      return
    }
    console.warn(`[avatar] ${modelUrl} failed — falling back to default model`)
    const state = useStore.getState()
    state.setModelStatus({
      llmReady: state.llmReady,
      sttReady: state.sttReady,
      sttState: state.sttState,
      sttDetail: state.sttDetail,
      message: 'Não foi possível carregar esse avatar. Voltando para o padrão.',
      memoriaReady: state.memoriaReady,
      menteReady: state.menteReady,
      memoriaState: state.memoriaState,
      menteState: state.menteState,
      memoriaDetail: state.memoriaDetail,
      menteDetail: state.menteDetail
    })
    setAvatar(provider.defaultModelUrl, provider.defaultName, provider.id)
    void window.companion.saveAvatar({
      name: provider.defaultName,
      kind: provider.id,
      modelUrl: provider.defaultModelUrl
    })
  }, [modelUrl, provider, setAvatar])

  const View = provider.View

  return (
    <div className="avatar-stage" data-provider={provider.id}>
      <View key={`${provider.id}:${modelUrl}`} modelUrl={modelUrl} onError={handleError} />
    </div>
  )
}
