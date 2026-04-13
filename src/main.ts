import type { GameState } from "./types.ts";
import { createGame, startRound, advanceToken, makeChoice } from "./game.ts";
import { initUI, renderIdle, renderRevealing, renderFinished } from "./ui/render.ts";
import { randomRevealDelay } from "./ui/effects.ts";
import { mockRounds } from "./data/mock-prompts.ts";

let state: GameState = createGame();
let revealTimer: ReturnType<typeof setTimeout> | null = null;
let roundIndex = 0;

function render() {
  switch (state.phase) {
    case "idle":
      renderIdle();
      break;
    case "revealing":
    case "awaiting_choice":
      renderRevealing(state);
      break;
    case "finished":
      renderFinished(state);
      break;
  }
}

function scheduleNextReveal() {
  if (state.phase !== "revealing") return;

  revealTimer = setTimeout(() => {
    state = advanceToken(state);

    if (state.phase === "revealing") {
      render();
      scheduleNextReveal();
    } else if (state.phase === "awaiting_choice") {
      render();
      // Wait for player input
    } else if (state.phase === "finished") {
      render();
    }
  }, randomRevealDelay());
}

function handleStart() {
  const round = mockRounds[roundIndex % mockRounds.length]!;
  state = startRound(round);
  render();
  scheduleNextReveal();
}

function handleChoice(word: string) {
  if (revealTimer) clearTimeout(revealTimer);
  state = makeChoice(state, word);
  render();
  scheduleNextReveal();
}

function handlePlayAgain() {
  roundIndex++;
  state = createGame();
  handleStart();
}

// Boot
initUI({
  onStart: handleStart,
  onChoice: handleChoice,
  onPlayAgain: handlePlayAgain,
});

render();
