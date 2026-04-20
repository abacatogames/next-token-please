import { describe, expect, test } from "bun:test";
import {
	advanceToNextChapter,
	chapterProgress,
	commitRoundToChapter,
	createGame,
	finalizeChapterFromRecap,
	isChapterComplete,
	startCampaign,
} from "./game.ts";
import type { GameState, PlayerChoice } from "./types.ts";

function finishedRound(
	state: GameState,
	correct: number,
	wrong: number,
): GameState {
	const choices: PlayerChoice[] = [
		...Array.from({ length: correct }, (_, i) => ({
			tokenIndex: i,
			picked: "X",
			correct: "X",
		})),
		...Array.from({ length: wrong }, (_, i) => ({
			tokenIndex: correct + i,
			picked: "X",
			correct: "Y",
		})),
	];
	return { ...state, phase: "finished", playerChoices: choices };
}

describe("startCampaign", () => {
	test("initializes Chapter 1 with zeroed aggregates", () => {
		const s = startCampaign();
		expect(s.phase).toBe("chapter_intro");
		expect(s.mode).toBe("campaign");
		expect(s.campaign).toEqual({
			chapterIndex: 0,
			roundInChapter: 0,
			chapterCorrect: 0,
			chapterTotal: 0,
		});
		expect(s.round).toBeNull();
		expect(s.playerChoices).toEqual([]);
	});
});

describe("commitRoundToChapter", () => {
	test("no-op outside finished phase", () => {
		const s = startCampaign();
		expect(commitRoundToChapter(s)).toBe(s);
	});

	test("no-op in endless mode", () => {
		const s = { ...createGame(), phase: "finished" as const };
		expect(commitRoundToChapter(s)).toBe(s);
	});

	test("mid-chapter → round_recap, aggregates update", () => {
		const s = finishedRound(startCampaign(), 4, 2);
		const next = commitRoundToChapter(s);
		expect(next.phase).toBe("round_recap");
		expect(next.campaign).toEqual({
			chapterIndex: 0,
			roundInChapter: 1,
			chapterCorrect: 4,
			chapterTotal: 6,
		});
	});

	test("last round always transitions to round_recap, not chapter end", () => {
		let s = startCampaign();
		s = commitRoundToChapter(finishedRound(s, 1, 0));
		s = commitRoundToChapter(finishedRound(s, 1, 0));
		s = commitRoundToChapter(finishedRound(s, 0, 1));
		expect(s.phase).toBe("round_recap");
		expect(s.campaign?.roundInChapter).toBe(3);
		expect(isChapterComplete(s)).toBe(true);
	});

	test("Ch1 final round: 2/3 pooled → recap → chapter_passed (≥50%)", () => {
		let s = startCampaign();
		s = commitRoundToChapter(finishedRound(s, 1, 0));
		s = commitRoundToChapter(finishedRound(s, 1, 0));
		s = commitRoundToChapter(finishedRound(s, 0, 1));
		s = finalizeChapterFromRecap(s);
		expect(s.phase).toBe("chapter_passed");
		expect(s.campaign?.chapterCorrect).toBe(2);
		expect(s.campaign?.chapterTotal).toBe(3);
	});

	test("Ch1 final round: 1/4 pooled → recap → chapter_failed", () => {
		let s = startCampaign();
		s = commitRoundToChapter(finishedRound(s, 1, 1));
		s = commitRoundToChapter(finishedRound(s, 0, 1));
		s = commitRoundToChapter(finishedRound(s, 0, 1));
		s = finalizeChapterFromRecap(s);
		expect(s.phase).toBe("chapter_failed");
	});

	test("Ch2 boundary: exactly 60% (3/5) passes (≥, not >)", () => {
		let s = startCampaign();
		s = commitRoundToChapter(finishedRound(s, 1, 0));
		s = commitRoundToChapter(finishedRound(s, 1, 0));
		s = commitRoundToChapter(finishedRound(s, 1, 0));
		s = finalizeChapterFromRecap(s);
		expect(s.phase).toBe("chapter_passed");
		s = advanceToNextChapter(s);
		expect(s.campaign?.chapterIndex).toBe(1);
		s = commitRoundToChapter(finishedRound(s, 1, 0));
		s = commitRoundToChapter(finishedRound(s, 0, 1));
		s = commitRoundToChapter(finishedRound(s, 1, 0));
		s = commitRoundToChapter(finishedRound(s, 0, 1));
		s = commitRoundToChapter(finishedRound(s, 1, 0));
		expect(s.campaign?.chapterCorrect).toBe(3);
		expect(s.campaign?.chapterTotal).toBe(5);
		s = finalizeChapterFromRecap(s);
		expect(s.phase).toBe("chapter_passed");
	});

	test("Ch2 just under: 59.9% (11/20) fails after finalize", () => {
		let s = { ...startCampaign() };
		s.campaign = {
			chapterIndex: 1,
			roundInChapter: 4,
			chapterCorrect: 9,
			chapterTotal: 16,
		};
		s = commitRoundToChapter(finishedRound(s, 2, 2));
		expect(s.phase).toBe("round_recap");
		expect(s.campaign?.chapterCorrect).toBe(11);
		expect(s.campaign?.chapterTotal).toBe(20);
		s = finalizeChapterFromRecap(s);
		expect(s.phase).toBe("chapter_failed");
	});

	test("pooled semantics (weighted by round size)", () => {
		let s = startCampaign();
		s = commitRoundToChapter(finishedRound(s, 4, 2));
		s = commitRoundToChapter(finishedRound(s, 1, 3));
		s = commitRoundToChapter(finishedRound(s, 0, 0));
		expect(s.campaign?.chapterCorrect).toBe(5);
		expect(s.campaign?.chapterTotal).toBe(10);
		s = finalizeChapterFromRecap(s);
		expect(s.phase).toBe("chapter_passed");
	});

	test("Ch5 last round at 100% → recap → campaign_won", () => {
		let s = { ...startCampaign() };
		s.campaign = {
			chapterIndex: 4,
			roundInChapter: 4,
			chapterCorrect: 20,
			chapterTotal: 20,
		};
		s = commitRoundToChapter(finishedRound(s, 4, 0));
		expect(s.phase).toBe("round_recap");
		s = finalizeChapterFromRecap(s);
		expect(s.phase).toBe("campaign_won");
	});

	test("Ch5 last round at 95% → recap → chapter_failed", () => {
		let s = { ...startCampaign() };
		s.campaign = {
			chapterIndex: 4,
			roundInChapter: 4,
			chapterCorrect: 19,
			chapterTotal: 20,
		};
		s = commitRoundToChapter(finishedRound(s, 0, 0));
		expect(s.phase).toBe("round_recap");
		s = finalizeChapterFromRecap(s);
		expect(s.phase).toBe("chapter_failed");
	});
});

describe("isChapterComplete", () => {
	test("false for endless mode", () => {
		expect(isChapterComplete(createGame())).toBe(false);
	});

	test("false before final round", () => {
		let s = startCampaign();
		s = commitRoundToChapter(finishedRound(s, 1, 0));
		expect(isChapterComplete(s)).toBe(false);
	});

	test("true once all rounds committed", () => {
		let s = startCampaign();
		s = commitRoundToChapter(finishedRound(s, 1, 0));
		s = commitRoundToChapter(finishedRound(s, 1, 0));
		s = commitRoundToChapter(finishedRound(s, 1, 0));
		expect(isChapterComplete(s)).toBe(true);
	});
});

describe("finalizeChapterFromRecap", () => {
	test("no-op outside round_recap phase", () => {
		const s = startCampaign();
		expect(finalizeChapterFromRecap(s)).toBe(s);
	});

	test("no-op when chapter still has rounds left", () => {
		let s = startCampaign();
		s = commitRoundToChapter(finishedRound(s, 1, 0));
		expect(s.phase).toBe("round_recap");
		expect(finalizeChapterFromRecap(s)).toBe(s);
	});
});

describe("advanceToNextChapter", () => {
	test("increments chapterIndex, resets aggregates, phase=chapter_intro", () => {
		let s = startCampaign();
		s = commitRoundToChapter(finishedRound(s, 3, 0));
		s = commitRoundToChapter(finishedRound(s, 3, 0));
		s = commitRoundToChapter(finishedRound(s, 3, 0));
		s = finalizeChapterFromRecap(s);
		expect(s.phase).toBe("chapter_passed");

		const next = advanceToNextChapter(s);
		expect(next.phase).toBe("chapter_intro");
		expect(next.campaign).toEqual({
			chapterIndex: 1,
			roundInChapter: 0,
			chapterCorrect: 0,
			chapterTotal: 0,
		});
		expect(next.playerChoices).toEqual([]);
		expect(next.revealedWords).toEqual([]);
		expect(next.round).toBeNull();
	});

	test("no-op when not in chapter_passed", () => {
		const s = startCampaign();
		expect(advanceToNextChapter(s)).toBe(s);
	});
});

describe("chapterProgress", () => {
	test("null for endless mode", () => {
		expect(chapterProgress(createGame())).toBeNull();
	});

	test("returns committed + in-progress aggregate", () => {
		let s = startCampaign();
		s = commitRoundToChapter(finishedRound(s, 2, 1));
		s.phase = "awaiting_choice";
		s.playerChoices = [{ tokenIndex: 0, picked: "A", correct: "A" }];

		const p = chapterProgress(s);
		expect(p).not.toBeNull();
		expect(p!.correctSoFar).toBe(3);
		expect(p!.totalSoFar).toBe(4);
		expect(p!.pct).toBe(75);
		expect(p!.passing).toBe(true);
		expect(p!.chapter.index).toBe(0);
	});

	test("passing=true when no choices made yet", () => {
		const s = startCampaign();
		const p = chapterProgress(s);
		expect(p?.totalSoFar).toBe(0);
		expect(p?.passing).toBe(true);
	});
});
