import type { AvatarKind } from '../../../shared/types'
import type { AvatarProvider } from './types'
import { DEFAULT_AVATAR_KIND } from './config'
import { live2dProvider } from './providers/live2d'

/**
 * Register new backends here. The rest of the app only imports `getAvatarProvider`.
 *
 * Example future entry:
 *   vrm: vrmProvider,
 */
const PROVIDERS: Partial<Record<AvatarKind, AvatarProvider>> = {
  live2d: live2dProvider
}

export function getAvatarProvider(kind: AvatarKind | null): AvatarProvider {
  const key = kind ?? DEFAULT_AVATAR_KIND
  return PROVIDERS[key] ?? live2dProvider
}

export function listAvatarProviders(): AvatarProvider[] {
  return Object.values(PROVIDERS).filter((p): p is AvatarProvider => Boolean(p))
}
