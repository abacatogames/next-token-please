import { highlightDiffs } from "../dom.ts";
import { getScore, isWin } from "../game.ts";
import type { Scene } from "../scene/types.ts";
import {
	type BestRun,
	isNewBest,
	loadBestRun,
	saveBestRun,
} from "../storage.ts";
import type { GameState } from "../types.ts";

export type FinishedCallbacks = {
	onPlayAgain: () => void;
	onReturnToIdle: () => void;
};

function animateCountUp(
	el: HTMLElement,
	target: number,
	durationMs: number,
): () => void {
	const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	if (reduced) {
		el.textContent = `${target}%`;
		return () => {};
	}
	let rafId = 0;
	let cancelled = false;
	const start = performance.now();

	const tick = (now: number) => {
		if (cancelled) return;
		const p = Math.min(1, (now - start) / durationMs);
		const eased = 1 - (1 - p) ** 3;
		el.textContent = `${Math.round(eased * target)}%`;
		if (p < 1) rafId = requestAnimationFrame(tick);
	};
	rafId = requestAnimationFrame(tick);

	return () => {
		cancelled = true;
		cancelAnimationFrame(rafId);
	};
}

export function createFinishedScene(cb: FinishedCallbacks): Scene<GameState> {
	let cleanup: (() => void) | null = null;

	return {
		id: "finished",
		mount(root, state) {
			const { correct, total } = getScore(state);
			const won = isWin(state);
			const percent = total > 0 ? Math.round((correct / total) * 100) : 0;

			const current: BestRun = { percent, correct, total };
			const previous = loadBestRun();
			const newRecord = total > 0 && isNewBest(current, previous);
			if (newRecord) saveBestRun(current);

			const prevLine = previous
				? `<div class="eval-prev">PREV. BEST: ${previous.percent}% <span class="eval-prev-sub">(${previous.correct}/${previous.total})</span></div>`
				: "";
			const recordBadge = newRecord && previous
				? `<div class="eval-record">NEW RECORD</div>`
				: "";

			root.innerHTML = `
    <section class="screen finished-screen" aria-labelledby="eval-title">
      <div class="crt-window evaluation-window">
        <header class="crt-title-bar">
          <span class="crt-dots" aria-hidden="true"><i></i><i></i><i></i></span>
          <span class="crt-session">MODEL_EVALUATION // REPORT</span>
        </header>
        <div class="crt-body evaluation-body">
          <h2 id="eval-title" class="result-title ${won ? "win" : "lose"}">
            ${won ? "Model accepted." : "Model rejected."}
          </h2>
          <div class="eval-stats">
            <div class="eval-score">
              <span class="eval-score-value" id="eval-score-value">0%</span>
              <span class="eval-score-sub">${correct} / ${total} correct</span>
            </div>
            <div class="eval-meta">
              ${recordBadge}
              ${prevLine}
            </div>
          </div>
        </div>
      </div>

      <div class="comparison">
        <div class="crt-window comparison-col">
          <header class="crt-title-bar">
            <span class="crt-dots" aria-hidden="true"><i></i><i></i><i></i></span>
            <span class="crt-session">OPERATOR_OUTPUT</span>
          </header>
          <div class="crt-body comparison-text">${highlightDiffs(state, (c) => c.picked)}</div>
        </div>
        <div class="crt-window comparison-col">
          <header class="crt-title-bar">
            <span class="crt-dots" aria-hidden="true"><i></i><i></i><i></i></span>
            <span class="crt-session">MODEL_GROUND_TRUTH</span>
          </header>
          <div class="crt-body comparison-text">${highlightDiffs(state, (c) => c.correct)}</div>
        </div>
      </div>

      <div class="btn-row">
        <button class="btn btn-start" id="play-again-btn" type="button">
          <span class="btn-caret">&gt;</span>
          <span class="btn-label">REPLAY_SEQUENCE</span>
        </button>
        <button class="btn btn-secondary" id="return-home-btn" type="button">
          <span class="btn-label">RETURN_HOME</span>
        </button>
      </div>

      <p class="keyhints" aria-hidden="true">
        <kbd>Enter</kbd> replay  //  <kbd>Esc</kbd> exit
      </p>
    </section>
  `;

			const btn = document.getElementById("play-again-btn") as HTMLButtonElement;
			btn.addEventListener("click", cb.onPlayAgain);
			btn.focus({ preventScroll: true });

			const homeBtn = document.getElementById(
				"return-home-btn",
			) as HTMLButtonElement;
			homeBtn.addEventListener("click", cb.onReturnToIdle);

			const scoreEl = document.getElementById("eval-score-value")!;
			const cancelCount = animateCountUp(scoreEl, percent, 720);

			const onKey = (e: KeyboardEvent) => {
				if (e.key === "Escape") {
					e.preventDefault();
					cb.onReturnToIdle();
					return;
				}
				if (e.key !== "Enter") return;
				const tag = (e.target as HTMLElement | null)?.tagName;
				if (tag === "BUTTON") return;
				e.preventDefault();
				cb.onPlayAgain();
			};
			window.addEventListener("keydown", onKey);

			cleanup = () => {
				btn.removeEventListener("click", cb.onPlayAgain);
				homeBtn.removeEventListener("click", cb.onReturnToIdle);
				window.removeEventListener("keydown", onKey);
				cancelCount();
			};
		},
		unmount() {
			cleanup?.();
			cleanup = null;
		},
	};
}
