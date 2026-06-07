/** Lightweight in-memory session flags (reset with chat reset). */
let greeted = false
let userName: string | null | undefined = undefined

export function wasGreeted(): boolean {
  return greeted
}

export function markGreeted(): void {
  greeted = true
}

export function getCachedUserName(): string | null | undefined {
  return userName
}

export function setCachedUserName(name: string): void {
  userName = name
}

export function clearCachedUserName(): void {
  userName = undefined
}

export function resetSessionMemory(): void {
  greeted = false
  userName = undefined
}
