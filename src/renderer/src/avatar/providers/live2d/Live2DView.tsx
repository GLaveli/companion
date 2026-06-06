import { useEffect, useRef } from 'react'
import * as PIXI from 'pixi.js'
import { Application, Ticker } from 'pixi.js'
import { Live2DModel } from 'pixi-live2d-display-lipsyncpatch/cubism4'
import { buildAvatarDriverInput } from '../../driver'
import type { AvatarDriver, AvatarViewProps } from '../../types'
import { createLive2DDriver } from './createLive2DDriver'

// Required by pixi-live2d-display for automatic updates.
;(window as unknown as { PIXI: typeof PIXI }).PIXI = PIXI
Live2DModel.registerTicker(Ticker)

export function Live2DView({ modelUrl, onError, onReady }: AvatarViewProps): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)
  const driverRef = useRef<AvatarDriver | null>(null)
  const appRef = useRef<Application | null>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let disposed = false
    let model: Live2DModel | null = null

    const app = new Application({
      backgroundAlpha: 0,
      antialias: true,
      resizeTo: host
    })
    appRef.current = app
    host.appendChild(app.view as HTMLCanvasElement)

    const onTick = (): void => {
      driverRef.current?.update(buildAvatarDriverInput(Ticker.shared.deltaMS / 1000))
    }
    Ticker.shared.add(onTick)

    void (async () => {
      try {
        model = await Live2DModel.from(modelUrl, { autoInteract: false, ticker: Ticker.shared })
        if (disposed) return

        const scale = Math.min(host.clientWidth / model.width, host.clientHeight / model.height) * 0.92
        model.scale.set(scale)
        model.anchor.set(0.5, 0.5)
        model.position.set(host.clientWidth / 2, host.clientHeight * 0.92)

        app.stage.addChild(model)

        const driver = createLive2DDriver(model)
        driverRef.current = driver
        onReady?.(driver)
      } catch (err) {
        console.warn('[live2d] load failed:', err)
        onError?.()
      }
    })()

    const onResize = (): void => {
      if (!model || !host) return
      const scale = Math.min(host.clientWidth / model.width, host.clientHeight / model.height) * 0.92
      model.scale.set(scale)
      model.position.set(host.clientWidth / 2, host.clientHeight * 0.92)
    }
    window.addEventListener('resize', onResize)

    return () => {
      disposed = true
      window.removeEventListener('resize', onResize)
      Ticker.shared.remove(onTick)
      driverRef.current?.dispose()
      driverRef.current = null
      model?.destroy()
      app.destroy(true, { children: true })
      appRef.current = null
      host.replaceChildren()
    }
  }, [modelUrl, onError, onReady])

  return <div ref={hostRef} className="avatar-canvas-host" />
}
