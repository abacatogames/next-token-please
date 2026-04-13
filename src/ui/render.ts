import type { GameState, Token } from "../types.ts";
import { getScore, isWin, getPlayerAnswer, getOriginalAnswer } from "../game.ts";

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
  document.getElementById("start-btn")!.addEventListener("click", callbacks.onStart);
}

export function renderRevealing(state: GameState) {
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

  // Scroll answer to bottom
  const answerEl = document.getElementById("answer");
  if (answerEl) answerEl.scrollTop = answerEl.scrollHeight;
}

export function renderFinished(state: GameState) {
  const { correct, total } = getScore(state);
  const won = isWin(state);
  const playerAnswer = getPlayerAnswer(state);
  const originalAnswer = getOriginalAnswer(state);
  const percent = total > 0 ? Math.round((correct / total) * 100) : 0;

  app.innerHTML = `
    <div class="screen finished-screen">
      <h2 class="result-title ${won ? "win" : "lose"}">${won ? "You passed!" : "Model rejected."}</h2>
      <div class="score">${correct} / ${total} correct (${percent}%)</div>
      <div class="comparison">
        <div class="comparison-col">
          <h3>Your answer</h3>
          <p class="comparison-text">${highlightDiffs(state, "player")}</p>
        </div>
        <div class="comparison-col">
          <h3>Original answer</h3>
          <p class="comparison-text">${highlightDiffs(state, "original")}</p>
        </div>
      </div>
      <button class="btn btn-start" id="play-again-btn">Play Again</button>
    </div>
  `;
  document.getElementById("play-again-btn")!.addEventListener("click", callbacks.onPlayAgain);
}

function renderWords(state: GameState): string {
  return state.revealedWords
    .map((word, i) => {
      const isPunc = /^[.,;:!?—']$/.test(word);
      return `<span class="word${isPunc ? " punc" : ""}">${escapeHTML(word)}</span>`;
    })
    .join("");
}

function shuffleOptions(token: Extract<Token, { kind: "choice" }>): string[] {
  const options = [token.correct, ...token.distractors];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j]!, options[i]!];
  }
  return options;
}

function highlightDiffs(state: GameState, mode: "player" | "original"): string {
  if (!state.round) return "";

  const parts: string[] = [];
  let choiceIdx = 0;

  for (const token of state.round.tokens) {
    if (token.kind === "reveal") {
      const isPunc = /^[.,;:!?—']$/.test(token.word);
      parts.push(`<span class="word${isPunc ? " punc" : ""}">${escapeHTML(token.word)}</span>`);
    } else {
      const choice = state.playerChoices[choiceIdx];
      choiceIdx++;
      if (!choice) continue;

      const isCorrect = choice.picked === choice.correct;
      const word = mode === "player" ? choice.picked : choice.correct;
      const cssClass = isCorrect ? "word diff-correct" : "word diff-wrong";
      const isPunc = /^[.,;:!?—']$/.test(word);
      parts.push(`<span class="${cssClass}${isPunc ? " punc" : ""}">${escapeHTML(word)}</span>`);
    }
  }

  return parts.join("");
}

function escapeHTML(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return escapeHTML(s).replace(/"/g, "&quot;");
}
