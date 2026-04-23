import type { GameState, PlayerChoice, Token } from "./types.ts";

const PUNC_RE = /^[.,;:!?—']$/;

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

function attachesLeft(word: string): boolean {
	return isPunc(word) || word.startsWith("'");
}

export function wordSpan(word: string, extra?: string): string {
	const cls = `word${extra ? ` ${extra}` : ""}${isPunc(word) ? " punc" : ""}`;
	return `<span class="${cls}">${escapeHTML(word)}</span>`;
}

function groupWordSpans(items: { html: string; word: string }[]): string {
	const out: string[] = [];
	let i = 0;
	while (i < items.length) {
		let group = items[i]!.html;
		const startAttaches = attachesLeft(items[i]!.word);
		i++;
		if (!startAttaches) {
			while (i < items.length && attachesLeft(items[i]!.word)) {
				group += items[i]!.html;
				i++;
			}
		}
		out.push(`<span class="word-group">${group}</span>`);
	}
	return out.join(" ");
}

export function renderWords(state: GameState): string {
	const items = state.revealedWords.map((w) => ({
		html: wordSpan(w),
		word: w,
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

	const items: { html: string; word: string }[] = [];
	let choiceIdx = 0;

	for (const token of state.round.tokens) {
		if (token.kind === "reveal") {
			items.push({ html: wordSpan(token.word), word: token.word });
		} else {
			const choice = state.playerChoices[choiceIdx];
			choiceIdx++;
			if (!choice) continue;

			const word = getWord(choice);
			const extra =
				choice.picked === choice.correct ? "diff-correct" : "diff-wrong";
			items.push({ html: wordSpan(word, extra), word });
		}
	}

	return groupWordSpans(items);
}
