#!/usr/bin/env node
/**
 * Zera Memória (SQLite) e Mente (Qdrant) — teste do zero.
 * Feche o app Lotus antes de rodar.
 */
import { existsSync, unlinkSync } from 'node:fs'
import { homedir, platform } from 'node:os'
import { join } from 'node:path'

const COLLECTION = 'lotus_memory'
const QDRANT_URL = process.env.LOTUS_QDRANT_URL?.trim() || 'http://127.0.0.1:6333'

function sqlitePaths() {
  const candidates = [
    join(homedir(), 'Library/Application Support/project-companion/memory/lotus.db'),
    join(homedir(), 'Library/Application Support/Project Companion/memory/lotus.db')
  ]
  if (platform() === 'win32') {
    candidates.push(
      join(process.env.APPDATA ?? homedir(), 'project-companion/memory/lotus.db'),
      join(process.env.APPDATA ?? homedir(), 'Project Companion/memory/lotus.db')
    )
  } else if (platform() !== 'darwin') {
    candidates.push(
      join(homedir(), '.config/project-companion/memory/lotus.db'),
      join(homedir(), '.config/Project Companion/memory/lotus.db')
    )
  }

  const paths = new Set()
  for (const base of candidates) {
    paths.add(base)
    paths.add(`${base}-wal`)
    paths.add(`${base}-shm`)
  }
  return [...paths]
}

function resetSqlite() {
  let removed = false
  for (const path of sqlitePaths()) {
    if (!existsSync(path)) continue
    unlinkSync(path)
    console.log('Removido:', path)
    removed = true
  }
  if (!removed) console.log('SQLite: nenhum lotus.db encontrado (já vazio ou app nunca abriu).')
  return true
}

async function resetQdrant() {
  try {
    const del = await fetch(`${QDRANT_URL}/collections/${COLLECTION}`, { method: 'DELETE' })
    if (del.ok || del.status === 404) {
      console.log('Qdrant: collection lotus_memory removida.')
      return true
    }
    console.warn('Qdrant DELETE status:', del.status)
    return false
  } catch (err) {
    console.warn('Qdrant offline ou inacessível — suba com npm run memory:qdrant')
    console.warn(err?.message ?? err)
    return false
  }
}

console.log('Resetando Memória (SQLite) e Mente (Qdrant)…\n')
resetSqlite()
await resetQdrant()
console.log('\nPronto. Abra o app de novo (npm run dev) para testar do zero.')
