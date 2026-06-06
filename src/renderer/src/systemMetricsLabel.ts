import type { SystemMetrics } from '../../../shared/types'

export function formatCpuPercent(value: number): string {
  if (value < 10) return `${value.toFixed(1)}%`
  return `${Math.round(value)}%`
}

export function formatRamUsage(metrics: SystemMetrics): string {
  const { ramUsedMb, ramTotalMb } = metrics
  const used =
    ramUsedMb >= 1024 ? `${(ramUsedMb / 1024).toFixed(1)} GB` : `${Math.round(ramUsedMb)} MB`

  if (ramTotalMb && ramTotalMb > 0) {
    const total =
      ramTotalMb >= 1024 ? `${(ramTotalMb / 1024).toFixed(1)} GB` : `${Math.round(ramTotalMb)} MB`
    return `${used} / ${total}`
  }

  return used
}

export function metricsScopeLabel(scope: SystemMetrics['scope']): string {
  return scope === 'app' ? 'Lotus' : 'Sistema'
}

export function metricsTooltip(
  kind: 'cpu' | 'ram',
  metrics: SystemMetrics | null
): string {
  if (!metrics) {
    return kind === 'cpu' ? 'Medindo uso de CPU…' : 'Medindo uso de RAM…'
  }

  const source = metricsScopeLabel(metrics.scope)

  if (metrics.scope === 'app') {
    return kind === 'cpu'
      ? `Fonte: ${source}. CPU usada pelos processos da Lotus (app + IA local).`
      : `Fonte: ${source}. RAM usada pelos processos da Lotus (app + IA local).`
  }

  return kind === 'cpu'
    ? `Fonte: ${source}. CPU de todo o computador.`
    : `Fonte: ${source}. RAM usada no computador${metrics.ramTotalMb ? ' (barra = usada / total)' : ''}.`
}
