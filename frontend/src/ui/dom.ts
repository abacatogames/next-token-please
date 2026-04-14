import type { GameState, PlayerChoice, Token } from "../types.ts";

const PUNC_RE = /^[.,;:!?—']$/;

export function escapeHTML(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function escapeAttr(s: string): string {
	return escapeHTML(s).replace(/"/g, "&quot;");
}

export function wordSpan(word: string, extra?: string): string {
	const cls = `word${extra ? ` ${extra}` : ""}${PUNC_RE.test(word) ? " punc" : ""}`;
	return `<span class="${cls}">${escapeHTML(word)}</span>`;
}

export function renderWords(state: GameState): string {
	const words = state.revealedWords.map((w) => wordSpan(w)).join("");
	const cursor =
		state.phase === "revealing" ? '<span class="cursor"></span>' : "";
	return words + cursor;
}

export function shuffleOptions(
	token: Extract<Token, { kind: "choice" }>,
): string[] {
	const options = [token.correct, ...token.distractors];
	for (let i = options.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[options[i], options[j]] = [options[j]!, options[i]!];
	}
	return options;
}

export function highlightDiffs(
	state: GameState,
	getWord: (c: PlayerChoice) => string,
): string {
	if (!state.round) return "";

	const parts: string[] = [];
	let choiceIdx = 0;

	for (const token of state.round.tokens) {
		if (token.kind === "reveal") {
			parts.push(wordSpan(token.word));
		} else {
			const choice = state.playerChoices[choiceIdx];
			choiceIdx++;
			if (!choice) continue;

			const extra =
				choice.picked === choice.correct ? "diff-correct" : "diff-wrong";
			parts.push(wordSpan(getWord(choice), extra));
		}
	}

	return parts.join("");
}
