import { audio } from "../audio.ts";

export function mountAudioControl(root: HTMLElement): void {
	const prefs = audio.getPrefs();

	const wrap = document.createElement("div");
	wrap.className = "audio-control";
	wrap.innerHTML = `
		<button type="button" class="audio-toggle" aria-pressed="${!prefs.muted}">
			${prefs.muted ? "SND:OFF" : "SND:ON"}
		</button>
		<input
			type="range"
			class="audio-volume"
			min="0"
			max="100"
			step="5"
			value="${Math.round(prefs.volume * 100)}"
			aria-label="Volume"
		/>
	`;

	const toggle = wrap.querySelector<HTMLButtonElement>(".audio-toggle")!;
	const slider = wrap.querySelector<HTMLInputElement>(".audio-volume")!;

	const syncToggle = () => {
		const muted = audio.getPrefs().muted;
		toggle.textContent = muted ? "SND:OFF" : "SND:ON";
		toggle.setAttribute("aria-pressed", String(!muted));
	};

	toggle.addEventListener("click", () => {
		audio.setMuted(!audio.getPrefs().muted);
		syncToggle();
	});

	slider.addEventListener("input", () => {
		audio.setVolume(Number(slider.value) / 100);
		if (audio.getPrefs().muted) {
			audio.setMuted(false);
			syncToggle();
		}
	});

	root.appendChild(wrap);
}
