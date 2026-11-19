/**
 * Aayush's spoken greeting, scrubbed by the scroll like the film itself.
 *
 * The line is pinned to the footage: "Hey everyone" runs with the wave, "I am Aayush" lands as the
 * hero title holds, and "...with the username aayushifty" plays across the turn, where the handle
 * is on screen. The voice only moves while the film moves forward: scroll on and it speaks, stop
 * and it stops, scroll back and it waits. Each word is heard once; once the line has played to the
 * end it never plays again this visit (sessionStorage).
 *
 * Browsers only allow sound after one tap, click or key press; scrolling alone never counts.
 */
const SRC = '/audio/greeting.m4a?v=20261119s2';
const KEY = 'aayush-greeting-heard';
const AUDIO_END = 4.69;

/** [reel seconds, audio seconds] knots, from the word gaps in the recording */
const KNOTS: ReadonlyArray<readonly [number, number]> = [
  [0.1, 0], //          scroll starts the wave
  [0.9, 0.65], //       "Hey everyone"
  [1.0, 1.08],
  [1.7, 1.62], //       "I am Aayush" (hero title on screen)
  [1.95, 1.78], //      the turn: "Aayush Bhatta · @aayushifty" appears
  [4.6, AUDIO_END], //  "and I go online with the username aayushifty"
];
/** jumped well past the greeting while it was still talking: fade it out for good */
const CUT_OFF = 6.5;

const audioAt = (t: number): number => {
  if (t <= KNOTS[0][0]) return 0;
  for (let i = 1; i < KNOTS.length; i++) {
    const [t1, a1] = KNOTS[i];
    if (t <= t1) {
      const [t0, a0] = KNOTS[i - 1];
      return a0 + ((t - t0) / (t1 - t0)) * (a1 - a0);
    }
  }
  return AUDIO_END;
};

let audio: HTMLAudioElement | null = null;
let unlocked = false;
let lastT = 0;
let lastTarget = 0;
let lastMove = 0;
let raf = 0;
let done = (() => {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
})();

const finish = (): void => {
  done = true;
  cancelAnimationFrame(raf);
  raf = 0;
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
    audio.preservesPitch = true; // speeding up to keep pace with the scroll keeps his voice natural
    audio.addEventListener('ended', finish);
  }
  return audio;
};

const fadeOutAndStop = (el: HTMLAudioElement): void => {
  const from = el.volume;
  const t0 = performance.now();
  const step = (now: number): void => {
    const k = Math.min(1, (now - t0) / 300);
    el.volume = from * (1 - k);
    if (k < 1) requestAnimationFrame(step);
    else el.pause(); // iOS ignores volume: the pause is what stops it there
  };
  requestAnimationFrame(step);
};

/** Chase loop: the voice follows the frame on screen, never leads it. */
const chase = (): void => {
  raf = 0;
  if (done || !unlocked) return;
  const el = element();

  if (lastT > CUT_OFF) {
    if (!el.paused) fadeOutAndStop(el);
    finish();
    return;
  }
  if (el.currentTime >= AUDIO_END - 0.08 || el.ended) {
    finish();
    return;
  }

  const target = audioAt(lastT);
  const now = performance.now();
  if (target > lastTarget + 0.004) lastMove = now;
  lastTarget = target;
  const lag = target - el.currentTime;
  // once the film is past the line, the last word always plays out instead of being cut
  const stalled = target < AUDIO_END && now - lastMove > 140;
  if (el.paused) {
    if (lag > 0.06 && !stalled) {
      el.playbackRate = (target >= AUDIO_END ? 1 : Math.min(1.9, Math.max(0.8, lag * 3)));
      el.volume = 1;
      void el.play().catch(() => undefined);
    }
  } else if (stalled || lag < -0.12) {
    el.pause(); // the film stopped (or went back): so does the voice
  } else {
    // proportional catch-up: steady scrolling settles at natural speed with a short lag
    el.playbackRate = (target >= AUDIO_END ? 1 : Math.min(1.9, Math.max(0.8, lag * 3)));
  }
  raf = requestAnimationFrame(chase);
};

const wake = (): void => {
  if (!raf && !done && unlocked) raf = requestAnimationFrame(chase);
};

/** Called with the reel time of every painted frame. */
export function greetingTick(t: number): void {
  if (done) return;
  if (unlocked && !raf && t > KNOTS[0][0]) {
    // sound became allowed while already mid-greeting: start from where the film is
    const el = element();
    const at = audioAt(t);
    if (el.paused && el.currentTime < at - 0.6) el.currentTime = Math.max(0, at - 0.15);
  }
  lastT = t;
  wake();
}

/** Must run inside a tap/click/key handler: iOS only unlocks an element played inside a gesture. */
export function unlockGreeting(): void {
  if (done || unlocked) return;
  const el = element();
  el.muted = true;
  el.play()
    .then(() => {
      el.pause();
      el.currentTime = 0;
      el.muted = false;
      unlocked = true;
      wake();
    })
    .catch(() => {
      el.muted = false;
    });
}

if (typeof window !== 'undefined' && !done) {
  // the events browsers accept as permission for sound (pointerdown is not one of them on touch)
  for (const type of ['click', 'touchend', 'keydown'] as const) {
    window.addEventListener(type, unlockGreeting, { capture: true, passive: true });
  }
}
