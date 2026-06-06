import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts'

const tts = new MsEdgeTTS()
const voices = await tts.getVoices()
const pt = voices.filter((v) => v.Locale?.startsWith('pt'))
console.log('Vozes pt disponiveis:')
for (const v of pt) console.log(`  ${v.ShortName}  (${v.Gender})`)

const voice = process.argv[2] || 'pt-BR-ThalitaNeural'
console.log(`\nTestando sintese com: ${voice}`)
await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3)
const { audioStream } = tts.toStream('Oi! Tudo bem? Que bom falar com voce!', { pitch: '+18%', rate: '-4%' })
let bytes = 0
audioStream.on('data', (c) => (bytes += c.length))
await new Promise((res) => audioStream.on('end', res))
tts.close()
console.log(`Audio gerado: ${bytes} bytes`)
