import type { CatalogAvatar, VroidLink } from '../../shared/types'

/** Built-in and recommended Live2D models (renderer resolves bundled paths). */
export const CURATED_AVATARS: CatalogAvatar[] = [
  {
    id: 'hiyori',
    name: 'Hiyori',
    projectId: 'live2d-official',
    license: 'Live2D Free Material',
    thumbnailUrl:
      'https://raw.githubusercontent.com/Live2D/CubismWebSamples/develop/Samples/Resources/Hiyori/Hiyori.2048/texture_00.png',
    modelUrl: '/models/hiyori/Hiyori.model3.json',
    description: 'Modelo oficial com idle animado (corpo + respiracao). Padrao do app.'
  },
  {
    id: 'mao',
    name: 'Mao',
    projectId: 'live2d-official',
    license: 'Live2D Free Material',
    thumbnailUrl:
      'https://raw.githubusercontent.com/Live2D/CubismWebSamples/develop/Samples/Resources/Mao/Mao.2048/texture_00.png',
    modelUrl: '/models/mao/Mao.model3.json',
    description: 'Modelo oficial com expressoes e gestos. Rode npm run setup:live2d -- --mao'
  }
]

/** External sources for anime-style Live2D models (manual download). */
export const LIVE2D_FREE_LINKS: VroidLink[] = [
  {
    name: 'Live2D Samples oficiais',
    url: 'https://www.live2d.com/en/learn/sample/',
    note: 'Hiyori, Mao, Rice — gratis para uso nao comercial.'
  },
  {
    name: 'Booth — modelos Live2D gratis',
    url: 'https://booth.pm/en/browse/Live2D?max_price=0',
    note: 'Muitos modelos anime; verifique a licenca de cada um.'
  },
  {
    name: 'Cubism Web Samples (GitHub)',
    url: 'https://github.com/Live2D/CubismWebSamples/tree/develop/Samples/Resources',
    note: 'Arquivos fonte dos modelos oficiais.'
  }
]

export async function listCurated(): Promise<CatalogAvatar[]> {
  return CURATED_AVATARS
}

export async function listCollections(): Promise<never[]> {
  return []
}

export async function listCollectionAvatars(_projectId: string): Promise<never[]> {
  return []
}

export async function listVroidLinks(): Promise<VroidLink[]> {
  return LIVE2D_FREE_LINKS
}

/** Select a curated model — returns a URL the renderer can load directly. */
export async function downloadCatalogAvatar(
  modelUrl: string,
  name: string
): Promise<{ name: string; kind: 'live2d'; modelUrl: string }> {
  return { name, kind: 'live2d', modelUrl }
}
