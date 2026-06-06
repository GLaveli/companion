const EDGE_NEURAL_LABELS: Record<string, string> = {
  'pt-BR-FranciscaNeural': 'Francisca',
  'pt-BR-ThalitaNeural': 'Thalita'
}

export async function loadActiveVoiceBarLabel(): Promise<{ short: string; title: string }> {
  const voice = await window.companion.getActiveVoice()

  if (voice.engine !== 'edge') {
    return { short: voice.name, title: voice.description ?? voice.name }
  }

  const settings = await window.companion.getEdgeVoiceSettings(voice.id)
  const neural = EDGE_NEURAL_LABELS[settings.edgeVoice] ?? 'Francisca'
  return {
    short: `${voice.name} · ${neural}`,
    title: `${voice.name} — voz neural ${neural}`
  }
}
