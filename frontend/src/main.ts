import { fetchRound, type RoundSource } from "./api.ts";
import { audio } from "./audio.ts";
import { mountCharacter } from "./character/character.ts";
import { isActiveRoundPhase } from "./character/phases.ts";
import { TIMING } from "./constants.ts";
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
import { createAboutScene } from "./scenes/about.ts";
import { createCampaignScene } from "./scenes/campaign.ts";
import { createErrorScene } from "./scenes/error.ts";
import { createFinishedScene } from "./scenes/finished.ts";
import { createGameScene } from "./scenes/game.ts";
import { createIdleScene } from "./scenes/idle.ts";
import { createLoadingScene } from "./scenes/loading.ts";
import { mountAudioControl } from "./scenes/audioControl.ts";
import {
	clearSession,
	loadSession,
	saveSession,
	sessionToGameState,
} from "./storage.ts";
import type { GameMode, GameState } from "./types.ts";

function randomRevealDelay(): number {
	return (
		TIMING.REVEAL_DELAY_MIN +
		Math.random() * (TIMING.REVEAL_DELAY_MAX - TIMING.REVEAL_DELAY_MIN)
	);
}

let state: GameState = createGame();
let revealTimer: ReturnType<typeof setTimeout> | null = null;
let lastSource: RoundSource | null = null;

const restoredSession = loadSession();
if (restoredSession) {
	state = sessionToGameState(restoredSession);
}

const atmosphereRoot = document.getElementById("atmosphere")!;
mountAtmosphere(atmosphereRoot);

audio.attachUnlock();
mountAudioControl(document.getElementById("hud")!);

/* Hover/focus tick for every button, current and future, via delegation. */
document.addEventListener("pointerover", (e) => {
	const btn = (e.target as HTMLElement | null)?.closest("button");
	if (!btn) return;
	if (e.relatedTarget instanceof Node && btn.contains(e.relatedTarget)) return;
	audio.play("hover");
});
document.addEventListener("focusin", (e) => {
	if ((e.target as HTMLElement | null)?.closest("button")) audio.play("hover");
});

const characterStage = document.getElementById("character-stage")!;
const character = mountCharacter(characterStage);
if (state.round?.personality) character.setPersonality(state.round.personality);

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
		onAbout: () => manager.goto("about", state),
	}),
);
manager.register(
	createAboutScene({
		onReturnToIdle: handleReturnToIdle,
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

function persistOrClear() {
	if (state.phase === "idle" || state.phase === "campaign_won") {
		clearSession();
	} else {
		saveSession(state);
	}
}

function render() {
	persistOrClear();
	character.setVisible(isActiveRoundPhase(state.phase));
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
		character.setPersonality(result.round.personality ?? "neutral");
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
		character.setPersonality(result.round.personality ?? "neutral");
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
	audio.play("confirm");
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
if (state.phase === "revealing") scheduleNextReveal();
