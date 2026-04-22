import type { GamePhase } from "../types.ts";

export const ACTIVE_ROUND_PHASES: ReadonlySet<GamePhase> = new Set<GamePhase>([
	"typing_prompt",
	"revealing",
	"awaiting_choice",
]);

export function isActiveRoundPhase(phase: GamePhase): boolean {
	return ACTIVE_ROUND_PHASES.has(phase);
}
