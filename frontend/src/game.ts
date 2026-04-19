import type { GameState, PlayerChoice, Round } from "./types.ts";

export function createGame(): GameState {
	return {
		phase: "idle",
		round: null,
		tokenIndex: 0,
		playerChoices: [],
		revealedWords: [],
	};
}

export function startRound(round: Round): GameState {
	return {
		phase: "typing_prompt",
		round,
		tokenIndex: 0,
		playerChoices: [],
		revealedWords: [],
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
	return total > 0 && correct / total > 0.5;
}

function joinWords(words: string[]): string {
	return words.join(" ").replace(/ ([.,;:!?—'])/g, "$1");
}

export function getPlayerAnswer(state: GameState): string {
	return joinWords(state.revealedWords);
}

export function getOriginalAnswer(state: GameState): string {
	if (!state.round) return "";
	return joinWords(
		state.round.tokens.map((t) => (t.kind === "reveal" ? t.word : t.correct)),
	);
}
