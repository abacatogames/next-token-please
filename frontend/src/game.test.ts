import { describe, expect, test } from "bun:test";
import {
	advanceToken,
	beginRevealing,
	createGame,
	getOriginalAnswer,
	getPlayerAnswer,
	getScore,
	isWin,
	makeChoice,
	startRound,
} from "./game.ts";
import type { Round } from "./types.ts";

const round: Round = {
	id: "test",
	prompt: "Test prompt",
	tokens: [
		{ kind: "reveal", word: "Hello" },
		{ kind: "choice", correct: "world", distractors: ["earth", "planet"] },
		{ kind: "reveal", word: "." },
	],
};

describe("createGame", () => {
	test("returns idle state", () => {
		const s = createGame();
		expect(s.phase).toBe("idle");
		expect(s.round).toBeNull();
		expect(s.tokenIndex).toBe(0);
		expect(s.playerChoices).toEqual([]);
		expect(s.revealedWords).toEqual([]);
	});
});

describe("startRound", () => {
	test("sets phase to typing_prompt with fresh state", () => {
		const s = startRound(round);
		expect(s.phase).toBe("typing_prompt");
		expect(s.round).toBe(round);
		expect(s.tokenIndex).toBe(0);
		expect(s.playerChoices).toEqual([]);
		expect(s.revealedWords).toEqual([]);
	});
});

describe("beginRevealing", () => {
	test("transitions typing_prompt to revealing", () => {
		const s = startRound(round);
		expect(beginRevealing(s).phase).toBe("revealing");
	});

	test("no-op outside typing_prompt", () => {
		const s = createGame();
		expect(beginRevealing(s)).toBe(s);
	});
});

describe("advanceToken", () => {
	test("no-op when not revealing", () => {
		const s = createGame();
		expect(advanceToken(s)).toBe(s);
	});

	test("no-op during typing_prompt", () => {
		const s = startRound(round);
		expect(advanceToken(s)).toBe(s);
	});

	test("reveals word and increments index", () => {
		const s = beginRevealing(startRound(round));
		const next = advanceToken(s);
		expect(next.tokenIndex).toBe(1);
		expect(next.revealedWords).toEqual(["Hello"]);
		expect(next.phase).toBe("revealing");
	});

	test("transitions to awaiting_choice on choice token", () => {
		const s = { ...beginRevealing(startRound(round)), tokenIndex: 1 };
		const next = advanceToken(s);
		expect(next.phase).toBe("awaiting_choice");
		expect(next.tokenIndex).toBe(1);
	});

	test("transitions to finished when past last token", () => {
		const s = {
			...beginRevealing(startRound(round)),
			tokenIndex: round.tokens.length,
		};
		const next = advanceToken(s);
		expect(next.phase).toBe("finished");
	});
});

describe("makeChoice", () => {
	test("no-op when not awaiting_choice", () => {
		const s = startRound(round);
		expect(makeChoice(s, "world")).toBe(s);
	});

	test("records choice and resumes revealing", () => {
		const s = {
			...startRound(round),
			phase: "awaiting_choice" as const,
			tokenIndex: 1,
		};
		const next = makeChoice(s, "world");
		expect(next.phase).toBe("revealing");
		expect(next.tokenIndex).toBe(2);
		expect(next.revealedWords).toContain("world");
		expect(next.playerChoices).toHaveLength(1);
		expect(next.playerChoices[0]).toMatchObject({
			picked: "world",
			correct: "world",
		});
	});

	test("records incorrect choice", () => {
		const s = {
			...startRound(round),
			phase: "awaiting_choice" as const,
			tokenIndex: 1,
		};
		const next = makeChoice(s, "earth");
		expect(next.playerChoices[0]).toMatchObject({
			picked: "earth",
			correct: "world",
		});
	});
});

describe("getScore", () => {
	test("empty when no choices", () => {
		expect(getScore(startRound(round))).toEqual({ correct: 0, total: 0 });
	});

	test("counts correct choices", () => {
		const s = {
			...startRound(round),
			playerChoices: [
				{ tokenIndex: 1, picked: "world", correct: "world" },
				{ tokenIndex: 3, picked: "earth", correct: "world" },
			],
		};
		expect(getScore(s)).toEqual({ correct: 1, total: 2 });
	});
});

describe("isWin", () => {
	test("false with no choices", () => {
		expect(isWin(startRound(round))).toBe(false);
	});

	test("true when majority correct", () => {
		const s = {
			...startRound(round),
			playerChoices: [
				{ tokenIndex: 1, picked: "world", correct: "world" },
				{ tokenIndex: 3, picked: "world", correct: "world" },
				{ tokenIndex: 5, picked: "earth", correct: "world" },
			],
		};
		expect(isWin(s)).toBe(true);
	});

	test("false when majority wrong", () => {
		const s = {
			...startRound(round),
			playerChoices: [
				{ tokenIndex: 1, picked: "earth", correct: "world" },
				{ tokenIndex: 3, picked: "earth", correct: "world" },
				{ tokenIndex: 5, picked: "world", correct: "world" },
			],
		};
		expect(isWin(s)).toBe(false);
	});
});

describe("getPlayerAnswer / getOriginalAnswer", () => {
	test("getPlayerAnswer joins revealed words with punctuation fix", () => {
		const s = { ...startRound(round), revealedWords: ["Hello", "world", "."] };
		expect(getPlayerAnswer(s)).toBe("Hello world.");
	});

	test("getOriginalAnswer uses correct tokens", () => {
		const s = startRound(round);
		expect(getOriginalAnswer(s)).toBe("Hello world.");
	});

	test("getOriginalAnswer returns empty for null round", () => {
		expect(getOriginalAnswer(createGame())).toBe("");
	});
});
