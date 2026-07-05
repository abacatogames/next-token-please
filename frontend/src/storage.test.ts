import { beforeEach, describe, expect, test } from "bun:test";
import {
	clampVolume,
	clearSession,
	DEFAULT_AUDIO_PREFS,
	isNewBest,
	loadAudioPrefs,
	loadBestRun,
	loadSession,
	saveAudioPrefs,
	saveBestRun,
	saveSession,
	sessionToGameState,
} from "./storage.ts";
import type { GameState, Round } from "./types.ts";

class MemoryStorage implements Storage {
	private store = new Map<string, string>();
	get length() {
		return this.store.size;
	}
	clear() {
		this.store.clear();
	}
	getItem(k: string) {
		return this.store.get(k) ?? null;
	}
	setItem(k: string, v: string) {
		this.store.set(k, v);
	}
	removeItem(k: string) {
		this.store.delete(k);
	}
	key(i: number) {
		return Array.from(this.store.keys())[i] ?? null;
	}
}

beforeEach(() => {
	(globalThis as { localStorage: Storage }).localStorage = new MemoryStorage();
});

describe("loadBestRun / saveBestRun", () => {
	test("returns null when nothing stored", () => {
		expect(loadBestRun()).toBeNull();
	});

	test("round-trips a stored run", () => {
		saveBestRun({ percent: 80, correct: 4, total: 5 });
		expect(loadBestRun()).toEqual({ percent: 80, correct: 4, total: 5 });
	});

	test("returns null on malformed payload", () => {
		localStorage.setItem("ntp.bestRun", "not-json");
		expect(loadBestRun()).toBeNull();
	});

	test("returns null on shape mismatch", () => {
		localStorage.setItem("ntp.bestRun", JSON.stringify({ percent: "high" }));
		expect(loadBestRun()).toBeNull();
	});
});

describe("audio prefs", () => {
	test("returns defaults when nothing stored", () => {
		expect(loadAudioPrefs()).toEqual(DEFAULT_AUDIO_PREFS);
	});

	test("round-trips stored prefs", () => {
		saveAudioPrefs({ volume: 0.3, muted: true });
		expect(loadAudioPrefs()).toEqual({ volume: 0.3, muted: true });
	});

	test("returns defaults on malformed payload", () => {
		localStorage.setItem("ntp.audio.v1", "not-json");
		expect(loadAudioPrefs()).toEqual(DEFAULT_AUDIO_PREFS);
	});

	test("returns defaults on shape mismatch", () => {
		localStorage.setItem("ntp.audio.v1", JSON.stringify({ volume: "loud" }));
		expect(loadAudioPrefs()).toEqual(DEFAULT_AUDIO_PREFS);
	});

	test("clamps out-of-range stored volume", () => {
		localStorage.setItem(
			"ntp.audio.v1",
			JSON.stringify({ volume: 3.5, muted: false }),
		);
		expect(loadAudioPrefs().volume).toBe(1);
	});
});

describe("clampVolume", () => {
	test("clamps to [0, 1]", () => {
		expect(clampVolume(-0.5)).toBe(0);
		expect(clampVolume(0.42)).toBe(0.42);
		expect(clampVolume(2)).toBe(1);
	});

	test("falls back to default on non-finite input", () => {
		expect(clampVolume(Number.NaN)).toBe(DEFAULT_AUDIO_PREFS.volume);
		expect(clampVolume(Number.POSITIVE_INFINITY)).toBe(
			DEFAULT_AUDIO_PREFS.volume,
		);
	});
});

describe("isNewBest", () => {
	test("any score beats null previous", () => {
		expect(isNewBest({ percent: 0, correct: 0, total: 5 }, null)).toBe(true);
	});

	test("strictly greater percent wins", () => {
		expect(
			isNewBest(
				{ percent: 81, correct: 9, total: 11 },
				{ percent: 80, correct: 4, total: 5 },
			),
		).toBe(true);
	});

	test("equal percent is not new best", () => {
		expect(
			isNewBest(
				{ percent: 80, correct: 8, total: 10 },
				{ percent: 80, correct: 4, total: 5 },
			),
		).toBe(false);
	});

	test("lower percent is not new best", () => {
		expect(
			isNewBest(
				{ percent: 50, correct: 5, total: 10 },
				{ percent: 80, correct: 4, total: 5 },
			),
		).toBe(false);
	});
});

const SAMPLE_ROUND: Round = {
	id: "round-1",
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
	],
	personality: "cheerful",
};

function endlessMidRound(): GameState {
	return {
		phase: "awaiting_choice",
		mode: "endless",
		round: SAMPLE_ROUND,
		tokenIndex: 1,
		playerChoices: [],
		revealedWords: ["Hello"],
	};
}

function campaignMidChapter(): GameState {
	return {
		phase: "round_recap",
		mode: "campaign",
		round: SAMPLE_ROUND,
		tokenIndex: 3,
		playerChoices: [{ tokenIndex: 1, picked: "world", correct: "world" }],
		revealedWords: ["Hello", "world", "."],
		campaign: {
			chapterIndex: 1,
			roundInChapter: 2,
			chapterCorrect: 4,
			chapterTotal: 6,
		},
	};
}

describe("saveSession / loadSession", () => {
	test("returns null when nothing stored", () => {
		expect(loadSession()).toBeNull();
	});

	test("round-trips an endless mid-round session", () => {
		const state = endlessMidRound();
		saveSession(state);
		const loaded = loadSession();
		expect(loaded).not.toBeNull();
		expect(loaded?.mode).toBe("endless");
		expect(loaded?.phase).toBe("awaiting_choice");
		expect(loaded?.round).toEqual(SAMPLE_ROUND);
		expect(loaded?.tokenIndex).toBe(1);
		expect(loaded?.revealedWords).toEqual(["Hello"]);
		expect(loaded?.campaign).toBeUndefined();
	});

	test("round-trips a campaign mid-chapter session", () => {
		const state = campaignMidChapter();
		saveSession(state);
		const loaded = loadSession();
		expect(loaded?.mode).toBe("campaign");
		expect(loaded?.phase).toBe("round_recap");
		expect(loaded?.campaign).toEqual({
			chapterIndex: 1,
			roundInChapter: 2,
			chapterCorrect: 4,
			chapterTotal: 6,
		});
		expect(loaded?.playerChoices).toEqual([
			{ tokenIndex: 1, picked: "world", correct: "world" },
		]);
	});

	test("sessionToGameState strips metadata and drops optional campaign when absent", () => {
		saveSession(endlessMidRound());
		const loaded = loadSession();
		const state = sessionToGameState(loaded!);
		expect(state).toEqual(endlessMidRound());
	});

	test("sessionToGameState keeps campaign when present", () => {
		saveSession(campaignMidChapter());
		const loaded = loadSession();
		const state = sessionToGameState(loaded!);
		expect(state).toEqual(campaignMidChapter());
	});

	test("clearSession removes the key", () => {
		saveSession(endlessMidRound());
		clearSession();
		expect(loadSession()).toBeNull();
		expect(localStorage.getItem("ntp.session.v1")).toBeNull();
	});

	test("malformed JSON returns null and evicts the key", () => {
		localStorage.setItem("ntp.session.v1", "not-json");
		expect(loadSession()).toBeNull();
		expect(localStorage.getItem("ntp.session.v1")).toBeNull();
	});

	test("schema mismatch returns null", () => {
		localStorage.setItem(
			"ntp.session.v1",
			JSON.stringify({ ...endlessMidRound(), schemaVersion: 99, savedAt: 0 }),
		);
		expect(loadSession()).toBeNull();
		expect(localStorage.getItem("ntp.session.v1")).toBeNull();
	});

	test("invalid phase returns null", () => {
		const payload = {
			schemaVersion: 1,
			savedAt: 0,
			mode: "endless",
			phase: "not-a-phase",
			round: SAMPLE_ROUND,
			tokenIndex: 0,
			playerChoices: [],
			revealedWords: [],
		};
		localStorage.setItem("ntp.session.v1", JSON.stringify(payload));
		expect(loadSession()).toBeNull();
	});

	test("invalid mode returns null", () => {
		const payload = {
			schemaVersion: 1,
			savedAt: 0,
			mode: "zen",
			phase: "idle",
			round: null,
			tokenIndex: 0,
			playerChoices: [],
			revealedWords: [],
		};
		localStorage.setItem("ntp.session.v1", JSON.stringify(payload));
		expect(loadSession()).toBeNull();
	});

	test("campaign session without campaign field returns null", () => {
		const payload = {
			schemaVersion: 1,
			savedAt: 0,
			mode: "campaign",
			phase: "chapter_intro",
			round: null,
			tokenIndex: 0,
			playerChoices: [],
			revealedWords: [],
		};
		localStorage.setItem("ntp.session.v1", JSON.stringify(payload));
		expect(loadSession()).toBeNull();
	});

	test("endless session with campaign field returns null", () => {
		const payload = {
			schemaVersion: 1,
			savedAt: 0,
			mode: "endless",
			phase: "awaiting_choice",
			round: SAMPLE_ROUND,
			tokenIndex: 1,
			playerChoices: [],
			revealedWords: ["Hello"],
			campaign: {
				chapterIndex: 0,
				roundInChapter: 0,
				chapterCorrect: 0,
				chapterTotal: 0,
			},
		};
		localStorage.setItem("ntp.session.v1", JSON.stringify(payload));
		expect(loadSession()).toBeNull();
	});

	test("malformed token discriminator returns null", () => {
		const payload = {
			schemaVersion: 1,
			savedAt: 0,
			mode: "endless",
			phase: "typing_prompt",
			round: {
				id: "x",
				prompt: "p",
				tokens: [{ kind: "bogus", word: "hi" }],
			},
			tokenIndex: 0,
			playerChoices: [],
			revealedWords: [],
		};
		localStorage.setItem("ntp.session.v1", JSON.stringify(payload));
		expect(loadSession()).toBeNull();
	});

	test("choice token with wrong distractor arity returns null", () => {
		const payload = {
			schemaVersion: 1,
			savedAt: 0,
			mode: "endless",
			phase: "typing_prompt",
			round: {
				id: "x",
				prompt: "p",
				tokens: [
					{
						kind: "choice",
						correct: "a",
						distractors: ["b"],
						leading_space: false,
					},
				],
			},
			tokenIndex: 0,
			playerChoices: [],
			revealedWords: [],
		};
		localStorage.setItem("ntp.session.v1", JSON.stringify(payload));
		expect(loadSession()).toBeNull();
	});

	test("negative tokenIndex returns null", () => {
		const payload = {
			schemaVersion: 1,
			savedAt: 0,
			mode: "endless",
			phase: "typing_prompt",
			round: null,
			tokenIndex: -1,
			playerChoices: [],
			revealedWords: [],
		};
		localStorage.setItem("ntp.session.v1", JSON.stringify(payload));
		expect(loadSession()).toBeNull();
	});

	test("round with non-string personality returns null", () => {
		const payload = {
			schemaVersion: 1,
			savedAt: 0,
			mode: "endless",
			phase: "typing_prompt",
			round: { ...SAMPLE_ROUND, personality: 42 },
			tokenIndex: 0,
			playerChoices: [],
			revealedWords: [],
		};
		localStorage.setItem("ntp.session.v1", JSON.stringify(payload));
		expect(loadSession()).toBeNull();
	});

	test("unrecognized backend personality is preserved as a string", () => {
		const payload = {
			schemaVersion: 1,
			savedAt: 0,
			mode: "endless",
			phase: "typing_prompt",
			round: { ...SAMPLE_ROUND, personality: "deadpan" },
			tokenIndex: 0,
			playerChoices: [],
			revealedWords: [],
		};
		localStorage.setItem("ntp.session.v1", JSON.stringify(payload));
		const loaded = loadSession();
		expect(loaded).not.toBeNull();
		expect(loaded?.round?.personality).toBe("deadpan");
	});
});
