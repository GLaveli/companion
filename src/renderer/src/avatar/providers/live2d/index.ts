import type { AvatarProvider } from '../../types'
import { Live2DView } from './Live2DView'
import { LIVE2D_DEFAULT_MODEL_URL, LIVE2D_DEFAULT_NAME } from './config'

export const live2dProvider: AvatarProvider = {
  id: 'live2d',
  label: 'Live2D',
  defaultModelUrl: LIVE2D_DEFAULT_MODEL_URL,
  defaultName: LIVE2D_DEFAULT_NAME,
  View: Live2DView
}
