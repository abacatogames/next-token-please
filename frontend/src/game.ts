import {
	FINAL_CHAPTER_INDEX,
	type InferenceChapter,
	getChapter,
} from "./story/inferenceRun.ts";
import type {
	CampaignRun,
	GamePhase,
	GameState,
	PlayerChoice,
	Round,
} from "./types.ts";

export function createGame(): GameState {
	return {
		phase: "idle",
		mode: "endless",
		round: null,
		tokenIndex: 0,
		playerChoices: [],
		revealedWords: [],
	};
}

export function startRound(round: Round): GameState {
	return {
		phase: "typing_prompt",
		mode: "endless",
		round,
		tokenIndex: 0,
		playerChoices: [],
		revealedWords: [],
	};
}

export function startCampaign(): GameState {
	return {
		phase: "chapter_intro",
		mode: "campaign",
		round: null,
		tokenIndex: 0,
		playerChoices: [],
		revealedWords: [],
		campaign: {
			chapterIndex: 0,
			roundInChapter: 0,
			chapterCorrect: 0,
			chapterTotal: 0,
		},
	};
}

export function beginCampaignRound(state: GameState, round: Round): GameState {
	if (state.mode !== "campaign" || !state.campaign) return state;
	return {
		phase: "typing_prompt",
		mode: "campaign",
		round,
		tokenIndex: 0,
		playerChoices: [],
		revealedWords: [],
		campaign: state.campaign,
	};
}

export function beginRevealing(state: GameState): GameState {
	if (state.phase !== "typing_prompt") return state;
	return { ...state, phase: "revealing" };
}

export function advanceToken(state: GameState): GameState {
	if (state.phase !== "revealing" || !state.round) return state;

	const { tokens } = state.round;
	const idx = state.tokenIndex;

	if (idx >= tokens.length) {
		return { ...state, phase: "finished" };
	}

	const token = tokens[idx]!;

	if (token.kind === "reveal") {
		return {
			...state,
			tokenIndex: idx + 1,
			revealedWords: [...state.revealedWords, token.word],
		};
	}

	return { ...state, phase: "awaiting_choice" };
}

export function makeChoice(state: GameState, picked: string): GameState {
	if (state.phase !== "awaiting_choice" || !state.round) return state;

	const token = state.round.tokens[state.tokenIndex]!;
	if (token.kind !== "choice") return state;

	const choice: PlayerChoice = {
		tokenIndex: state.tokenIndex,
		picked,
		correct: token.correct,
	};

	return {
		...state,
		phase: "revealing",
		tokenIndex: state.tokenIndex + 1,
		playerChoices: [...state.playerChoices, choice],
		revealedWords: [...state.revealedWords, picked],
	};
}

export function getScore(state: GameState): { correct: number; total: number } {
	const correct = state.playerChoices.filter(
		(c) => c.picked === c.correct,
	).length;
	return { correct, total: state.playerChoices.length };
}

export function isWin(state: GameState): boolean {
	const { correct, total } = getScore(state);
	return total > 0 && correct / total >= 0.5;
}

export function commitRoundToChapter(state: GameState): GameState {
	if (
		state.phase !== "finished" ||
		state.mode !== "campaign" ||
		!state.campaign
	) {
		return state;
	}

	const chapter = getChapter(state.campaign.chapterIndex);
	if (!chapter) return state;

	const { correct, total } = getScore(state);
	const nextCampaign: CampaignRun = {
		chapterIndex: state.campaign.chapterIndex,
		roundInChapter: state.campaign.roundInChapter + 1,
		chapterCorrect: state.campaign.chapterCorrect + correct,
		chapterTotal: state.campaign.chapterTotal + total,
	};

	const isFinalChapter = chapter.index === FINAL_CHAPTER_INDEX;
	const roundMissed = total > 0 && correct < total;
	if (isFinalChapter && roundMissed) {
		return { ...state, phase: "chapter_failed", campaign: nextCampaign };
	}

	return { ...state, phase: "round_recap", campaign: nextCampaign };
}

export function isChapterComplete(state: GameState): boolean {
	if (state.mode !== "campaign" || !state.campaign) return false;
	const chapter = getChapter(state.campaign.chapterIndex);
	if (!chapter) return false;
	return state.campaign.roundInChapter >= chapter.rounds;
}

export function finalizeChapterFromRecap(state: GameState): GameState {
	if (state.phase !== "round_recap" || !state.campaign) return state;
	const chapter = getChapter(state.campaign.chapterIndex);
	if (!chapter) return state;
	if (state.campaign.roundInChapter < chapter.rounds) return state;

	const passed =
		state.campaign.chapterCorrect * 100 >=
		chapter.requiredPercent * state.campaign.chapterTotal;

	let phase: GamePhase;
	if (passed) {
		phase =
			state.campaign.chapterIndex === FINAL_CHAPTER_INDEX
				? "campaign_won"
				: "chapter_passed";
	} else {
		phase = "chapter_failed";
	}

	return { ...state, phase };
}

export function advanceToNextChapter(state: GameState): GameState {
	if (state.phase !== "chapter_passed" || !state.campaign) return state;
	const nextIndex = state.campaign.chapterIndex + 1;
	if (nextIndex > FINAL_CHAPTER_INDEX) return state;
	return {
		...state,
		phase: "chapter_intro",
		round: null,
		tokenIndex: 0,
		playerChoices: [],
		revealedWords: [],
		campaign: {
			chapterIndex: nextIndex,
			roundInChapter: 0,
			chapterCorrect: 0,
			chapterTotal: 0,
		},
	};
}

export type ChapterProgress = {
	chapter: InferenceChapter;
	correctSoFar: number;
	totalSoFar: number;
	pct: number;
	passing: boolean;
};

export function chapterProgress(state: GameState): ChapterProgress | null {
	if (state.mode !== "campaign" || !state.campaign) return null;
	const chapter = getChapter(state.campaign.chapterIndex);
	if (!chapter) return null;

	const { correct, total } = getScore(state);
	const correctSoFar = state.campaign.chapterCorrect + correct;
	const totalSoFar = state.campaign.chapterTotal + total;
	const pct = totalSoFar > 0 ? Math.round((correctSoFar / totalSoFar) * 100) : 0;
	const passing =
		totalSoFar === 0 ||
		correctSoFar * 100 >= chapter.requiredPercent * totalSoFar;

	return { chapter, correctSoFar, totalSoFar, pct, passing };
}

function joinSpacedWords(words: string[], leadingSpaces: boolean[]): string {
	let out = "";
	for (let i = 0; i < words.length; i++) {
		if (i > 0 && leadingSpaces[i]) out += " ";
		out += words[i];
	}
	return out;
}

export function getPlayerAnswer(state: GameState): string {
	const tokens = state.round?.tokens ?? [];
	const leading = state.revealedWords.map((_, i) => tokens[i]?.leading_space ?? i > 0);
	return joinSpacedWords(state.revealedWords, leading);
}

export function getOriginalAnswer(state: GameState): string {
	if (!state.round) return "";
	const words = state.round.tokens.map((t) =>
		t.kind === "reveal" ? t.word : t.correct,
	);
	const leading = state.round.tokens.map((t) => t.leading_space);
	return joinSpacedWords(words, leading);
}
