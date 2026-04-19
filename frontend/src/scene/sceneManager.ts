import type { Scene } from "./types.ts";

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

	update(state: S): void {
		this.current?.update?.(state);
	}

	get activeId(): string | null {
		return this.current?.id ?? null;
	}
}
