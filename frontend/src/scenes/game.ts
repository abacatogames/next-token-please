import type { RoundSource } from "../api.ts";
import { escapeAttr, escapeHTML, renderWords, shuffleOptions } from "../dom.ts";
import type { Scene } from "../scene/types.ts";
import type { GameState } from "../types.ts";

export type GameCallbacks = {
	onChoice: (word: string) => void;
	getRoundSource: () => RoundSource | null;
};

function sessionTag(id: string): string {
	const slug = id.replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase();
	return slug.length < 4 ? slug.padStart(4, "0") : slug;
}

export function renderGameHTML(
	state: GameState,
	shuffledOptions: string[] | null,
	source: RoundSource | null,
): string {
	if (!state.round) return "";

	const tag = sessionTag(state.round.id);

	const promptHTML = `
    <div class="crt-window prompt-window">
      <header class="crt-title-bar">
        <span class="crt-dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="crt-session">PROMPT_${tag} // INPUT</span>
      </header>
      <div class="crt-body prompt-body">${escapeHTML(state.round.prompt)}</div>
    </div>
  `;

	const answerHTML = `
    <div class="crt-window answer-window">
      <header class="crt-title-bar">
        <span class="crt-dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="crt-session">MODEL_OUTPUT_${tag} // STREAM</span>
      </header>
      <div class="crt-body answer-body" id="answer" aria-live="polite">${renderWords(state)}</div>
    </div>
  `;

	let choiceHTML = "";
	if (state.phase === "awaiting_choice" && shuffledOptions) {
		const buttons = shuffledOptions
			.map(
				(w, i) =>
					`<button class="btn btn-choice" data-word="${escapeAttr(w)}" data-choice-index="${i}" aria-label="Choose ${escapeAttr(w)}">` +
					`<kbd class="btn-key" aria-hidden="true">${i + 1}</kbd>` +
					`<span class="btn-label">${escapeHTML(w)}</span>` +
					`</button>`,
			)
			.join("");

		choiceHTML = `
      <div class="choice-container" role="group" aria-label="Pick the next token">
        <p class="choice-prompt">&gt; pick_next_token()</p>
        <div class="choice-buttons">${buttons}</div>
      </div>
    `;
	}

	const fallbackHTML =
		source === "fallback"
			? `<div class="fallback-log" aria-hidden="true">&gt; FALLBACK: LOCAL_CACHE</div>`
			: "";

	return `
    <section class="screen game-screen">
      ${promptHTML}
      ${answerHTML}
      ${choiceHTML}
      ${fallbackHTML}
    </section>
  `;
}

export function createGameScene(cb: GameCallbacks): Scene<GameState> {
	let mountRoot: HTMLElement | null = null;
	let currentOptions: string[] | null = null;
	let keyHandler: ((e: KeyboardEvent) => void) | null = null;

	function render(state: GameState) {
		if (!mountRoot || !state.round) return;

		let options: string[] | null = null;
		if (state.phase === "awaiting_choice") {
			const token = state.round.tokens[state.tokenIndex]!;
			if (token.kind === "choice") {
				options = shuffleOptions(token);
			}
		}
		currentOptions = options;

		mountRoot.innerHTML = renderGameHTML(state, options, cb.getRoundSource());

		if (options) {
			mountRoot
				.querySelectorAll<HTMLButtonElement>(".btn-choice")
				.forEach((btn) => {
					btn.addEventListener("click", () => {
						cb.onChoice(btn.dataset.word!);
					});
				});
		}

		const answer = document.getElementById("answer");
		if (answer) answer.scrollTop = answer.scrollHeight;
	}

	return {
		id: "game",
		mount(root, state) {
			mountRoot = root;

			keyHandler = (e: KeyboardEvent) => {
				if (!currentOptions) return;
				const idx = Number(e.key) - 1;
				if (!Number.isInteger(idx) || idx < 0 || idx >= currentOptions.length) {
					return;
				}
				e.preventDefault();
				cb.onChoice(currentOptions[idx]!);
			};
			window.addEventListener("keydown", keyHandler);

			render(state);
		},
		update(state) {
			render(state);
		},
		unmount() {
			if (keyHandler) window.removeEventListener("keydown", keyHandler);
			keyHandler = null;
			currentOptions = null;
			mountRoot = null;
		},
	};
}
