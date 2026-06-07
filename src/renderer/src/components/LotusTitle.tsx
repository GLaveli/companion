import { useEffect, useRef } from 'react'

interface LotusTitleProps {
  text?: string
}

export function LotusTitle({ text = 'Lotus' }: LotusTitleProps): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)
  const tickRef = useRef(0)
  const rafRef = useRef(0)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const particles: HTMLSpanElement[] = []
    const count = 32

    for (let i = 0; i < count; i++) {
      const particle = document.createElement('span')
      particle.className = 'lotus-title__dot'
      particle.style.left = `${8 + Math.random() * 84}%`
      particle.style.top = `${10 + Math.random() * 80}%`
      host.appendChild(particle)
      particles.push(particle)
    }

    const animate = (): void => {
      tickRef.current += 1
      const frame = tickRef.current

      particles.forEach((particle, index) => {
        const t = frame * 0.022 + index * 0.7
        const x = Math.sin(t * 0.5) * 14 + Math.cos(t * 0.32) * 18
        const y = Math.cos(t * 0.42) * 11 + Math.sin(t * 0.58) * 15
        particle.style.transform = `translate(${x}px, ${y}px)`
        particle.style.opacity = String(Math.sin(t * 1.8) * 0.28 + 0.52)
      })

      rafRef.current = requestAnimationFrame(animate)
    }

    rafRef.current = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(rafRef.current)
      particles.forEach((particle) => particle.remove())
    }
  }, [text])

  return (
    <h1 className="lotus-title">
      <span ref={hostRef} className="lotus-title__stage">
        <span className="lotus-title__glow" aria-hidden="true" />
        <span className="lotus-title__text">{text}</span>
      </span>
    </h1>
  )
}
