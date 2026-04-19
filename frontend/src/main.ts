import { fetchRound, type RoundSource } from "./api.ts";
import {
	advanceToken,
	beginRevealing,
	createGame,
	makeChoice,
	startRound,
} from "./game.ts";
import { SceneManager } from "./scene/sceneManager.ts";
import { mountAtmosphere } from "./scenes/atmosphere.ts";
import { createErrorScene } from "./scenes/error.ts";
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
		onPromptTyped: handlePromptTyped,
		getRoundSource: () => lastSource,
	}),
);
manager.register(
	createFinishedScene({
		onPlayAgain: () => {
			void handlePlayAgain();
		},
		onReturnToIdle: handleReturnToIdle,
	}),
);
manager.register(
	createErrorScene({
		onRetry: () => {
			void handleStart();
		},
		onReturnToIdle: handleReturnToIdle,
	}),
);

function render() {
	switch (state.phase) {
		case "idle":
			manager.goto("idle", state);
			break;
		case "typing_prompt":
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
	try {
		const result = await fetchRound();
		lastSource = result.source;
		state = startRound(result.round);
		render();
	} catch (err) {
		console.error("[main] round fetch failed:", err);
		manager.goto("error", state);
	}
}

function handlePromptTyped() {
	if (state.phase !== "typing_prompt") return;
	state = beginRevealing(state);
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

function handleReturnToIdle() {
	if (revealTimer) clearTimeout(revealTimer);
	state = createGame();
	render();
}

render();
