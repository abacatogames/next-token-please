import { escapeAttr, escapeHTML, renderWords, shuffleOptions } from "../dom.ts";
import type { Scene } from "../scene/types.ts";
import type { GameState } from "../types.ts";

export type GameCallbacks = {
	onChoice: (word: string) => void;
};

export function createGameScene(cb: GameCallbacks): Scene<GameState> {
	let mountRoot: HTMLElement | null = null;

	function render(state: GameState) {
		if (!mountRoot || !state.round) return;

		const promptHTML = `<div class="prompt">${escapeHTML(state.round.prompt)}</div>`;
		const wordsHTML = `<div class="answer" id="answer">${renderWords(state)}</div>`;

		let choiceHTML = "";
		if (state.phase === "awaiting_choice") {
			const token = state.round.tokens[state.tokenIndex]!;
			if (token.kind === "choice") {
				const options = shuffleOptions(token);
				choiceHTML = `
        <div class="choice-container">
          <p class="choice-prompt">Pick the next token:</p>
          <div class="choice-buttons">
            ${options.map((w) => `<button class="btn btn-choice" data-word="${escapeAttr(w)}">${escapeHTML(w)}</button>`).join("")}
          </div>
        </div>
      `;
			}
		}

		mountRoot.innerHTML = `
    <div class="screen game-screen">
      ${promptHTML}
      ${wordsHTML}
      ${choiceHTML}
    </div>
  `;

		if (state.phase === "awaiting_choice") {
			mountRoot.querySelectorAll<HTMLButtonElement>(".btn-choice").forEach((btn) => {
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
			render(state);
		},
		update(state) {
			render(state);
		},
		unmount() {
			mountRoot = null;
		},
	};
}
