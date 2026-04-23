import { crtWindow, highlightDiffs } from "../dom.ts";
import { getScore } from "../game.ts";
import type { Scene } from "../scene/types.ts";
import {
	FINAL_CHAPTER_INDEX,
	INFERENCE_RUN,
	getChapter,
} from "../story/inferenceRun.ts";
import type { GameState } from "../types.ts";

export type CampaignCallbacks = {
	onContinueRound: () => void;
	onNextChapter: () => void;
	onExit: () => void;
};

function pct(correct: number, total: number): number {
	return total > 0 ? Math.round((correct / total) * 100) : 0;
}

function renderComparison(state: GameState): string {
	if (!state.round) return "";
	const operatorCol = crtWindow({
		windowClass: "comparison-col",
		bodyClass: "comparison-text",
		title: "OPERATOR_OUTPUT",
		body: highlightDiffs(state, (c) => c.picked),
	});
	const truthCol = crtWindow({
		windowClass: "comparison-col",
		bodyClass: "comparison-text",
		title: "MODEL_GROUND_TRUTH",
		body: highlightDiffs(state, (c) => c.correct),
	});
	return `
    <div class="comparison">
      ${operatorCol}
      ${truthCol}
    </div>
  `;
}

function renderChapterIntro(state: GameState): string {
	const chapter = getChapter(state.campaign?.chapterIndex ?? -1);
	if (!chapter) return "";
	const isFinal = chapter.index === FINAL_CHAPTER_INDEX;
	const flavor = isFinal
		? "Singularity protocol engaged. One wrong token and the entire run collapses."
		: chapter.index === 0
			? "Run initiated. Learn the pattern and clear at least half the sequence to advance."
			: "System pressure rising. Maintain accuracy across all rounds to continue.";

	const windowHTML = crtWindow({
		windowClass: "campaign-window",
		bodyClass: "campaign-body",
		title: `INFERENCE_RUN // CHAPTER ${chapter.index + 1} / ${INFERENCE_RUN.length}`,
		body: `
          <h2 id="campaign-title" class="campaign-title">${chapter.title}</h2>
          <p class="campaign-flavor">${flavor}</p>
          <dl class="campaign-stats">
            <div><dt>Rounds</dt><dd>${chapter.rounds}</dd></div>
            <div><dt>Target</dt><dd>${chapter.requiredPercent}%</dd></div>
            <div><dt>Scoring</dt><dd>POOLED</dd></div>
          </dl>
        `,
	});
	return `
    <section class="screen campaign-screen campaign-intro" aria-labelledby="campaign-title">
      ${windowHTML}
      <button class="btn btn-start campaign-primary" id="campaign-primary-btn" type="button">
        <span class="btn-caret">&gt;</span>
        <span class="btn-label">BEGIN_CHAPTER</span>
      </button>
      <p class="keyhints" aria-hidden="true"><kbd>Enter</kbd> start</p>
    </section>
  `;
}

function renderRoundRecap(state: GameState): string {
	const chapter = getChapter(state.campaign?.chapterIndex ?? -1);
	if (!chapter || !state.campaign) return "";
	const roundScore = getScore(state);
	const roundPct = pct(roundScore.correct, roundScore.total);
	const pooledCorrect = state.campaign.chapterCorrect;
	const pooledTotal = state.campaign.chapterTotal;
	const pooledPct = pct(pooledCorrect, pooledTotal);
	const passing = pooledCorrect * 100 >= chapter.requiredPercent * pooledTotal;
	const status = passing ? "ON PACE" : "BELOW TARGET";
	const statusClass = passing ? "is-pass" : "is-fail";
	const isLastRound = state.campaign.roundInChapter >= chapter.rounds;
	const primaryLabel = isLastRound ? "CHAPTER_RESULTS" : "CONTINUE";
	const hintText = isLastRound ? "see results" : "next round";

	const windowHTML = crtWindow({
		windowClass: "campaign-window",
		bodyClass: "campaign-body",
		title: `${chapter.title.toUpperCase()} // ROUND ${state.campaign.roundInChapter} / ${chapter.rounds}`,
		body: `
          <h2 id="recap-title" class="campaign-title campaign-title--sm">ROUND ${state.campaign.roundInChapter}</h2>
          <div class="recap-score">
            <span class="recap-score-value">${roundPct}%</span>
            <span class="recap-score-sub">${roundScore.correct} / ${roundScore.total} this round</span>
          </div>
          <div class="recap-pool">
            <div class="recap-pool-row">
              <span class="recap-label">Chapter total</span>
              <span class="recap-value">${pooledCorrect}/${pooledTotal} · ${pooledPct}%</span>
            </div>
            <div class="recap-pool-row">
              <span class="recap-label">Target</span>
              <span class="recap-value recap-target ${statusClass}">${chapter.requiredPercent}% — ${status}</span>
            </div>
          </div>
        `,
	});
	return `
    <section class="screen campaign-screen campaign-recap" aria-labelledby="recap-title">
      ${windowHTML}
      ${renderComparison(state)}
      <div class="btn-row">
        <button class="btn btn-start campaign-primary" id="campaign-primary-btn" type="button">
          <span class="btn-caret">&gt;</span>
          <span class="btn-label">${primaryLabel}</span>
        </button>
        <button class="btn btn-secondary" id="campaign-exit-btn" type="button">
          <span class="btn-label">EXIT</span>
        </button>
      </div>
      <p class="keyhints" aria-hidden="true"><kbd>Enter</kbd> ${hintText}  //  <kbd>Esc</kbd> exit</p>
    </section>
  `;
}

function renderChapterPassed(state: GameState): string {
	const chapter = getChapter(state.campaign?.chapterIndex ?? -1);
	if (!chapter || !state.campaign) return "";
	const finalPct = pct(
		state.campaign.chapterCorrect,
		state.campaign.chapterTotal,
	);
	const windowHTML = crtWindow({
		windowClass: "campaign-window",
		bodyClass: "campaign-body",
		title: `CHAPTER_${chapter.index + 1} // COMPLETE`,
		body: `
          <h2 id="end-title" class="campaign-headline is-pass">CHAPTER ${chapter.index + 1} COMPLETE</h2>
          <div class="campaign-final-score">
            <span class="campaign-final-value">${finalPct}%</span>
            <span class="campaign-final-sub">${state.campaign.chapterCorrect} / ${state.campaign.chapterTotal} — cleared ${chapter.requiredPercent}% target</span>
          </div>
          <p class="campaign-flavor">Loading next chapter…</p>
        `,
	});
	return `
    <section class="screen campaign-screen campaign-end campaign-end--passed" aria-labelledby="end-title">
      ${windowHTML}
      <div class="btn-row">
        <button class="btn btn-start campaign-primary" id="campaign-primary-btn" type="button">
          <span class="btn-caret">&gt;</span>
          <span class="btn-label">NEXT_CHAPTER</span>
        </button>
        <button class="btn btn-secondary" id="campaign-exit-btn" type="button">
          <span class="btn-label">EXIT</span>
        </button>
      </div>
      <p class="keyhints" aria-hidden="true"><kbd>Enter</kbd> continue  //  <kbd>Esc</kbd> exit</p>
    </section>
  `;
}

function renderFailedShell(
	chapterIndex: number,
	scoreValue: string,
	subline: string,
	flavor: string,
	comparisonHTML: string,
): string {
	const windowHTML = crtWindow({
		windowClass: "campaign-window",
		bodyClass: "campaign-body",
		title: `RUN_TERMINATED // CHAPTER_${chapterIndex + 1}`,
		body: `
          <h2 id="end-title" class="campaign-headline is-fail">RUN TERMINATED</h2>
          <div class="campaign-final-score">
            <span class="campaign-final-value">${scoreValue}</span>
            <span class="campaign-final-sub">${subline}</span>
          </div>
          <p class="campaign-flavor">${flavor}</p>
        `,
	});
	return `
    <section class="screen campaign-screen campaign-end campaign-end--failed" aria-labelledby="end-title">
      ${windowHTML}
      ${comparisonHTML}
      <button class="btn btn-start campaign-primary" id="campaign-primary-btn" type="button">
        <span class="btn-caret">&gt;</span>
        <span class="btn-label">BACK_TO_START</span>
      </button>
      <p class="keyhints" aria-hidden="true"><kbd>Enter</kbd> exit</p>
    </section>
  `;
}

function renderChapterFailed(state: GameState): string {
	const chapter = getChapter(state.campaign?.chapterIndex ?? -1);
	if (!chapter || !state.campaign) return "";
	const comparisonHTML = chapter.index === FINAL_CHAPTER_INDEX ? renderComparison(state) : ""
	const finalPct = pct(
		state.campaign.chapterCorrect,
		state.campaign.chapterTotal,
	);
	const subline = `${state.campaign.chapterCorrect} / ${state.campaign.chapterTotal} — fell short of ${chapter.requiredPercent}% target`;
	const flavor = "Restart from Chapter 1 to try again.";
	return renderFailedShell(
		chapter.index,
		`${finalPct}%`,
		subline,
		flavor,
		comparisonHTML,
	);
}

function renderCampaignWon(state: GameState): string {
	if (!state.campaign) return "";
	const finalPct = pct(
		state.campaign.chapterCorrect,
		state.campaign.chapterTotal,
	);
	const windowHTML = crtWindow({
		windowClass: "campaign-window",
		bodyClass: "campaign-body",
		title: "INFERENCE_COMPLETE // RUN_CLEAR",
		body: `
          <h2 id="end-title" class="campaign-headline is-won">INFERENCE COMPLETE</h2>
          <div class="campaign-final-score">
            <span class="campaign-final-value">${finalPct}%</span>
            <span class="campaign-final-sub">final chapter cleared at 100%</span>
          </div>
          <p class="campaign-flavor">All five chapters cleared. The model approves.</p>
        `,
	});
	return `
    <section class="screen campaign-screen campaign-end campaign-end--won" aria-labelledby="end-title">
      ${windowHTML}
      <button class="btn btn-start campaign-primary" id="campaign-primary-btn" type="button">
        <span class="btn-caret">&gt;</span>
        <span class="btn-label">RETURN</span>
      </button>
      <p class="keyhints" aria-hidden="true"><kbd>Enter</kbd> return</p>
    </section>
  `;
}

function renderCampaignHTML(state: GameState): string {
	switch (state.phase) {
		case "chapter_intro":
			return renderChapterIntro(state);
		case "round_recap":
			return renderRoundRecap(state);
		case "chapter_passed":
			return renderChapterPassed(state);
		case "chapter_failed":
			return renderChapterFailed(state);
		case "campaign_won":
			return renderCampaignWon(state);
		default:
			return "";
	}
}

function primaryActionFor(
	state: GameState,
	cb: CampaignCallbacks,
): (() => void) | null {
	switch (state.phase) {
		case "chapter_intro":
		case "round_recap":
			return cb.onContinueRound;
		case "chapter_passed":
			return cb.onNextChapter;
		case "chapter_failed":
		case "campaign_won":
			return cb.onExit;
		default:
			return null;
	}
}

export function createCampaignScene(cb: CampaignCallbacks): Scene<GameState> {
	let mountRoot: HTMLElement | null = null;
	let keyHandler: ((e: KeyboardEvent) => void) | null = null;
	let currentAction: (() => void) | null = null;
	let exitAction: (() => void) | null = null;

	function render(state: GameState) {
		if (!mountRoot) return;
		mountRoot.innerHTML = renderCampaignHTML(state);
		currentAction = primaryActionFor(state, cb);
		const btn = mountRoot.querySelector<HTMLButtonElement>(
			"#campaign-primary-btn",
		);
		if (btn && currentAction) {
			btn.addEventListener("click", currentAction);
			btn.focus({ preventScroll: true });
		}
		const exitBtn = mountRoot.querySelector<HTMLButtonElement>(
			"#campaign-exit-btn",
		);
		if (exitBtn) {
			exitBtn.addEventListener("click", cb.onExit);
			exitAction = cb.onExit;
		} else {
			exitAction = null;
		}
	}

	return {
		id: "campaign",
		mount(root, state) {
			mountRoot = root;
			keyHandler = (e: KeyboardEvent) => {
				if (e.key === "Escape") {
					if (!exitAction) return;
					e.preventDefault();
					exitAction();
					return;
				}
				if (e.key !== "Enter" && e.key !== " ") return;
				const tag = (e.target as HTMLElement | null)?.tagName;
				if (tag === "BUTTON") return;
				if (!currentAction) return;
				e.preventDefault();
				currentAction();
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
			currentAction = null;
			exitAction = null;
			mountRoot = null;
		},
	};
}
