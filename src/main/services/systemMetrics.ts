import { app } from 'electron'
import os from 'node:os'
import type { SystemMetrics } from '../../shared/types'

let prevCpuSample: { idle: number; total: number } | null = null

function sampleSystemCpuPercent(): number {
  const cpus = os.cpus()
  let idle = 0
  let total = 0
  for (const cpu of cpus) {
    idle += cpu.times.idle
    for (const time of Object.values(cpu.times)) total += time
  }

  if (!prevCpuSample) {
    prevCpuSample = { idle, total }
    return 0
  }

  const idleDelta = idle - prevCpuSample.idle
  const totalDelta = total - prevCpuSample.total
  prevCpuSample = { idle, total }

  if (totalDelta <= 0) return 0
  const usage = ((totalDelta - idleDelta) / totalDelta) * 100
  return Math.max(0, Math.min(100, usage))
}

function getSystemRam(): { usedMb: number; totalMb: number } {
  const info = process.getSystemMemoryInfo?.()
  if (info) {
    const totalMb = info.total / 1024
    const freeMb = info.free / 1024
    return { usedMb: Math.max(0, totalMb - freeMb), totalMb }
  }

  const totalMb = os.totalmem() / (1024 * 1024)
  const freeMb = os.freemem() / (1024 * 1024)
  return { usedMb: Math.max(0, totalMb - freeMb), totalMb }
}

function getAppMetrics(): { cpuPercent: number; ramMb: number } | null {
  if (!app.isReady()) return null

  const metrics = app.getAppMetrics()
  if (!metrics.length) return null

  let cpuPercent = 0
  let ramKb = 0
  for (const entry of metrics) {
    cpuPercent += entry.cpu.percentCPUUsage
    ramKb += entry.memory.workingSetSize
  }

  return {
    cpuPercent: Math.max(0, Math.min(100, cpuPercent)),
    ramMb: ramKb / 1024
  }
}

export function readSystemMetrics(): SystemMetrics {
  const appMetrics = getAppMetrics()
  const systemRam = getSystemRam()

  if (appMetrics) {
    return {
      scope: 'app',
      cpuPercent: Math.round(appMetrics.cpuPercent * 10) / 10,
      ramUsedMb: Math.round(appMetrics.ramMb),
      ramTotalMb: null
    }
  }

  return {
    scope: 'system',
    cpuPercent: Math.round(sampleSystemCpuPercent() * 10) / 10,
    ramUsedMb: Math.round(systemRam.usedMb),
    ramTotalMb: Math.round(systemRam.totalMb)
  }
}
