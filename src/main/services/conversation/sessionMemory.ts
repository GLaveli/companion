/** Lightweight in-memory session flags (reset with chat reset). */
let greeted = false

export function wasGreeted(): boolean {
  return greeted
}

export function markGreeted(): void {
  greeted = true
}

export function resetSessionMemory(): void {
  greeted = false
}
