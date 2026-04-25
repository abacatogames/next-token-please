import { mockRounds } from "./mock-rounds.ts";
import type { Round } from "./types.ts";

let mockIndex = 0;

function nextMock(): Round {
	const r = mockRounds[mockIndex % mockRounds.length]!;
	mockIndex++;
	return r;
}

export type RoundSource = "backend" | "fallback";

export type RoundResult = { round: Round; source: RoundSource };

function apiBase(): string {
	return import.meta.env.VITE_API_BASE_URL ?? "";
}

export async function fetchRound(difficulty = 1.0): Promise<RoundResult> {
	try {
		const response = await fetch(`${apiBase()}/api/round?difficulty=${difficulty}`);
		if (!response.ok) throw new Error(`round fetch failed: ${response.status}`);
		return { round: (await response.json()) as Round, source: "backend" };
	} catch (err) {
		console.warn("[api] backend unreachable, using mock round:", err);
		return { round: nextMock(), source: "fallback" };
	}
}
