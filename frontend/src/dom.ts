import type { GameState, PlayerChoice, Token } from "./types.ts";

const PUNC_RE = /^[^\w]+$/u;

export function escapeHTML(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function escapeAttr(s: string): string {
	return escapeHTML(s).replace(/"/g, "&quot;");
}

export function crtWindow(opts: {
	title: string;
	body: string;
	windowClass?: string;
	bodyClass?: string;
	bodyAttrs?: string;
}): string {
	const wc = opts.windowClass ? ` ${opts.windowClass}` : "";
	const bc = opts.bodyClass ? ` ${opts.bodyClass}` : "";
	const attrs = opts.bodyAttrs ? ` ${opts.bodyAttrs}` : "";
	return `<div class="crt-window${wc}">
      <header class="crt-title-bar">
        <span class="crt-dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="crt-session">${opts.title}</span>
      </header>
      <div class="crt-body${bc}"${attrs}>${opts.body}</div>
    </div>`;
}

export function isPunc(word: string): boolean {
	return PUNC_RE.test(word);
}

const DASH_RE = /^[—–]$/u;

export function attachesLeft(word: string): boolean {
	if (DASH_RE.test(word)) return false;
	return isPunc(word) || word.startsWith("'");
}

export function wordSpan(word: string, extra?: string): string {
	const cls = `word${extra ? ` ${extra}` : ""}${isPunc(word) ? " punc" : ""}`;
	return `<span class="${cls}">${escapeHTML(word)}</span>`;
}

type SpacedItem = { html: string; leading_space: boolean };

function groupWordSpans(items: SpacedItem[]): string {
	const groups: string[][] = [];
	for (const item of items) {
		if (groups.length === 0 || item.leading_space) {
			groups.push([item.html]);
		} else {
			groups[groups.length - 1]!.push(item.html);
		}
	}
	return groups
		.map((g) => `<span class="word-group">${g.join("")}</span>`)
		.join(" ");
}

function pickFeedbackClass(state: GameState, index: number): string | undefined {
	const token = state.round?.tokens[index];
	if (!token || token.kind !== "choice") return undefined;

	const choice = state.playerChoices.find((c) => c.tokenIndex === index);
	if (!choice) return undefined;

	const diffClass = choice.picked === choice.correct ? "diff-correct" : "diff-wrong";
	const isLast = index === state.revealedWords.length - 1;
	return isLast ? `${diffClass} word-feedback-in` : diffClass;
}

export function renderWords(state: GameState): string {
	const tokens = state.round?.tokens ?? [];
	const items: SpacedItem[] = state.revealedWords.map((w, i) => ({
		html: wordSpan(w, pickFeedbackClass(state, i)),
		leading_space: tokens[i]?.leading_space ?? i > 0,
	}));
	const showCursor =
		state.phase === "revealing" || state.phase === "awaiting_choice";
	const cursor = showCursor ? '<span class="cursor"></span>' : "";
	return groupWordSpans(items) + cursor;
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

export function renderComparison(state: GameState): string {
	if (!state.round) return "";
	const operatorCol = crtWindow({
		windowClass: "comparison-col",
		bodyClass: "comparison-text",
		title: "OPERATOR_OUTPUT",
		body: highlightDiffs(state, (c) => c.picked),
	});
	const truthCol = crtWindow({
		windowClass: "comparison-col",
		bodyClass: "comparison-text",
		title: "MODEL_GROUND_TRUTH",
		body: highlightDiffs(state, (c) => c.correct),
	});
	return `
    <div class="comparison">
      ${operatorCol}
      ${truthCol}
    </div>
  `;
}

export function highlightDiffs(
	state: GameState,
	getWord: (c: PlayerChoice) => string,
): string {
	if (!state.round) return "";

	const items: SpacedItem[] = [];
	let choiceIdx = 0;

	for (const token of state.round.tokens) {
		if (token.kind === "reveal") {
			items.push({
				html: wordSpan(token.word),
				leading_space: token.leading_space,
			});
		} else {
			const choice = state.playerChoices[choiceIdx];
			choiceIdx++;
			if (!choice) continue;

			const word = getWord(choice);
			const extra =
				choice.picked === choice.correct ? "diff-correct" : "diff-wrong";
			items.push({
				html: wordSpan(word, extra),
				leading_space: token.leading_space,
			});
		}
	}

	return groupWordSpans(items);
}
