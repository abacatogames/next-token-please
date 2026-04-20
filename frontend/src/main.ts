import { fetchRound, type RoundSource } from "./api.ts";
import {
	advanceToNextChapter,
	advanceToken,
	beginCampaignRound,
	beginRevealing,
	commitRoundToChapter,
	createGame,
	finalizeChapterFromRecap,
	isChapterComplete,
	makeChoice,
	startCampaign,
	startRound,
} from "./game.ts";
import { SceneManager } from "./scene/sceneManager.ts";
import { mountAtmosphere } from "./scenes/atmosphere.ts";
import { createCampaignScene } from "./scenes/campaign.ts";
import { createErrorScene } from "./scenes/error.ts";
import { createFinishedScene } from "./scenes/finished.ts";
import { createGameScene } from "./scenes/game.ts";
import { createIdleScene } from "./scenes/idle.ts";
import { createLoadingScene } from "./scenes/loading.ts";
import type { GameMode, GameState } from "./types.ts";

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
		onModeSelect: (mode: GameMode) => {
			if (mode === "campaign") {
				state = startCampaign();
				render();
			} else {
				void handleEndlessStart();
			}
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
	createCampaignScene({
		onContinueRound: () => {
			if (state.phase === "round_recap" && isChapterComplete(state)) {
				state = finalizeChapterFromRecap(state);
				render();
				return;
			}
			void handleCampaignRoundStart();
		},
		onNextChapter: handleNextChapter,
		onExit: handleReturnToIdle,
	}),
);
manager.register(
	createErrorScene({
		onRetry: () => {
			if (state.mode === "campaign") {
				void handleCampaignRoundStart();
			} else {
				void handleEndlessStart();
			}
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
			if (state.mode === "campaign") {
				state = commitRoundToChapter(state);
				render();
				return;
			}
			manager.goto("finished", state);
			break;
		case "chapter_intro":
		case "round_recap":
		case "chapter_passed":
		case "chapter_failed":
		case "campaign_won":
			manager.goto("campaign", state);
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

async function handleEndlessStart() {
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

async function handleCampaignRoundStart() {
	manager.goto("loading", state);
	try {
		const result = await fetchRound();
		lastSource = result.source;
		state = beginCampaignRound(state, result.round);
		render();
	} catch (err) {
		console.error("[main] round fetch failed:", err);
		manager.goto("error", state);
	}
}

function handleNextChapter() {
	state = advanceToNextChapter(state);
	render();
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
	await handleEndlessStart();
}

function handleReturnToIdle() {
	if (revealTimer) clearTimeout(revealTimer);
	state = createGame();
	render();
}

render();
