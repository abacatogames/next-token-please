import { beforeEach, describe, expect, test } from "bun:test";
import { isNewBest, loadBestRun, saveBestRun } from "./storage.ts";

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
