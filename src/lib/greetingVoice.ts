/**
 * Aayush's spoken greeting. It starts once, the moment scrolling sets the opening wave in motion,
 * and never plays again for the rest of the visit (sessionStorage), even if the visitor scrolls back.
 *
 * Browsers only allow sound after the visitor has tapped, clicked or pressed a key once; scrolling
 * alone never counts. Without that, the greeting is simply skipped and the film runs silently.
 */
const SRC = '/audio/greeting.m4a?v=20261119s1';
const KEY = 'aayush-greeting-played';
/** reel seconds: the voice may only start while the wave is on screen */
const START_AT = 0.12;
const LAST_CHANCE = 2.2;
/** jumped far ahead (e.g. nav to Work) while it was still talking: fade it out */
const CUT_OFF = 9;

let audio: HTMLAudioElement | null = null;
let primed = false;
let started = false;
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

/** Call from a real tap/click/key handler: unlocks the element (iOS needs a play() inside a gesture). */
export function primeGreeting(): void {
  if (done || primed || started) return;
  primed = true;
  const el = element();
  el.muted = true;
  el.play()
    .then(() => {
      if (started) return; // the real start already took over
      el.pause();
      el.currentTime = 0;
      el.muted = false;
    })
    .catch(() => {
      el.muted = false;
    });
}

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
  if (done) return;
  if (started) {
    if (t > CUT_OFF && audio && !audio.paused) {
      fadeOut(audio);
      finish();
    }
    return;
  }
  if (t < START_AT) return;
  if (t > LAST_CHANCE) {
    finish(); // the moment has passed: it never plays later in the film
    return;
  }
  const active = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  if (!primed && !(active?.hasBeenActive ?? false)) return;
  const el = element();
  started = true;
  el.muted = false;
  el.volume = 1;
  el.currentTime = 0;
  el.play().catch(() => {
    started = false; // not allowed yet; may still start while the wave is on screen
  });
}

if (typeof window !== 'undefined' && !done) {
  const onGesture = (): void => {
    primeGreeting();
    window.removeEventListener('pointerdown', onGesture, true);
    window.removeEventListener('keydown', onGesture, true);
  };
  window.addEventListener('pointerdown', onGesture, { capture: true, passive: true });
  window.addEventListener('keydown', onGesture, { capture: true });
}
