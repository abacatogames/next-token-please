import type { Scene } from "../scene/types.ts";
import type { GameState } from "../types.ts";

export type IdleCallbacks = {
	onStart: () => void;
};

export function createIdleScene(cb: IdleCallbacks): Scene<GameState> {
	let cleanup: (() => void) | null = null;

	return {
		id: "idle",
		mount(root) {
			root.innerHTML = `
    <div class="screen idle-screen">
      <h1 class="title">Next Token Please</h1>
      <p class="subtitle">You are the language model now.<br>Pick the right next word.</p>
      <button class="btn btn-start" id="start-btn">Start</button>
    </div>
  `;
			const btn = document.getElementById("start-btn")!;
			btn.addEventListener("click", cb.onStart);
			cleanup = () => btn.removeEventListener("click", cb.onStart);
		},
		unmount() {
			cleanup?.();
			cleanup = null;
		},
	};
}
