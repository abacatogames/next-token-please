import { mockRounds } from "./data/mock-prompts.ts";
import type { Round } from "./types.ts";

const BASE = import.meta.env.VITE_API_URL;

let mockIndex = 0;

function nextMock(): Round {
	const r = mockRounds[mockIndex % mockRounds.length]!;
	mockIndex++;
	return r;
}

export async function fetchRound(difficulty = 0.5): Promise<Round> {
	if (!BASE) return nextMock();
	try {
		const response = await fetch(`${BASE}/round?difficulty=${difficulty}`);
		if (!response.ok) throw new Error(`round fetch failed: ${response.status}`);
		return (await response.json()) as Round;
	} catch (err) {
		console.warn("[api] backend unreachable, using mock round:", err);
		return nextMock();
	}
}
