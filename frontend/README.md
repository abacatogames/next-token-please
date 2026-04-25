# Next Token Please — Frontend

Vanilla TypeScript + Vite, no UI framework. Bun as package manager.

## Develop

```sh
bun install
bun run dev        # vite dev server
bun test           # bun:test suite
bun run typecheck  # tsc --noEmit
bun run lint       # eslint
bun run build      # vite build → dist/ (Coolify deployment)
bun run build:itch # vite build --mode itch → dist-itch/ (itch.io upload)
bun run preview    # preview dist/
```

The default `build` produces a same-origin bundle: `fetch("/api/round")` runs through the Nginx reverse proxy on the Docker stack. The `build:itch` mode reads `frontend/.env.itch` and bakes `VITE_API_BASE_URL` into the bundle so the static itch.io upload can reach the cross-origin backend.

## Itch.io release

`scripts/build-itch.sh` (at the repo root) runs `build:itch` and zips `dist-itch/` into `next-token-please-itch.zip` for upload. Edit `frontend/.env.itch` to set the real backend domain before building.

## Architecture

### Layered mounts

`index.html` exposes four persistent mount points, stacked via z-layer tokens:

```
#atmosphere       rain, grain, scanlines, vignette (mounted once, persists)
#app              active scene content (swapped by SceneManager)
#character-stage  reserved for the persistent LLM character (empty)
#hud              reserved overlay (empty)
```

`#app` is the only element whose innerHTML is replaced during play. Atmosphere and reserved layers never unmount.

### Scenes

`src/scene/` exposes a `Scene<S>` interface (`mount / update? / unmount?`) and a `SceneManager<S>` that dispatches phase changes to the active scene. Current scenes:

- `idle` — boot sequence, masthead, start button
- `loading` — `DECODING_TOKEN_STREAM` placeholder while `fetchRound` is in flight
- `game` — prompt + answer CRT windows, choice buttons, key hints
- `finished` — score report + word-level comparison
- `error` — retry/standby fault screen (routed to only if `fetchRound` throws)

`src/main.ts` owns the game-state lifecycle and routes phase changes to the right scene id. Pure game logic lives in `src/game.ts`.

### Reserved seams

- `src/character/CharacterController.ts` — interface for a future persistent LLM character; mounts into `#character-stage`, not wired yet.
- `src/story/registry.ts` — register/get/list/clear API for future narrative chapters.
- `SceneManager.transitionTo(id, state, { via })` + `src/scene/transitions.ts` — pluggable transition registry (`default | chapter`) for cross-scene animations.
- `Chapter` and `RoundProvider` types in `src/types.ts`, plus optional `chapter` field on `GameState` (non-breaking).

No scene or runtime path invokes these seams yet; they are documented stubs.

### Styles

- `src/styles/tokens.css` — typography, z-layers, motion, color ramp
- `src/styles/base.css` — reset, focus, scanlines, breakpoints
- `src/styles/components.css` — shared button, CRT chrome, keyhints, cursor
- `src/styles/scenes/*.css` — per-scene styles (atmosphere, idle, game, finished, error)
- `src/styles.css` — root that imports all of the above plus JetBrains Mono (self-hosted via `@fontsource-variable/jetbrains-mono`)

### Accessibility

- `prefers-reduced-motion` disables rain, flicker, glitch, word reveal
- `:focus-visible` outline on every interactive element, 44 px minimum touch target
- `aria-live="polite"` on the answer pane, labelled regions on prompt/game/finished/error
- Full keyboard path: `Enter` to start/replay, `1-3` to pick, `Esc` to return to idle

### Invariant: no mid-round feedback

Choice buttons render with identical class lists regardless of correctness. Verified in `scenes/game.test.ts`. Correctness is revealed only on the finished scene.
