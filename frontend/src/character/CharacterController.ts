import type { GamePhase } from "../types.ts";

/**
 * Reserved seam for future persistent LLM character.
 *
 * Mount target: `#character-stage` (persists across scene swaps).
 * Not wired to the runtime yet — scene transitions do not invoke these hooks.
 */
export interface CharacterController {
	mount(stage: HTMLElement): void;
	unmount(): void;
	onPhaseChange(phase: GamePhase): void;
	onSceneEnter(sceneId: string): void;
}
