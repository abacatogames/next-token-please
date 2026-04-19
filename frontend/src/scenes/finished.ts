import { highlightDiffs } from "../dom.ts";
import { getScore, isWin } from "../game.ts";
import type { Scene } from "../scene/types.ts";
import type { GameState } from "../types.ts";

export type FinishedCallbacks = {
	onPlayAgain: () => void;
};

export function createFinishedScene(cb: FinishedCallbacks): Scene<GameState> {
	let cleanup: (() => void) | null = null;

	return {
		id: "finished",
		mount(root, state) {
			const { correct, total } = getScore(state);
			const won = isWin(state);
			const percent = total > 0 ? Math.round((correct / total) * 100) : 0;

			root.innerHTML = `
    <div class="screen finished-screen">
      <h2 class="result-title ${won ? "win" : "lose"}">${won ? "You passed!" : "Model rejected."}</h2>
      <div class="score">${correct} / ${total} correct (${percent}%)</div>
      <div class="comparison">
        <div class="comparison-col">
          <h3>Your answer</h3>
          <p class="comparison-text">${highlightDiffs(state, (c) => c.picked)}</p>
        </div>
        <div class="comparison-col">
          <h3>Original answer</h3>
          <p class="comparison-text">${highlightDiffs(state, (c) => c.correct)}</p>
        </div>
      </div>
      <button class="btn btn-start" id="play-again-btn">Play Again</button>
    </div>
  `;
			const btn = document.getElementById("play-again-btn")!;
			btn.addEventListener("click", cb.onPlayAgain);
			cleanup = () => btn.removeEventListener("click", cb.onPlayAgain);
		},
		unmount() {
			cleanup?.();
			cleanup = null;
		},
	};
}
