/** Serializa gravações SQLite/Qdrant fora do caminho crítico do chat. */
type WriteJob = () => Promise<void>

const queue: WriteJob[] = []
let running = false

export function enqueueMemoryWrite(job: WriteJob): void {
  queue.push(job)
  void runQueue()
}

async function runQueue(): Promise<void> {
  if (running) return
  running = true

  while (queue.length > 0) {
    const job = queue.shift()
    if (!job) continue
    try {
      await job()
    } catch (err) {
      console.warn('[memory] write failed:', (err as Error).message)
    }
    await new Promise<void>((resolve) => setImmediate(resolve))
  }

  running = false
}
