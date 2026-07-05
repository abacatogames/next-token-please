import {
	type AudioPrefs,
	clampVolume,
	loadAudioPrefs,
	saveAudioPrefs,
} from "./storage.ts";

export type SfxName = "type" | "hover" | "correct" | "wrong";

/* Keeps the absolute output subtle even at volume=1. */
const MASTER_SCALE = 0.6;

const RAIN_GAIN = 0.1;
const THUNDER_MIN_DELAY_MS = 20_000;
const THUNDER_MAX_DELAY_MS = 45_000;

export const SFX_MIN_GAP_MS: Record<SfxName, number> = {
	type: 30,
	hover: 60,
	correct: 0,
	wrong: 0,
};

export function effectiveGain(prefs: AudioPrefs): number {
	return prefs.muted ? 0 : clampVolume(prefs.volume) * MASTER_SCALE;
}

export function isThrottled(
	lastAt: number,
	now: number,
	minGapMs: number,
): boolean {
	return now - lastAt < minGapMs;
}

function isSupported(): boolean {
	return typeof AudioContext !== "undefined";
}

let prefs: AudioPrefs | null = null;

function getPrefsInternal(): AudioPrefs {
	if (!prefs) prefs = loadAudioPrefs();
	return prefs;
}

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let ambienceGain: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

let rainSource: AudioBufferSourceNode | null = null;
let rainLfo: OscillatorNode | null = null;
let thunderTimer: ReturnType<typeof setTimeout> | null = null;
let muteSuspendTimer: ReturnType<typeof setTimeout> | null = null;

const lastPlayedAt: Record<SfxName, number> = {
	type: Number.NEGATIVE_INFINITY,
	hover: Number.NEGATIVE_INFINITY,
	correct: Number.NEGATIVE_INFINITY,
	wrong: Number.NEGATIVE_INFINITY,
};

function getNoiseBuffer(c: AudioContext): AudioBuffer {
	if (noiseBuffer) return noiseBuffer;
	const length = c.sampleRate * 2;
	noiseBuffer = c.createBuffer(1, length, c.sampleRate);
	const data = noiseBuffer.getChannelData(0);
	for (let i = 0; i < length; i++) {
		data[i] = Math.random() * 2 - 1;
	}
	return noiseBuffer;
}

function unlock(): void {
	if (ctx || !isSupported()) return;

	ctx = new AudioContext();
	masterGain = ctx.createGain();
	masterGain.gain.value = effectiveGain(getPrefsInternal());
	masterGain.connect(ctx.destination);

	sfxGain = ctx.createGain();
	sfxGain.connect(masterGain);

	ambienceGain = ctx.createGain();
	ambienceGain.connect(masterGain);

	document.addEventListener("visibilitychange", () => {
		if (!ctx) return;
		if (document.visibilityState === "hidden") {
			void ctx.suspend();
		} else if (!getPrefsInternal().muted) {
			void ctx.resume();
		}
	});

	void ctx.resume();
	if (!getPrefsInternal().muted) startAmbience();
}

function startRain(): void {
	if (!ctx || !ambienceGain || rainSource) return;

	const filter = ctx.createBiquadFilter();
	filter.type = "lowpass";
	filter.frequency.value = 550;
	filter.Q.value = 0.7;

	rainLfo = ctx.createOscillator();
	rainLfo.type = "sine";
	rainLfo.frequency.value = 0.07;
	const lfoDepth = ctx.createGain();
	lfoDepth.gain.value = 150;
	rainLfo.connect(lfoDepth);
	lfoDepth.connect(filter.frequency);

	const rainLevel = ctx.createGain();
	rainLevel.gain.value = 0;
	rainLevel.gain.setTargetAtTime(RAIN_GAIN, ctx.currentTime, 1.5);

	rainSource = ctx.createBufferSource();
	rainSource.buffer = getNoiseBuffer(ctx);
	rainSource.loop = true;
	rainSource.connect(filter);
	filter.connect(rainLevel);
	rainLevel.connect(ambienceGain);

	rainSource.start();
	rainLfo.start();
}

function playThunder(): void {
	if (!ctx || !ambienceGain) return;

	const filter = ctx.createBiquadFilter();
	filter.type = "lowpass";
	filter.frequency.value = 60 + Math.random() * 60;

	const envelope = ctx.createGain();
	const now = ctx.currentTime;
	envelope.gain.setValueAtTime(0, now);
	envelope.gain.linearRampToValueAtTime(0.45, now + 0.3);
	envelope.gain.setTargetAtTime(0, now + 0.3, 3.5 / 3);

	const source = ctx.createBufferSource();
	source.buffer = getNoiseBuffer(ctx);
	source.connect(filter);
	filter.connect(envelope);
	envelope.connect(ambienceGain);

	source.start(now);
	source.stop(now + 6);
}

function scheduleThunder(): void {
	const delay =
		THUNDER_MIN_DELAY_MS +
		Math.random() * (THUNDER_MAX_DELAY_MS - THUNDER_MIN_DELAY_MS);
	thunderTimer = setTimeout(() => {
		playThunder();
		scheduleThunder();
	}, delay);
}

export function startAmbience(): void {
	if (!ctx) return;
	startRain();
	if (!thunderTimer) scheduleThunder();
}

export function stopAmbience(): void {
	if (thunderTimer) {
		clearTimeout(thunderTimer);
		thunderTimer = null;
	}
	rainSource?.stop();
	rainSource = null;
	rainLfo?.stop();
	rainLfo = null;
}

function playType(c: AudioContext, out: GainNode): void {
	const now = c.currentTime;

	const filter = c.createBiquadFilter();
	filter.type = "bandpass";
	filter.frequency.value = 1800 + Math.random() * 800;
	filter.Q.value = 2;

	const envelope = c.createGain();
	envelope.gain.setValueAtTime(0.08, now);
	envelope.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

	const source = c.createBufferSource();
	source.buffer = getNoiseBuffer(c);
	source.connect(filter);
	filter.connect(envelope);
	envelope.connect(out);

	source.start(now);
	source.stop(now + 0.04);
}

function playHover(c: AudioContext, out: GainNode): void {
	const now = c.currentTime;

	const osc = c.createOscillator();
	osc.type = "triangle";
	osc.frequency.value = 1200;

	const envelope = c.createGain();
	envelope.gain.setValueAtTime(0.03, now);
	envelope.gain.exponentialRampToValueAtTime(0.001, now + 0.01);

	osc.connect(envelope);
	envelope.connect(out);

	osc.start(now);
	osc.stop(now + 0.02);
}

function playCorrect(c: AudioContext, out: GainNode): void {
	const now = c.currentTime;

	/* Two quick soft notes rising a fifth — rewarding but understated. */
	const notes: Array<[number, number, number]> = [
		[660, now, 0.06],
		[880, now + 0.07, 0.1],
	];
	for (const [freq, start, dur] of notes) {
		const osc = c.createOscillator();
		osc.type = "triangle";
		osc.frequency.value = freq;

		const envelope = c.createGain();
		envelope.gain.setValueAtTime(0.1, start);
		envelope.gain.exponentialRampToValueAtTime(0.001, start + dur);

		osc.connect(envelope);
		envelope.connect(out);

		osc.start(start);
		osc.stop(start + dur + 0.01);
	}
}

function playWrong(c: AudioContext, out: GainNode): void {
	const now = c.currentTime;

	/* Descending buzz — two slightly detuned squares falling in pitch. */
	for (const detune of [0, 12]) {
		const osc = c.createOscillator();
		osc.type = "square";
		osc.detune.value = detune;
		osc.frequency.setValueAtTime(180, now);
		osc.frequency.exponentialRampToValueAtTime(85, now + 0.16);

		const envelope = c.createGain();
		envelope.gain.setValueAtTime(0.03, now);
		envelope.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

		osc.connect(envelope);
		envelope.connect(out);

		osc.start(now);
		osc.stop(now + 0.19);
	}
}

export const audio = {
	attachUnlock(): void {
		if (!isSupported()) return;
		const onGesture = () => {
			unlock();
			window.removeEventListener("pointerdown", onGesture);
			window.removeEventListener("keydown", onGesture);
		};
		window.addEventListener("pointerdown", onGesture);
		window.addEventListener("keydown", onGesture);
	},

	play(name: SfxName): void {
		if (!ctx || !sfxGain || getPrefsInternal().muted) return;

		const now = performance.now();
		if (isThrottled(lastPlayedAt[name], now, SFX_MIN_GAP_MS[name])) return;
		lastPlayedAt[name] = now;

		/* Safari can re-suspend the context on its own. */
		if (ctx.state === "suspended" && document.visibilityState === "visible") {
			void ctx.resume();
		}

		if (name === "type") playType(ctx, sfxGain);
		else if (name === "hover") playHover(ctx, sfxGain);
		else if (name === "correct") playCorrect(ctx, sfxGain);
		else playWrong(ctx, sfxGain);
	},

	startAmbience,
	stopAmbience,

	setVolume(v: number): void {
		const p = getPrefsInternal();
		p.volume = clampVolume(v);
		saveAudioPrefs(p);
		if (ctx && masterGain && !p.muted) {
			masterGain.gain.setTargetAtTime(effectiveGain(p), ctx.currentTime, 0.05);
		}
	},

	setMuted(muted: boolean): void {
		const p = getPrefsInternal();
		p.muted = muted;
		saveAudioPrefs(p);
		if (!ctx || !masterGain) return;

		if (muteSuspendTimer) {
			clearTimeout(muteSuspendTimer);
			muteSuspendTimer = null;
		}

		if (muted) {
			masterGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
			/* Let the ramp finish before suspending, then stop all CPU use. */
			muteSuspendTimer = setTimeout(() => {
				muteSuspendTimer = null;
				if (ctx && getPrefsInternal().muted) void ctx.suspend();
			}, 300);
		} else {
			void ctx.resume();
			masterGain.gain.setTargetAtTime(effectiveGain(p), ctx.currentTime, 0.05);
			startAmbience();
		}
	},

	getPrefs(): AudioPrefs {
		return { ...getPrefsInternal() };
	},
};
