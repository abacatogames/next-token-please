import { crtWindow } from "../dom.ts";
import type { Scene } from "../scene/types.ts";
import type { GameState } from "../types.ts";

export type AboutCallbacks = {
	onReturnToIdle: () => void;
};

const CONTACT_EMAIL = "contact@abacatogames.com";

export function createAboutScene(cb: AboutCallbacks): Scene<GameState> {
	let cleanup: (() => void) | null = null;

	return {
		id: "about",
		mount(root) {
			const windowHTML = crtWindow({
				windowClass: "about-window",
				bodyClass: "about-body",
				title: "ABOUT // NTP-2087",
				body: `
          <h2 id="about-title" class="about-heading">Next Token Please</h2>
          <p class="about-tagline">
            A browser game where you role-play as a language model, predicting the next
            token one word at a time.
          </p>

          <section class="about-section about-how" aria-labelledby="about-how-title">
            <h3 id="about-how-title" class="about-section-title">&gt; HOW IT WORKS</h3>
            <p>
              Each round starts with a question. A local language model, served
              through Ollama on the same machine that hosts the game, generates
              both the question and a short factual answer in plain prose.
            </p>
            <p>
              The Python backend orchestrates this: it prompts the model, picks
              which words in the answer become guesses, and builds each slot
              from the correct token plus two plausible distractors &mdash; drawn
              from synonyms, embedding-nearest neighbours, or general vocabulary.
              The browser frontend renders the round, captures your picks, and
              walks you through the answer one token at a time.
            </p>
          </section>

          <section class="about-section about-disclaimer" aria-labelledby="about-disclaimer-title">
            <h3 id="about-disclaimer-title" class="about-section-title">&gt; NOTICE</h3>
            <p>
              All prompts and answers in this game are AI-generated. They may be
              inaccurate, biased, unexpected, or nonsensical, and do not reflect 
              the views of the authors. Treat all output as fiction.
            </p>
          </section>

          <section class="about-section about-meta" aria-label="Credits and contact">
            <p class="about-github">
              Enjoying the game? Give it a star on
              <a class="about-link" href="https://github.com/abacatogames/next-token-please" target="_blank" rel="noopener noreferrer">GitHub</a>.
            </p>
            <p class="about-contact">
              <span class="about-list-key">&gt; CONTACT</span>
              <a class="about-link" href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>
            </p>
            <p class="about-copyright">&copy; Abacato Games</p>
          </section>

          <div class="about-actions">
            <button class="btn" id="about-back-btn" type="button">
              <span class="btn-caret">&gt;</span>
              <span class="btn-label">BACK</span>
            </button>
          </div>
        `,
			});

			root.innerHTML = `
    <section class="screen about-screen" aria-labelledby="about-title">
      ${windowHTML}
      <p class="keyhints" aria-hidden="true">
        <kbd>Esc</kbd> back
      </p>
    </section>
  `;

			const backBtn = document.getElementById(
				"about-back-btn",
			) as HTMLButtonElement;
			backBtn.addEventListener("click", cb.onReturnToIdle);
			backBtn.focus({ preventScroll: true });

			const onKey = (e: KeyboardEvent) => {
				if (e.key === "Escape") {
					e.preventDefault();
					cb.onReturnToIdle();
				}
			};
			window.addEventListener("keydown", onKey);

			cleanup = () => {
				backBtn.removeEventListener("click", cb.onReturnToIdle);
				window.removeEventListener("keydown", onKey);
			};
		},
		unmount() {
			cleanup?.();
			cleanup = null;
		},
	};
}
