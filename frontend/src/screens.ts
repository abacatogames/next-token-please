import {
	escapeAttr,
	escapeHTML,
	highlightDiffs,
	renderWords,
	shuffleOptions,
} from "./dom.ts";
import { getScore, isWin } from "./game.ts";
import type { GameState } from "./types.ts";

const app = document.getElementById("app")!;

export type UICallbacks = {
	onStart: () => void;
	onChoice: (word: string) => void;
	onPlayAgain: () => void;
};

let callbacks: UICallbacks;

export function initUI(cbs: UICallbacks) {
	callbacks = cbs;
}

export function renderIdle() {
	app.innerHTML = `
    <div class="screen idle-screen">
      <h1 class="title">Next Token Please</h1>
      <p class="subtitle">You are the language model now.<br>Pick the right next word.</p>
      <button class="btn btn-start" id="start-btn">Start</button>
    </div>
  `;
	document
		.getElementById("start-btn")!
		.addEventListener("click", callbacks.onStart);
}

export function renderGame(state: GameState) {
	if (!state.round) return;

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

	app.innerHTML = `
    <div class="screen game-screen">
      ${promptHTML}
      ${wordsHTML}
      ${choiceHTML}
    </div>
  `;

	if (state.phase === "awaiting_choice") {
		app.querySelectorAll<HTMLButtonElement>(".btn-choice").forEach((btn) => {
			btn.addEventListener("click", () => {
				callbacks.onChoice(btn.dataset.word!);
			});
		});
	}

	document.getElementById("answer")!.scrollTop =
		document.getElementById("answer")!.scrollHeight;
}

export function renderFinished(state: GameState) {
	const { correct, total } = getScore(state);
	const won = isWin(state);
	const percent = total > 0 ? Math.round((correct / total) * 100) : 0;

	app.innerHTML = `
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
	document
		.getElementById("play-again-btn")!
		.addEventListener("click", callbacks.onPlayAgain);
}
