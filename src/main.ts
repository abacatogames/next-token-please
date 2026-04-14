import { mockRounds } from "./data/mock-prompts.ts";
import { advanceToken, createGame, makeChoice, startRound } from "./game.ts";
import type { GameState } from "./types.ts";
import { randomRevealDelay } from "./ui/effects.ts";
import { initUI, renderFinished, renderGame, renderIdle } from "./ui/render.ts";

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
			renderGame(state);
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
		render();
		if (state.phase === "revealing") scheduleNextReveal();
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

initUI({
	onStart: handleStart,
	onChoice: handleChoice,
	onPlayAgain: handlePlayAgain,
});

render();
