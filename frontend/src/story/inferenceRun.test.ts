import { describe, expect, test } from "bun:test";
import {
	FINAL_CHAPTER_INDEX,
	INFERENCE_RUN,
	getChapter,
} from "./inferenceRun.ts";

describe("INFERENCE_RUN", () => {
	test("has exactly 5 chapters", () => {
		expect(INFERENCE_RUN).toHaveLength(5);
	});

	test("chapter indices are 0..4 in order", () => {
		INFERENCE_RUN.forEach((c, i) => {
			expect(c.index).toBe(i);
		});
	});

	test("matches the spec (rounds + required %)", () => {
		const spec = [
			{ rounds: 3, requiredPercent: 50 },
			{ rounds: 3, requiredPercent: 60 },
			{ rounds: 3, requiredPercent: 75 },
			{ rounds: 2, requiredPercent: 90 },
			{ rounds: 1, requiredPercent: 100 },
		];
		INFERENCE_RUN.forEach((c, i) => {
			expect(c.rounds).toBe(spec[i]!.rounds);
			expect(c.requiredPercent).toBe(spec[i]!.requiredPercent);
		});
	});

	test("FINAL_CHAPTER_INDEX points at last chapter", () => {
		expect(FINAL_CHAPTER_INDEX).toBe(INFERENCE_RUN.length - 1);
	});
});

describe("getChapter", () => {
	test("returns chapter by index", () => {
		expect(getChapter(0)?.requiredPercent).toBe(50);
		expect(getChapter(4)?.requiredPercent).toBe(100);
	});

	test("returns null for out-of-range", () => {
		expect(getChapter(-1)).toBeNull();
		expect(getChapter(5)).toBeNull();
	});
});
