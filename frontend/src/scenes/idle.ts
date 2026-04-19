import type { Scene } from "../scene/types.ts";
import type { GameState } from "../types.ts";

export type IdleCallbacks = {
	onStart: () => void;
};

type BootLine = { delay: number; text: string; status?: string };

const BOOT_LINES: BootLine[] = [
	{ delay: 80, text: "NTP-2087 // COLD BOOT" },
	{ delay: 240, text: "LOADING NEURAL LATTICE", status: "OK" },
	{ delay: 400, text: "DECRYPTING TOKEN STREAM", status: "OK" },
	{ delay: 600, text: "SYNC // MODEL HOST", status: "LINK" },
	{ delay: 820, text: "OPERATOR HANDSHAKE", status: "AWAIT" },
];

const HEADER_REVEAL_MS = 960;

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
    <section class="screen idle-screen" aria-labelledby="site-title">
      <div class="boot" id="boot" aria-hidden="true"></div>

      <header class="idle-header" data-visible="false">
        <p class="subtitle">You are the language model now.<br>Predict what comes next.</p>
      </header>

      <details class="about">
        <summary>How does it work?</summary>
        <p>
          One prompt. One answer. The model types it word by word — occasionally it
          pauses and hands you three candidates for the next token. Clear more than
          half and you pass. No feedback until the end.
        </p>
      </details>

      <button class="btn btn-start" id="start-btn" type="button">
        <span class="btn-caret">&gt;</span>
        <span class="btn-label">INITIATE_SEQUENCE</span>
      </button>

      <footer class="idle-stamp" aria-hidden="true">
        NTP.v2087 // OPERATOR_MODE // DIAGNOSTIC_OK
      </footer>
    </section>
  `;

			const boot = document.getElementById("boot")!;
			const header = root.querySelector<HTMLElement>(".idle-header")!;
			const btn = document.getElementById("start-btn") as HTMLButtonElement;

			const reducedMotion = window.matchMedia(
				"(prefers-reduced-motion: reduce)",
			).matches;
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
						btn.focus({ preventScroll: true });
					},
					reducedMotion ? 0 : HEADER_REVEAL_MS,
				),
			);

			btn.addEventListener("click", cb.onStart);

			const onKey = (e: KeyboardEvent) => {
				if (e.key !== "Enter") return;
				const target = e.target as HTMLElement | null;
				const tag = target?.tagName;
				if (tag === "SUMMARY" || tag === "BUTTON") return;
				e.preventDefault();
				cb.onStart();
			};
			window.addEventListener("keydown", onKey);

			cleanup = () => {
				btn.removeEventListener("click", cb.onStart);
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
