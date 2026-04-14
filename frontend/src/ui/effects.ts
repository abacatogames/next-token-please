export const REVEAL_DELAY_MIN = 80;
export const REVEAL_DELAY_MAX = 120;

export function randomRevealDelay(): number {
	return (
		REVEAL_DELAY_MIN + Math.random() * (REVEAL_DELAY_MAX - REVEAL_DELAY_MIN)
	);
}
