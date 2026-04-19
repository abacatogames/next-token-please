import { mockRounds } from "./mock-rounds.ts";
import type { Round } from "./types.ts";

let mockIndex = 0;

function nextMock(): Round {
	const r = mockRounds[mockIndex % mockRounds.length]!;
	mockIndex++;
	return r;
}

export type RoundSource = "backend" | "fallback" | "local";

export type RoundResult = { round: Round; source: RoundSource };

export async function fetchRound(
	difficulty = 1.0,
	baseUrl: string | undefined = import.meta.env.VITE_API_URL,
): Promise<RoundResult> {
	if (!baseUrl) return { round: nextMock(), source: "local" };
	try {
		const response = await fetch(`${baseUrl}/round?difficulty=${difficulty}`);
		if (!response.ok) throw new Error(`round fetch failed: ${response.status}`);
		return { round: (await response.json()) as Round, source: "backend" };
	} catch (err) {
		console.warn("[api] backend unreachable, using mock round:", err);
		return { round: nextMock(), source: "fallback" };
	}
}
