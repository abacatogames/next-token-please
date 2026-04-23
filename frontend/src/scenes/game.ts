import type { RoundSource } from "../api.ts";
import {
	crtWindow,
	escapeAttr,
	escapeHTML,
	renderWords,
	shuffleOptions,
} from "../dom.ts";
import type { Scene } from "../scene/types.ts";
import { INFERENCE_RUN, getChapter } from "../story/inferenceRun.ts";
import type { GameState } from "../types.ts";

export type GameCallbacks = {
	onChoice: (word: string) => void;
	onPromptTyped: () => void;
	getRoundSource: () => RoundSource | null;
};

const TYPE_DELAY_MIN = 22;
const TYPE_DELAY_MAX = 55;
const TYPE_PUNC_PAUSE = 140;

function sessionTag(id: string): string {
	const slug = id.replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase();
	return slug.length < 4 ? slug.padStart(4, "0") : slug;
}

function prefersReducedMotion(): boolean {
	return (
		typeof window !== "undefined" &&
		typeof window.matchMedia === "function" &&
		window.matchMedia("(prefers-reduced-motion: reduce)").matches
	);
}

function renderHUD(state: GameState): string {
	if (state.mode !== "campaign" || !state.campaign) return "";
	const chapter = getChapter(state.campaign.chapterIndex);
	if (!chapter) return "";
	const roundInChapter = state.campaign.roundInChapter + 1;
	return `
    <div class="campaign-hud" role="status" aria-live="polite">
      <span class="campaign-hud-tag">INFERENCE_RUN</span>
      <span class="campaign-hud-sep">·</span>
      <span class="campaign-hud-chapter">CH ${chapter.index + 1}/${INFERENCE_RUN.length}</span>
      <span class="campaign-hud-sep">·</span>
      <span class="campaign-hud-round">ROUND ${roundInChapter}/${chapter.rounds}</span>
      <span class="campaign-hud-sep">·</span>
      <span class="campaign-hud-target">TARGET ${chapter.requiredPercent}%</span>
    </div>
  `;
}

export function renderGameHTML(
	state: GameState,
	shuffledOptions: string[] | null,
	source: RoundSource | null,
): string {
	if (!state.round) return "";

	const tag = sessionTag(state.round.id);
	const isTyping = state.phase === "typing_prompt";

	const hudHTML = renderHUD(state);

	const promptBody = isTyping
		? `<span class="prompt-text"></span><span class="prompt-caret" aria-hidden="true"></span>`
		: escapeHTML(state.round.prompt);

	const promptHTML = crtWindow({
		windowClass: "prompt-window",
		bodyClass: "prompt-body",
		title: `PROMPT_${tag} // INPUT`,
		body: promptBody,
	});

	const answerBody = isTyping ? "" : renderWords(state);

	const answerHTML = crtWindow({
		windowClass: "answer-window",
		bodyClass: "answer-body",
		bodyAttrs: `id="answer" aria-live="polite"`,
		title: `MODEL_OUTPUT_${tag} // STREAM`,
		body: answerBody,
	});

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

	const keyHint =
		state.phase === "awaiting_choice"
			? `<p class="keyhints" aria-hidden="true"><kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> pick token</p>`
			: "";

	return `
    <section class="screen game-screen" aria-label="Language model round">
      ${hudHTML}
      ${promptHTML}
      ${answerHTML}
      ${choiceHTML}
      ${keyHint}
      ${fallbackHTML}
    </section>
  `;
}

export function createGameScene(cb: GameCallbacks): Scene<GameState> {
	let mountRoot: HTMLElement | null = null;
	let currentOptions: string[] | null = null;
	let keyHandler: ((e: KeyboardEvent) => void) | null = null;
	let typingTimer: ReturnType<typeof setTimeout> | null = null;
	let typingRoundId: string | null = null;

	function stopTyping() {
		if (typingTimer) clearTimeout(typingTimer);
		typingTimer = null;
	}

	function startPromptTyping(prompt: string, roundId: string) {
		if (typingRoundId === roundId) return;
		typingRoundId = roundId;
		stopTyping();

		const target = mountRoot?.querySelector<HTMLElement>(".prompt-text");
		const caret = mountRoot?.querySelector<HTMLElement>(".prompt-caret");
		if (!target) return;

		if (prefersReducedMotion()) {
			target.textContent = prompt;
			caret?.remove();
			queueMicrotask(() => cb.onPromptTyped());
			return;
		}

		let i = 0;

		const tick = () => {
			if (i >= prompt.length) {
				caret?.remove();
				typingTimer = null;
				cb.onPromptTyped();
				return;
			}
			const ch = prompt[i]!;
			target.textContent = (target.textContent ?? "") + ch;
			i++;

			const isPunc = /[.,;:!?—]/.test(ch);
			const jitter =
				TYPE_DELAY_MIN + Math.random() * (TYPE_DELAY_MAX - TYPE_DELAY_MIN);
			const delay = isPunc ? jitter + TYPE_PUNC_PAUSE : jitter;

			typingTimer = setTimeout(tick, delay);
		};

		typingTimer = setTimeout(tick, TYPE_DELAY_MIN);
	}

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

		if (state.phase === "typing_prompt") {
			startPromptTyping(state.round.prompt, state.round.id);
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
			stopTyping();
			typingRoundId = null;
			mountRoot = null;
		},
	};
}
