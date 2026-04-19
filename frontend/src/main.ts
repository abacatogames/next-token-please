import { fetchRound, type RoundSource } from "./api.ts";
import { advanceToken, createGame, makeChoice, startRound } from "./game.ts";
import { SceneManager } from "./scene/sceneManager.ts";
import { mountAtmosphere } from "./scenes/atmosphere.ts";
import { createFinishedScene } from "./scenes/finished.ts";
import { createGameScene } from "./scenes/game.ts";
import { createIdleScene } from "./scenes/idle.ts";
import { createLoadingScene } from "./scenes/loading.ts";
import type { GameState } from "./types.ts";

const REVEAL_DELAY_MIN = 80;
const REVEAL_DELAY_MAX = 120;

function randomRevealDelay(): number {
	return REVEAL_DELAY_MIN + Math.random() * (REVEAL_DELAY_MAX - REVEAL_DELAY_MIN);
}

let state: GameState = createGame();
let revealTimer: ReturnType<typeof setTimeout> | null = null;
let lastSource: RoundSource | null = null;

const atmosphereRoot = document.getElementById("atmosphere")!;
mountAtmosphere(atmosphereRoot);

const appRoot = document.getElementById("app")!;
const manager = new SceneManager<GameState>(appRoot);

manager.register(
	createIdleScene({
		onStart: () => {
			void handleStart();
		},
	}),
);
manager.register(createLoadingScene());
manager.register(
	createGameScene({
		onChoice: handleChoice,
		getRoundSource: () => lastSource,
	}),
);
manager.register(
	createFinishedScene({
		onPlayAgain: () => {
			void handlePlayAgain();
		},
	}),
);

function render() {
	switch (state.phase) {
		case "idle":
			manager.goto("idle", state);
			break;
		case "revealing":
		case "awaiting_choice":
			manager.goto("game", state);
			break;
		case "finished":
			manager.goto("finished", state);
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
	manager.goto("loading", state);
	const result = await fetchRound();
	lastSource = result.source;
	state = startRound(result.round);
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

render();
