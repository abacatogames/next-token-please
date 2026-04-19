import type { Scene } from "../scene/types.ts";
import type { GameState } from "../types.ts";

export function createLoadingScene(): Scene<GameState> {
	return {
		id: "loading",
		mount(root) {
			root.innerHTML = `
    <section class="screen loading-screen" aria-busy="true" aria-live="polite">
      <div class="crt-window">
        <header class="crt-title-bar">
          <span class="crt-dots"><i></i><i></i><i></i></span>
          <span class="crt-session">CHANNEL_SYNC // DECODING</span>
        </header>
        <div class="crt-body loading-body">
          <p class="loading-label">&gt; DECODING_TOKEN_STREAM</p>
          <div class="loading-dots" aria-hidden="true">
            <span class="loading-dot"></span>
            <span class="loading-dot"></span>
            <span class="loading-dot"></span>
          </div>
        </div>
      </div>
    </section>
  `;
		},
	};
}
