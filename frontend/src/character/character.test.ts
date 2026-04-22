import { describe, expect, test } from "bun:test";
import { ACTIVE_ROUND_PHASES, isActiveRoundPhase } from "./phases.ts";
import { robotSvg } from "./robot.svg.ts";
import type { GamePhase } from "../types.ts";

describe("isActiveRoundPhase", () => {
	test("returns true for active round phases", () => {
		expect(isActiveRoundPhase("typing_prompt")).toBe(true);
		expect(isActiveRoundPhase("revealing")).toBe(true);
		expect(isActiveRoundPhase("awaiting_choice")).toBe(true);
	});

	test("returns false for non-round phases", () => {
		const nonRound: GamePhase[] = [
			"idle",
			"finished",
			"chapter_intro",
			"round_recap",
			"chapter_passed",
			"chapter_failed",
			"campaign_won",
		];
		for (const phase of nonRound) {
			expect(isActiveRoundPhase(phase)).toBe(false);
		}
	});

	test("exposes exactly three active phases", () => {
		expect(ACTIVE_ROUND_PHASES.size).toBe(3);
	});
});

describe("robotSvg", () => {
	test("is a valid svg root with crisp rendering", () => {
		expect(robotSvg.startsWith("<svg")).toBe(true);
		expect(robotSvg).toContain('shape-rendering="crispEdges"');
		expect(robotSvg).toContain('viewBox="0 0 24 24"');
	});

	test("includes named hooks for future personality skinning", () => {
		expect(robotSvg).toContain('class="robot__eye robot__eye--left"');
		expect(robotSvg).toContain('class="robot__eye robot__eye--right"');
		expect(robotSvg).toContain('class="robot__mouth"');
		expect(robotSvg).toContain('class="robot__antenna"');
	});
});
