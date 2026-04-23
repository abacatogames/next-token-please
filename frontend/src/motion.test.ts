import { afterEach, describe, expect, test } from "bun:test";
import { prefersReducedMotion } from "./motion.ts";

type MatchMediaFn = (query: string) => { matches: boolean };

const g = globalThis as unknown as {
	window?: { matchMedia?: MatchMediaFn };
};

const originalWindow = g.window;

afterEach(() => {
	g.window = originalWindow;
});

function setMatchMedia(matches: boolean | null): void {
	if (matches === null) {
		g.window = { matchMedia: undefined };
		return;
	}
	g.window = { matchMedia: () => ({ matches }) };
}

describe("prefersReducedMotion", () => {
	test("returns true when the media query matches", () => {
		setMatchMedia(true);
		expect(prefersReducedMotion()).toBe(true);
	});

	test("returns false when the media query does not match", () => {
		setMatchMedia(false);
		expect(prefersReducedMotion()).toBe(false);
	});

	test("returns false when matchMedia is unavailable", () => {
		setMatchMedia(null);
		expect(prefersReducedMotion()).toBe(false);
	});
});
