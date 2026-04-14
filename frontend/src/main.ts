import { fetchRound } from "./api.ts";
import { advanceToken, createGame, makeChoice, startRound } from "./game.ts";
import type { GameState } from "./types.ts";
import { initUI, renderFinished, renderGame, renderIdle } from "./ui/screens.ts";

const REVEAL_DELAY_MIN = 80;
const REVEAL_DELAY_MAX = 120;

function randomRevealDelay(): number {
	return REVEAL_DELAY_MIN + Math.random() * (REVEAL_DELAY_MAX - REVEAL_DELAY_MIN);
}

let state: GameState = createGame();
let revealTimer: ReturnType<typeof setTimeout> | null = null;

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

async function handleStart() {
	const round = await fetchRound();
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

async function handlePlayAgain() {
	state = createGame();
	await handleStart();
}

initUI({
	onStart: () => {
		void handleStart();
	},
	onChoice: handleChoice,
	onPlayAgain: () => {
		void handlePlayAgain();
	},
});

render();
