import { getTransition, type TransitionVia } from "./transitions.ts";
import type { Scene } from "./types.ts";

export type TransitionOptions = {
	via?: TransitionVia;
};

export class SceneManager<S> {
	private scenes = new Map<string, Scene<S>>();
	private current: Scene<S> | null = null;

	constructor(private readonly root: HTMLElement) {}

	register(scene: Scene<S>): void {
		this.scenes.set(scene.id, scene);
	}

	goto(id: string, state: S): void {
		const next = this.scenes.get(id);
		if (!next) throw new Error(`Unknown scene: ${id}`);

		if (this.current?.id === id) {
			next.update?.(state);
			return;
		}

		this.current?.unmount?.();
		this.current = next;
		next.mount(this.root, state);
	}

	async transitionTo(
		id: string,
		state: S,
		opts: TransitionOptions = {},
	): Promise<void> {
		const next = this.scenes.get(id);
		if (!next) throw new Error(`Unknown scene: ${id}`);

		if (this.current?.id === id) {
			next.update?.(state);
			return;
		}

		const transition = getTransition(opts.via ?? "default");

		if (transition && this.current) {
			await transition(this.root, "out");
		}

		this.current?.unmount?.();
		this.current = next;
		next.mount(this.root, state);

		if (transition) {
			await transition(this.root, "in");
		}
	}

	update(state: S): void {
		this.current?.update?.(state);
	}

	get activeId(): string | null {
		return this.current?.id ?? null;
	}
}
