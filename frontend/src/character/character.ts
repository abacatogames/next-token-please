import type { Personality } from "../types.ts";
import { robotSvg } from "./robot.svg.ts";

export type CharacterHandle = {
	setVisible(visible: boolean): void;
	setPersonality(personality: Personality): void;
	destroy(): void;
};

export function mountCharacter(root: HTMLElement): CharacterHandle {
	const wrapper = document.createElement("div");
	wrapper.className = "character character--hidden";
	wrapper.dataset.personality = "neutral";
	wrapper.setAttribute("aria-hidden", "true");
	wrapper.innerHTML = robotSvg;
	root.appendChild(wrapper);

	return {
		setVisible(visible: boolean) {
			wrapper.classList.toggle("character--hidden", !visible);
		},
		setPersonality(personality: Personality) {
			wrapper.dataset.personality = personality;
		},
		destroy() {
			wrapper.remove();
		},
	};
}
