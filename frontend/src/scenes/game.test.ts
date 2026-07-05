import { describe, expect, test } from "bun:test";
import type { GameState, Round } from "../types.ts";
import { renderGameHTML } from "./game.ts";

const round: Round = {
	id: "test-round-abc123",
	prompt: "Why?",
	tokens: [
		{ kind: "reveal", word: "Because", leading_space: false },
		{
			kind: "choice",
			correct: "science",
			distractors: ["magic", "vibes"],
			leading_space: true,
		},
	],
};

function state(overrides: Partial<GameState> = {}): GameState {
	return {
		phase: "awaiting_choice",
		mode: "endless",
		round,
		tokenIndex: 1,
		playerChoices: [],
		revealedWords: ["Because"],
		...overrides,
	};
}

describe("renderGameHTML", () => {
	test("returns empty string when no round", () => {
		const s: GameState = {
			phase: "idle",
			mode: "endless",
			round: null,
			tokenIndex: 0,
			playerChoices: [],
			revealedWords: [],
		};
		expect(renderGameHTML(s, null, null)).toBe("");
	});

	test("wraps prompt and output in CRT windows", () => {
		const html = renderGameHTML(state(), null, null);
		expect(html).toContain("prompt-window");
		expect(html).toContain("answer-window");
		expect(html).toContain("Why?");
		expect(html).toContain(">Because<");
	});

	test("derives session tag from round id", () => {
		const html = renderGameHTML(state(), null, null);
		expect(html).toContain("PROMPT_C123");
		expect(html).toContain("MODEL_OUTPUT_C123");
	});

	test("omits choice section outside awaiting_choice", () => {
		const html = renderGameHTML(state({ phase: "revealing" }), null, null);
		expect(html).not.toContain("choice-buttons");
		expect(html).not.toContain("btn-choice");
	});

	test("renders three choice buttons with 1/2/3 key hints", () => {
		const html = renderGameHTML(state(), ["alpha", "beta", "gamma"], null);
		expect(html).toMatch(/<kbd[^>]*>1<\/kbd>/);
		expect(html).toMatch(/<kbd[^>]*>2<\/kbd>/);
		expect(html).toMatch(/<kbd[^>]*>3<\/kbd>/);
		expect(html).toContain(">alpha<");
		expect(html).toContain(">beta<");
		expect(html).toContain(">gamma<");
	});

	test("choice buttons carry no correctness indication", () => {
		const html = renderGameHTML(
			state(),
			["magic", "science", "vibes"],
			null,
		);
		expect(html).not.toMatch(/diff-correct|diff-wrong/);
		expect(html).not.toMatch(/data-correct|is-correct|is-wrong/);

		const classes = [...html.matchAll(/class="(btn btn-choice[^"]*)"/g)].map(
			(m) => m[1],
		);
		expect(classes).toHaveLength(3);
		expect(new Set(classes).size).toBe(1);
	});

	test("shows diff feedback on the answer word right after a pick", () => {
		const html = renderGameHTML(
			state({
				phase: "revealing",
				tokenIndex: 2,
				revealedWords: ["Because", "science"],
				playerChoices: [
					{ tokenIndex: 1, picked: "science", correct: "science" },
				],
			}),
			null,
			null,
		);
		expect(html).toContain(
			'<span class="word diff-correct word-feedback-in">science</span>',
		);
	});

	test("omits progress bar outside campaign mode", () => {
		const html = renderGameHTML(state(), null, null);
		expect(html).not.toContain("campaign-progress");
	});

	test("renders progress bar and pips reflecting chapter progress", () => {
		const html = renderGameHTML(
			state({
				mode: "campaign",
				campaign: {
					chapterIndex: 0,
					roundInChapter: 1,
					chapterCorrect: 1,
					chapterTotal: 3,
				},
			}),
			null,
			null,
		);
		expect(html).toContain('style="width: 33%"');
		expect(html).toContain("campaign-progress-fill is-fail");
		const pips = [...html.matchAll(/class="campaign-progress-pip( is-filled)?"/g)];
		expect(pips).toHaveLength(3);
		expect(pips.filter((m) => m[1]).length).toBe(1);
	});

	test("colors progress bar as passing when above target", () => {
		const html = renderGameHTML(
			state({
				mode: "campaign",
				campaign: {
					chapterIndex: 0,
					roundInChapter: 2,
					chapterCorrect: 2,
					chapterTotal: 2,
				},
			}),
			null,
			null,
		);
		expect(html).toContain("campaign-progress-fill is-pass");
	});

	test("shows fallback log only when source is fallback", () => {
		expect(renderGameHTML(state(), null, "fallback")).toContain(
			"FALLBACK: LOCAL_CACHE",
		);
		expect(renderGameHTML(state(), null, "backend")).not.toContain(
			"FALLBACK",
		);
		expect(renderGameHTML(state(), null, null)).not.toContain("FALLBACK");
	});
});
