import { prefersReducedMotion } from "../motion.ts";

const RAIN_STREAK_COUNT = 70;

export function mountAtmosphere(root: HTMLElement): void {
	root.innerHTML = `
    <div class="atm-vignette"></div>
    <div class="atm-grain"></div>
    <div class="atm-rain" id="atm-rain"></div>
    <div class="atm-flicker"></div>
  `;

	if (prefersReducedMotion()) return;

	const rain = document.getElementById("atm-rain");
	if (!rain) return;

	const fragment = document.createDocumentFragment();
	for (let i = 0; i < RAIN_STREAK_COUNT; i++) {
		const streak = document.createElement("span");
		streak.className = "atm-streak";
		streak.style.left = `${Math.random() * 100}%`;
		streak.style.setProperty("--dur", `${0.45 + Math.random() * 0.55}s`);
		streak.style.setProperty("--delay", `${-Math.random() * 2}s`);
		streak.style.setProperty("--opacity", `${0.15 + Math.random() * 0.35}`);
		streak.style.setProperty("--length", `${60 + Math.random() * 60}px`);
		fragment.appendChild(streak);
	}
	rain.appendChild(fragment);
}
