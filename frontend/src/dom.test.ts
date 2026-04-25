import { describe, expect, test } from "bun:test";
import {
	attachesLeft,
	crtWindow,
	escapeAttr,
	escapeHTML,
	highlightDiffs,
	renderComparison,
	renderWords,
	shuffleOptions,
	wordSpan,
} from "./dom.ts";
import type { GameState, Round } from "./types.ts";

const round: Round = {
	id: "test",
	prompt: "Test prompt",
	tokens: [
		{ kind: "reveal", word: "Hello", leading_space: false },
		{
			kind: "choice",
			correct: "world",
			distractors: ["earth", "planet"],
			leading_space: true,
		},
		{ kind: "reveal", word: ".", leading_space: false },
		{
			kind: "choice",
			correct: "Cheers",
			distractors: ["bye", "ciao"],
			leading_space: true,
		},
	],
};

function roundWith(words: string[]): Round {
	return {
		id: "test",
		prompt: "p",
		tokens: words.map((word, i) => ({
			kind: "reveal" as const,
			word,
			leading_space: i > 0 && !attachesLeft(word),
		})),
	};
}

function state(overrides: Partial<GameState> = {}): GameState {
	return {
		phase: "revealing",
		mode: "endless",
		round,
		tokenIndex: 0,
		playerChoices: [],
		revealedWords: [],
		...overrides,
	};
}

describe("escapeHTML", () => {
	test("escapes ampersands, angle brackets", () => {
		expect(escapeHTML("<div>&</div>")).toBe("&lt;div&gt;&amp;&lt;/div&gt;");
	});

	test("passes plain text through", () => {
		expect(escapeHTML("hello world")).toBe("hello world");
	});

	test("escapes ampersand before other entities", () => {
		expect(escapeHTML("&lt;")).toBe("&amp;lt;");
	});
});

describe("crtWindow", () => {
	test("renders title-bar dots and session title", () => {
		const html = crtWindow({ title: "HELLO", body: "x" });
		expect(html).toContain(
			'<span class="crt-dots" aria-hidden="true"><i></i><i></i><i></i></span>',
		);
		expect(html).toContain('<span class="crt-session">HELLO</span>');
		expect(html).toContain('<div class="crt-window">');
		expect(html).toContain('<div class="crt-body">x</div>');
	});

	test("appends windowClass and bodyClass modifiers", () => {
		const html = crtWindow({
			title: "T",
			body: "y",
			windowClass: "prompt-window",
			bodyClass: "prompt-body",
		});
		expect(html).toContain('<div class="crt-window prompt-window">');
		expect(html).toContain('<div class="crt-body prompt-body">y</div>');
	});

	test("inlines bodyAttrs after the body class", () => {
		const html = crtWindow({
			title: "T",
			body: "z",
			bodyClass: "answer-body",
			bodyAttrs: `id="answer" aria-live="polite"`,
		});
		expect(html).toContain(
			'<div class="crt-body answer-body" id="answer" aria-live="polite">z</div>',
		);
	});
});

describe("escapeAttr", () => {
	test("escapes quotes in addition to HTML", () => {
		expect(escapeAttr('say "hi" & <bye>')).toBe(
			"say &quot;hi&quot; &amp; &lt;bye&gt;",
		);
	});
});

describe("wordSpan", () => {
	test("wraps plain word with base class", () => {
		expect(wordSpan("hello")).toBe('<span class="word">hello</span>');
	});

	test("marks punctuation with punc class", () => {
		expect(wordSpan(".")).toBe('<span class="word punc">.</span>');
		expect(wordSpan(",")).toBe('<span class="word punc">,</span>');
		expect(wordSpan("—")).toBe('<span class="word punc">—</span>');
	});

	test("appends extra class when provided", () => {
		expect(wordSpan("hello", "diff-correct")).toBe(
			'<span class="word diff-correct">hello</span>',
		);
	});

	test("combines extra and punc classes", () => {
		expect(wordSpan(".", "diff-wrong")).toBe(
			'<span class="word diff-wrong punc">.</span>',
		);
	});

	test("escapes HTML in word content", () => {
		expect(wordSpan("<script>")).toBe(
			'<span class="word">&lt;script&gt;</span>',
		);
	});
});

describe("renderWords", () => {
	test("renders revealed words with trailing cursor while revealing", () => {
		const words = ["Hi", "there"];
		const html = renderWords(
			state({ round: roundWith(words), revealedWords: words }),
		);
		expect(html).toContain(">Hi<");
		expect(html).toContain(">there<");
		expect(html).toContain('<span class="cursor">');
	});

	test("keeps cursor while awaiting a choice", () => {
		const html = renderWords(
			state({
				round: roundWith(["Hi"]),
				phase: "awaiting_choice",
				revealedWords: ["Hi"],
			}),
		);
		expect(html).toContain('<span class="cursor">');
	});

	test("omits cursor when round is finished", () => {
		const html = renderWords(
			state({
				round: roundWith(["Hi"]),
				phase: "finished",
				revealedWords: ["Hi"],
			}),
		);
		expect(html).not.toContain("cursor");
	});

	test("empty words still shows cursor during reveal", () => {
		expect(renderWords(state())).toBe('<span class="cursor"></span>');
	});

	test("groups word with trailing punctuation and separates groups with space", () => {
		const words = ["Hello", ".", "World"];
		const html = renderWords(
			state({
				round: roundWith(words),
				phase: "finished",
				revealedWords: words,
			}),
		);
		expect(html).toBe(
			'<span class="word-group"><span class="word">Hello</span><span class="word punc">.</span></span> ' +
				'<span class="word-group"><span class="word">World</span></span>',
		);
	});

	test("attaches possessive apostrophe token to preceding word", () => {
		const words = ["Moon", "'s", "gravity"];
		const html = renderWords(
			state({
				round: roundWith(words),
				phase: "finished",
				revealedWords: words,
			}),
		);
		expect(html).toBe(
			'<span class="word-group"><span class="word">Moon</span><span class="word">\'s</span></span> ' +
				'<span class="word-group"><span class="word">gravity</span></span>',
		);
	});

	test("attaches contraction n't to preceding verb", () => {
		const tokens: Round["tokens"] = [
			{ kind: "reveal", word: "Do", leading_space: false },
			{ kind: "reveal", word: "n't", leading_space: false },
			{ kind: "reveal", word: "stop", leading_space: true },
		];
		const html = renderWords(
			state({
				round: { id: "t", prompt: "p", tokens },
				phase: "finished",
				revealedWords: ["Do", "n't", "stop"],
			}),
		);
		expect(html).toBe(
			'<span class="word-group"><span class="word">Do</span><span class="word">n\'t</span></span> ' +
				'<span class="word-group"><span class="word">stop</span></span>',
		);
	});

	test("glues parentheses to inner word", () => {
		const tokens: Round["tokens"] = [
			{ kind: "reveal", word: "It", leading_space: false },
			{ kind: "reveal", word: "(", leading_space: true },
			{ kind: "reveal", word: "really", leading_space: false },
			{ kind: "reveal", word: ")", leading_space: false },
			{ kind: "reveal", word: "works", leading_space: true },
		];
		const html = renderWords(
			state({
				round: { id: "t", prompt: "p", tokens },
				phase: "finished",
				revealedWords: ["It", "(", "really", ")", "works"],
			}),
		);
		expect(html).toBe(
			'<span class="word-group"><span class="word">It</span></span> ' +
				'<span class="word-group"><span class="word punc">(</span><span class="word">really</span><span class="word punc">)</span></span> ' +
				'<span class="word-group"><span class="word">works</span></span>',
		);
	});

	test("glues straight quotes to inner word", () => {
		const tokens: Round["tokens"] = [
			{ kind: "reveal", word: "She", leading_space: false },
			{ kind: "reveal", word: "said", leading_space: true },
			{ kind: "reveal", word: '"', leading_space: true },
			{ kind: "reveal", word: "hi", leading_space: false },
			{ kind: "reveal", word: '"', leading_space: false },
		];
		const html = renderWords(
			state({
				round: { id: "t", prompt: "p", tokens },
				phase: "finished",
				revealedWords: ["She", "said", '"', "hi", '"'],
			}),
		);
		expect(html).toBe(
			'<span class="word-group"><span class="word">She</span></span> ' +
				'<span class="word-group"><span class="word">said</span></span> ' +
				'<span class="word-group"><span class="word punc">"</span><span class="word">hi</span><span class="word punc">"</span></span>',
		);
	});
});

describe("shuffleOptions", () => {
	test("returns correct and both distractors", () => {
		const token = {
			kind: "choice" as const,
			correct: "world",
			distractors: ["earth", "planet"] as [string, string],
			leading_space: true,
		};
		const options = shuffleOptions(token);
		expect(options).toHaveLength(3);
		expect(options.sort()).toEqual(["earth", "planet", "world"]);
	});
});

describe("renderComparison", () => {
	test("returns empty string when no round", () => {
		expect(renderComparison(state({ round: null }))).toBe("");
	});

	test("emits operator and ground-truth CRT windows inside a comparison wrapper", () => {
		const html = renderComparison(
			state({
				playerChoices: [{ tokenIndex: 1, picked: "earth", correct: "world" }],
			}),
		);
		expect(html).toContain('<div class="comparison">');
		expect(html).toContain('<span class="crt-session">OPERATOR_OUTPUT</span>');
		expect(html).toContain(
			'<span class="crt-session">MODEL_GROUND_TRUTH</span>',
		);
		expect(html).toContain(">earth<");
		expect(html).toContain(">world<");
	});
});

describe("highlightDiffs", () => {
	test("returns empty string when no round", () => {
		expect(highlightDiffs(state({ round: null }), (c) => c.picked)).toBe("");
	});

	test("marks correct picks with diff-correct", () => {
		const s = state({
			playerChoices: [
				{ tokenIndex: 1, picked: "world", correct: "world" },
				{ tokenIndex: 3, picked: "bye", correct: "Cheers" },
			],
		});
		const html = highlightDiffs(s, (c) => c.picked);
		expect(html).toContain('<span class="word diff-correct">world</span>');
		expect(html).toContain('<span class="word diff-wrong">bye</span>');
	});

	test("uses supplied accessor to pick display word", () => {
		const s = state({
			playerChoices: [{ tokenIndex: 1, picked: "earth", correct: "world" }],
		});
		const playerView = highlightDiffs(s, (c) => c.picked);
		const originalView = highlightDiffs(s, (c) => c.correct);
		expect(playerView).toContain(">earth<");
		expect(originalView).toContain(">world<");
	});

	test("skips choices without a recorded pick", () => {
		const s = state({ playerChoices: [] });
		const html = highlightDiffs(s, (c) => c.picked);
		expect(html).toContain(">Hello<");
		expect(html).toContain(">.<");
		expect(html).not.toContain("diff-");
	});

	test("includes reveal tokens verbatim", () => {
		const html = highlightDiffs(state(), (c) => c.picked);
		expect(html).toContain('<span class="word">Hello</span>');
		expect(html).toContain('<span class="word punc">.</span>');
	});
});
