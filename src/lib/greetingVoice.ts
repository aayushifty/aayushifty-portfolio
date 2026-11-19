/**
 * Aayush's spoken greeting. It starts once, the moment scrolling sets the opening wave in motion,
 * and never plays again for the rest of the visit (sessionStorage), even if the visitor scrolls back.
 *
 * Browsers only allow sound after the visitor has tapped, clicked or pressed a key once; scrolling
 * alone never counts. Without that, the greeting is simply skipped and the film runs silently.
 */
const SRC = '/audio/greeting.m4a?v=20261119s2';
const KEY = 'aayush-greeting-heard';
/** reel seconds: the voice may only start while the wave is on screen */
const START_AT = 0.12;
const LAST_CHANCE = 2.2;
/** jumped far ahead (e.g. nav to Work) while it was still talking: fade it out */
const CUT_OFF = 9;

let audio: HTMLAudioElement | null = null;
let unlocked = false;
let started = false;
/** reel time of the last painted frame */
let lastT = 0;
/** true only once the line has actually been heard; then it never plays again this visit */
let done = (() => {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
})();

const finish = (): void => {
  done = true;
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    /* private mode: once per page load is still honoured */
  }
};

const element = (): HTMLAudioElement => {
  if (!audio) {
    audio = new Audio(SRC);
    audio.preload = 'auto';
    audio.addEventListener('ended', finish, { once: true });
  }
  return audio;
};

const inWindow = (t: number): boolean => t >= START_AT && t <= LAST_CHANCE;

/** Start the line now. Must run inside a tap/click/key handler or after one has unlocked sound. */
const start = (): void => {
  if (done || started) return;
  const el = element();
  started = true;
  el.muted = false;
  el.volume = 1;
  el.currentTime = 0;
  el.play().catch(() => {
    started = false; // still not allowed; a later tap can start it
  });
};

/** The opening cue was tapped: play right away inside the tap (iOS refuses sound started later). */
export function playGreetingNow(): void {
  unlocked = true;
  start();
}

/** Any tap/click/key unlocks sound. iOS needs a play() inside that gesture, so the element is
 *  primed silently; if the wave is already on screen, the line simply starts now instead. */
const onGesture = (): void => {
  if (done || started) return;
  if (inWindow(lastT)) {
    playGreetingNow();
    return;
  }
  if (unlocked) return;
  unlocked = true;
  const el = element();
  el.muted = true;
  el.play()
    .then(() => {
      if (started) return;
      el.pause();
      el.currentTime = 0;
      el.muted = false;
    })
    .catch(() => {
      el.muted = false;
      unlocked = false;
    });
};

const fadeOut = (el: HTMLAudioElement): void => {
  const from = el.volume;
  const t0 = performance.now();
  const step = (now: number): void => {
    const k = Math.min(1, (now - t0) / 350);
    el.volume = from * (1 - k);
    if (k < 1 && el.volume > 0.01) requestAnimationFrame(step);
    else el.pause(); // iOS ignores volume, so this is where it actually stops there
  };
  requestAnimationFrame(step);
};

/** Called with the reel time of every painted frame. */
export function greetingTick(t: number): void {
  lastT = t;
  if (done) return;
  if (started) {
    if (t > CUT_OFF && audio && !audio.paused) {
      fadeOut(audio);
      finish();
    }
    return;
  }
  if (!inWindow(t)) return; // not heard yet: it waits for the next pass through the wave
  const active = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  if (unlocked || active?.hasBeenActive) start();
}

if (typeof window !== 'undefined' && !done) {
  // the events browsers accept as permission for sound (pointerdown is not one of them on touch)
  for (const type of ['click', 'touchend', 'keydown'] as const) {
    window.addEventListener(type, onGesture, { capture: true, passive: true });
  }
}
