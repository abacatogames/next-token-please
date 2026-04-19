export type TransitionVia = "default" | "chapter";

export type SceneTransition = (
	root: HTMLElement,
	direction: "out" | "in",
) => Promise<void> | void;

const registry = new Map<TransitionVia, SceneTransition>();

export function registerTransition(
	via: TransitionVia,
	transition: SceneTransition,
): void {
	registry.set(via, transition);
}

export function getTransition(via: TransitionVia): SceneTransition | null {
	return registry.get(via) ?? null;
}

export function clearTransitions(): void {
	registry.clear();
}
