# PROJECT: Next Token Please

A browser game where the player role-plays as a language model, completing an AI's answer one word at a time.

## Concept

The player is shown a prompt (e.g. *"Explain why the sky is blue"*) along with the beginning of an LLM-style answer. As the answer streams in word-by-word, the player must occasionally pick the next word from **3 candidates**. Guess more than 50% of the missing words correctly and you win the round.

### Core loop

1. Player clicks **Start**.
2. A prompt appears at the top of the screen.
3. The answer begins revealing itself word-by-word ("typing" effect).
4. Most words auto-reveal. Some stop and ask the player to pick from 3 options.
5. Correct pick → the correct word is inserted. Wrong pick → **the player's wrong word is inserted** and stays in the answer. **No visual feedback either way** — the player shouldn't know whether they got it right until the end.
6. When the answer is complete, reveal the final score, win/lose state, and a side-by-side comparison of **the answer the player built** vs **the answer the LLM actually gave**.
7. **Play again** loads the next prompt.

### Which words are auto-filled vs. chosen by the player

Decided by the backend (mocked for V1):

- The opening words of the answer are always auto-filled (to set context).
- Any word shorter than 3 letters is auto-filled (articles, prepositions, etc.).
- Some other words are randomly auto-filled to keep pacing varied.
- Everything else becomes a "choice word" with 1 correct option + 2 distractors.

Average answer length: ~50 words. Expect roughly 10–20 choice words per round.

## Tech Stack

**Proposed:** Bun + TypeScript + Vite, no UI framework (vanilla DOM).

Notes on the stack choice:
- **Bun** as the package manager / runtime for local dev scripts. Fast installs, works fine alongside Vite.
- **Vite** for the dev server and production bundle. More mature and better HMR than Bun's built-in bundler today, and the ecosystem (plugins, docs) is unmatched for this kind of project.
- **TypeScript** strictly. The game state is small but a discriminated union for game phases (`idle | revealing | awaiting_choice | finished`) will save a lot of bugs.
- **No framework.** For a single-screen game with a typing effect and a few buttons, vanilla DOM + a tiny render function is simpler than React/Vue. If templating starts to hurt, consider `lit-html` (~5KB, no framework, just tagged-template rendering) before reaching for anything bigger.
- **No CSS framework.** A single `styles.css` file with CSS variables for theming. The game benefits from a distinctive, deliberate look — Tailwind won't help here.

### Alternative to consider

If you think the game may grow quickly (multiple screens, settings, leaderboards, animations), **Svelte** is worth a look. It compiles away to near-vanilla JS, has no runtime framework cost, and makes the "reveal one word at a time with transitions" pattern trivial. It would be my second choice.

## Project Structure (V1)

```
/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── public/
└── src/
    ├── main.ts              # entry point, wires UI to game loop
    ├── game.ts              # game state machine + scoring
    ├── types.ts             # Prompt, Answer, ChoiceWord, GameState
    ├── data/
    │   └── mock-prompts.ts  # hardcoded prompts for V1 (stand-in for backend)
    ├── ui/
    │   ├── render.ts        # DOM updates
    │   └── effects.ts       # flash animations, sound hooks
    └── styles.css
```

## Data Shape (the eventual backend contract)

A single round is delivered as one JSON object. Getting this shape right now means the backend swap later is a one-line change.

```ts
type Round = {
  id: string;
  prompt: string;
  // The full answer, already tokenized into words.
  // Each token is either auto-revealed or a choice.
  tokens: Token[];
};

type Token =
  | { kind: "reveal"; word: string }
  | { kind: "choice"; correct: string; distractors: [string, string] };
```

The frontend never decides which words are choices — it just renders what the backend sends. For V1, `src/data/mock-prompts.ts` exports an array of hand-authored `Round` objects.

## V1 Scope (what actually ships first)

- [ ] Project scaffold: Bun + Vite + TS
- [ ] Fixed pool of 5–10 hand-authored mock rounds
- [ ] Start screen with a single button
- [ ] Word-by-word reveal with a typing delay (~80–120ms per word)
- [ ] Choice UI: 3 buttons, click to pick, **no correct/wrong feedback**
- [ ] Wrong picks stay in the answer (not corrected)
- [ ] **Score is tracked internally but never shown during the round** — the player finds out how they did only on the end screen
- [ ] End screen: final score, win/lose, side-by-side of player's answer vs real answer, "Play again" button
- [ ] Basic styling — monospace, dark theme, subtle animations (nothing that hints at correctness mid-round)

## V2 Ideas (once the core is fun)

A few things worth considering — pick the ones that match the vibe you want:

- **Python backend** generating prompts + answers + choice words on demand (the long-term plan).
- **Distractor quality matters a lot.** A bad distractor is either obviously wrong (boring) or a legit synonym (unfair). The backend will need to put real effort here — probably by asking the LLM for "3 plausible but incorrect next tokens" given the partial answer.
- **Streak bonus** — consecutive correct picks worth more, resets on a miss. Adds tension.
- **Timer per choice** — 5 seconds to pick or it counts as wrong. Optional "chill mode" without it.
- **Hint / 50-50** — one-use-per-round ability to eliminate a wrong distractor.
- **Difficulty / "Temperature"** — low temp means easier/more-obvious correct word; high temp means the correct word is a creative choice and distractors look tempting. Fun thematic fit.
- **Shareable result** (Wordle-style emoji grid: 🟩🟥🟩🟩⬜🟩…). Cheap to build, huge for virality.
- **Daily challenge** — one shared round per day, same for everyone, global leaderboard.
- **Categories** — science, pop culture, code, philosophy. Let players pick their poison.
- **Sound design** — a soft click on reveal, a satisfying chime on correct, a dull thud on wrong. Makes the whole thing feel alive for ~2 hours of work.

## Design Decisions

- **Wrong guesses stay.** When the player picks wrong, their word is inserted into the answer instead of the correct one. The final answer is the one the player built — messy, funny, occasionally nonsensical. At the end, we show it side-by-side with what the LLM actually wrote. This turns losses into shareable moments and makes the comparison screen the emotional payoff of the round.
- **No feedback during the round.** No green/red flashes, no score counter, nothing that tells the player whether their last pick was right. The whole point is that the player doesn't know how they did until the comparison screen — that reveal is the fun. Any mid-round feedback spoils it.
- **Fixed pool of prompts for V1.** 5–10 hand-authored rounds. Good enough to validate the loop and feel. Infinite/generated prompts are a backend concern.
- **Always play to the end.** No early-out if the score becomes mathematically unreachable. Every round plays through so the player always gets the comparison screen.
