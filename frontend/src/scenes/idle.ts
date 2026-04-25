import { TIMING } from "../constants.ts";
import { prefersReducedMotion } from "../motion.ts";
import type { Scene } from "../scene/types.ts";
import type { GameMode, GameState } from "../types.ts";

export type IdleCallbacks = {
	onModeSelect: (mode: GameMode) => void;
	onAbout: () => void;
};

type BootLine = { delay: number; text: string; status?: string };

const BOOT_LINES: BootLine[] = [
	{ delay: 80, text: "NTP-2087 // COLD BOOT" },
	{ delay: 240, text: "LOADING NEURAL LATTICE", status: "OK" },
	{ delay: 400, text: "DECRYPTING TOKEN STREAM", status: "OK" },
	{ delay: 600, text: "SYNC // MODEL HOST", status: "LINK" },
	{ delay: 820, text: "OPERATOR HANDSHAKE", status: "AWAIT" },
];

function stamp(ms: number): string {
	return `[0.${String(ms).padStart(3, "0")}]`;
}

function renderBootRow(line: BootLine): HTMLElement {
	const row = document.createElement("div");
	row.className = "boot-line";
	const time = `<span class="boot-time">${stamp(line.delay)}</span>`;
	const text = `<span class="boot-text">${line.text}</span>`;
	if (line.status) {
		const dots = `<span class="boot-dots">${"·".repeat(40)}</span>`;
		const status = `<span class="boot-status boot-status--${line.status.toLowerCase()}">${line.status}</span>`;
		row.innerHTML = `${time}${text}${dots}${status}`;
	} else {
		row.innerHTML = `${time}${text}`;
	}
	return row;
}

export function createIdleScene(cb: IdleCallbacks): Scene<GameState> {
	let cleanup: (() => void) | null = null;

	return {
		id: "idle",
		mount(root) {
			root.innerHTML = `
    <section class="screen idle-screen" aria-labelledby="idle-title">
      <div class="boot" id="boot" aria-hidden="true"></div>

      <header class="idle-header" data-visible="false">
        <h1 id="idle-title" class="title">Next Token Please</h1>
        <p class="subtitle">You are the language model now.<br>Predict what comes next.</p>
      </header>

      <details class="about">
        <summary>How does it work?</summary>
        <p>
          One prompt. One answer. The model writes in real time, token by token — until the 
		  signal breaks and control is handed to you. Three candidates appear. Choose the 
		  correct token and clear the threshold to survive.
        </p>
      </details>

      <div class="mode-select" role="group" aria-label="Choose a game mode">
        <button class="btn btn-mode btn-mode--primary" id="mode-campaign-btn" type="button" data-mode="campaign">
          <kbd class="btn-key" aria-hidden="true">1</kbd>
          <span class="btn-mode-text">
            <span class="btn-mode-title">INFERENCE_RUN</span>
            <span class="btn-mode-sub">5 chapters · escalating thresholds</span>
          </span>
          <span class="btn-caret" aria-hidden="true">&gt;</span>
        </button>
        <button class="btn btn-mode btn-mode--secondary" id="mode-endless-btn" type="button" data-mode="endless">
          <kbd class="btn-key" aria-hidden="true">2</kbd>
          <span class="btn-mode-text">
            <span class="btn-mode-title">ENDLESS_MODE</span>
            <span class="btn-mode-sub">single round · &gt;50% to pass</span>
          </span>
          <span class="btn-caret" aria-hidden="true">&gt;</span>
        </button>
      </div>

      <footer class="idle-stamp">
        <button class="idle-about-link" id="idle-about-btn" type="button">ABOUT</button>
        <span aria-hidden="true">NTP.v2087 // OPERATOR_MODE // DIAGNOSTIC_OK</span>
      </footer>
    </section>
  `;

			const boot = document.getElementById("boot")!;
			const header = root.querySelector<HTMLElement>(".idle-header")!;
			const campaignBtn = document.getElementById(
				"mode-campaign-btn",
			) as HTMLButtonElement;
			const endlessBtn = document.getElementById(
				"mode-endless-btn",
			) as HTMLButtonElement;
			const aboutBtn = document.getElementById(
				"idle-about-btn",
			) as HTMLButtonElement;

			const reducedMotion = prefersReducedMotion();
			const timers: number[] = [];

			for (const line of BOOT_LINES) {
				timers.push(
					window.setTimeout(
						() => boot.appendChild(renderBootRow(line)),
						reducedMotion ? 0 : line.delay,
					),
				);
			}

			timers.push(
				window.setTimeout(
					() => {
						header.dataset.visible = "true";
						campaignBtn.focus({ preventScroll: true });
					},
					reducedMotion ? 0 : TIMING.IDLE_HEADER_REVEAL_MS,
				),
			);

			const onCampaign = () => cb.onModeSelect("campaign");
			const onEndless = () => cb.onModeSelect("endless");
			const onAbout = () => cb.onAbout();
			campaignBtn.addEventListener("click", onCampaign);
			endlessBtn.addEventListener("click", onEndless);
			aboutBtn.addEventListener("click", onAbout);

			const onKey = (e: KeyboardEvent) => {
				const target = e.target as HTMLElement | null;
				const tag = target?.tagName;
				if (tag === "SUMMARY") return;

				if (e.key === "1") {
					e.preventDefault();
					cb.onModeSelect("campaign");
					return;
				}
				if (e.key === "2") {
					e.preventDefault();
					cb.onModeSelect("endless");
					return;
				}
				if (e.key === "Enter" && tag !== "BUTTON") {
					e.preventDefault();
					cb.onModeSelect("campaign");
				}
			};
			window.addEventListener("keydown", onKey);

			cleanup = () => {
				campaignBtn.removeEventListener("click", onCampaign);
				endlessBtn.removeEventListener("click", onEndless);
				aboutBtn.removeEventListener("click", onAbout);
				window.removeEventListener("keydown", onKey);
				for (const t of timers) window.clearTimeout(t);
			};
		},
		unmount() {
			cleanup?.();
			cleanup = null;
		},
	};
}
