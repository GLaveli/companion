import { useEffect, useRef } from 'react'
import * as PIXI from 'pixi.js'
import { Application, Ticker } from 'pixi.js'
import { Live2DModel } from 'pixi-live2d-display-lipsyncpatch/cubism4'
import { useShallow } from 'zustand/react/shallow'
import { buildAvatarDriverInput } from '../../driver'
import { useAvatarLayout } from '../../layoutStore'
import type { AvatarDriver, AvatarViewProps } from '../../types'
import { createLive2DDriver } from './createLive2DDriver'
import { layoutLive2DModel, measureLive2DBase, type Live2DBaseSize } from './config'

function waitForCubismCore(timeoutMs = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = performance.now()
    const tick = (): void => {
      if ((window as unknown as { Live2DCubismCore?: unknown }).Live2DCubismCore) {
        resolve()
        return
      }
      if (performance.now() - start > timeoutMs) {
        reject(new Error('Live2D Cubism Core não carregou. Rode npm run setup:live2d'))
        return
      }
      requestAnimationFrame(tick)
    }
    tick()
  })
}

function stageSize(host: HTMLElement): { w: number; h: number } | null {
  const w = host.clientWidth
  const h = host.clientHeight
  if (w < 2 || h < 2) return null
  return { w, h }
}

export function Live2DView({ modelUrl, onError, onReady }: AvatarViewProps): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)
  const modelRef = useRef<Live2DModel | null>(null)
  const baseRef = useRef<Live2DBaseSize | null>(null)
  const appRef = useRef<Application | null>(null)
  const driverRef = useRef<AvatarDriver | null>(null)
  const hydrated = useAvatarLayout((s) => s.hydrated)
  const layout = useAvatarLayout(
    useShallow((s) => ({ x: s.x, y: s.y, scaleFactor: s.scaleFactor }))
  )

  useEffect(() => {
    if (!hydrated) return
    const host = hostRef.current
    if (!host) return

    let disposed = false
    let resizeObserver: ResizeObserver | null = null
    let resizeFrame = 0

    ;(window as unknown as { PIXI: typeof PIXI }).PIXI = PIXI
    Live2DModel.registerTicker(Ticker)

    const applyLayout = (): void => {
      const model = modelRef.current
      const base = baseRef.current
      const app = appRef.current
      if (!model || !base || !app || !host) return

      const size = stageSize(host)
      if (!size) return

      app.renderer.resize(size.w, size.h)
      layoutLive2DModel(model, size.w, size.h, useAvatarLayout.getState(), base)
    }

    const onTick = (): void => {
      driverRef.current?.update(buildAvatarDriverInput(Ticker.shared.deltaMS / 1000))
    }
    Ticker.shared.add(onTick)

    void (async () => {
      try {
        await waitForCubismCore()
        if (disposed) return

        const size = stageSize(host) ?? { w: 640, h: 480 }
        const app = new Application({
          backgroundAlpha: 0,
          antialias: true,
          width: size.w,
          height: size.h
        })
        appRef.current = app
        host.appendChild(app.view as HTMLCanvasElement)

        const model = await Live2DModel.from(modelUrl, {
          autoHitTest: false,
          autoFocus: false,
          ticker: Ticker.shared
        })
        if (disposed) {
          model.destroy()
          return
        }

        app.stage.addChild(model)
        baseRef.current = measureLive2DBase(model)
        modelRef.current = model
        applyLayout()

        resizeObserver = new ResizeObserver(() => {
          cancelAnimationFrame(resizeFrame)
          resizeFrame = requestAnimationFrame(applyLayout)
        })
        resizeObserver.observe(host)

        const driver = createLive2DDriver(model)
        driverRef.current = driver
        onReady?.(driver)
      } catch (err) {
        console.warn('[live2d] load failed:', err)
        onError?.()
      }
    })()

    return () => {
      disposed = true
      cancelAnimationFrame(resizeFrame)
      Ticker.shared.remove(onTick)
      resizeObserver?.disconnect()
      driverRef.current?.dispose()
      driverRef.current = null
      modelRef.current?.destroy()
      modelRef.current = null
      baseRef.current = null
      const app = appRef.current
      appRef.current = null
      if (app) {
        try {
          app.destroy(true, { children: true })
        } catch {
          /* ignore double-destroy from Pixi resize plugin */
        }
      }
      host.replaceChildren()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelUrl, onError, onReady, hydrated])

  useEffect(() => {
    if (!hydrated) return
    const host = hostRef.current
    const model = modelRef.current
    const base = baseRef.current
    const app = appRef.current
    if (!host || !model || !base || !app) return

    const size = stageSize(host)
    if (!size) return

    app.renderer.resize(size.w, size.h)
    layoutLive2DModel(model, size.w, size.h, useAvatarLayout.getState(), base)
  }, [hydrated, layout.x, layout.y, layout.scaleFactor])

  return <div ref={hostRef} className="avatar-canvas-host" />
}
