import type { Scene } from "../scene/types.ts";
import type { GameState } from "../types.ts";

export type ErrorCallbacks = {
	onRetry: () => void;
	onReturnToIdle: () => void;
};

export function createErrorScene(cb: ErrorCallbacks): Scene<GameState> {
	let cleanup: (() => void) | null = null;

	return {
		id: "error",
		mount(root) {
			root.innerHTML = `
    <section class="screen error-screen" aria-labelledby="err-title" role="alert">
      <div class="crt-window">
        <header class="crt-title-bar">
          <span class="crt-dots" aria-hidden="true"><i></i><i></i><i></i></span>
          <span class="crt-session">SIGNAL_LOST // FAULT</span>
        </header>
        <div class="crt-body error-body">
          <h2 id="err-title" class="result-title lose">Channel unreachable.</h2>
          <p class="error-line">&gt; BACKEND_OFFLINE // CACHE_EXHAUSTED</p>
          <p class="error-line error-line--dim">&gt; RETRY_OR_RETURN_TO_STANDBY</p>
          <div class="error-actions">
            <button class="btn" id="err-retry" type="button">
              <span class="btn-caret">&gt;</span>
              <span class="btn-label">RETRY</span>
            </button>
            <button class="btn" id="err-exit" type="button">
              <span class="btn-caret">&gt;</span>
              <span class="btn-label">STANDBY</span>
            </button>
          </div>
        </div>
      </div>
      <p class="keyhints" aria-hidden="true">
        <kbd>Enter</kbd> retry  //  <kbd>Esc</kbd> exit
      </p>
    </section>
  `;

			const retryBtn = document.getElementById("err-retry") as HTMLButtonElement;
			const exitBtn = document.getElementById("err-exit") as HTMLButtonElement;
			retryBtn.addEventListener("click", cb.onRetry);
			exitBtn.addEventListener("click", cb.onReturnToIdle);
			retryBtn.focus({ preventScroll: true });

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
				cb.onRetry();
			};
			window.addEventListener("keydown", onKey);

			cleanup = () => {
				retryBtn.removeEventListener("click", cb.onRetry);
				exitBtn.removeEventListener("click", cb.onReturnToIdle);
				window.removeEventListener("keydown", onKey);
			};
		},
		unmount() {
			cleanup?.();
			cleanup = null;
		},
	};
}
