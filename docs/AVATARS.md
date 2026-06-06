# Avatares

O app usa uma arquitetura **desacoplada** para trocar engines sem reescrever o chat, voz ou lip-sync.

## Arquitetura

```
Conversa (useConversation) → store (phase, emotion)
Audio (player) → lipsync.ts (currentVolume)
                              ↓
                    avatar/driver.ts (AvatarDriverInput)
                              ↓
                    avatar/AvatarStage.tsx
                              ↓
                    avatar/registry.ts → provider ativo
                              ↓
              providers/live2d/ | providers/vrm/ | …
```

### Contrato estável

| Arquivo | Papel |
|---------|-------|
| `avatar/types.ts` | `AvatarDriver`, `AvatarProvider`, `AvatarDriverInput` |
| `avatar/driver.ts` | Monta input neutro (fase, emoção, boca) |
| `avatar/registry.ts` | Mapa `AvatarKind` → provider |
| `avatar/AvatarStage.tsx` | Host React — não conhece Live2D/VRM |

### Trocar de engine no futuro

1. Crie `src/renderer/src/avatar/providers/<engine>/`
2. Implemente `AvatarProvider` com um `View` + `createXDriver()`
3. Registre em `avatar/registry.ts`
4. (Opcional) Ajuste `DEFAULT_AVATAR_KIND` em `avatar/config.ts`

## Engine atual: Live2D

- Biblioteca: `pixi.js` + `pixi-live2d-display-lipsyncpatch`
- Modelo padrão: **Hiyori** (oficial Live2D, idle animado)
- Lip-sync: parâmetros `ParamMouthOpenY` via `currentVolume()`
- Corpo: motions `Idle` em loop + gestos `TapBody` ao falar feliz

### Setup

```bash
npm run setup:live2d          # Hiyori + Cubism Core
npm run setup:live2d -- --mao # inclui modelo Mao (expressoes)
npm run dev
```

### Modelo local

1. Baixe uma pasta Live2D completa (`.model3.json` + `.moc3` + texturas + motions)
2. **Arquivo local** → selecione o `.model3.json`
3. O app carrega os assets relativos via `file://`

Fontes gratis: [Live2D Samples](https://www.live2d.com/en/learn/sample/), [Booth](https://booth.pm/en/browse/Live2D?max_price=0)

## Legado VRM/GLB

O suporte 3D anterior foi removido do renderer. Tipos `vrm`/`glb` permanecem em `AvatarKind` para reativar um provider futuro sem mudar IPC.
