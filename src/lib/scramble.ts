const GLYPHS = '!<>-_/[]{}=+*^?#%01ABCDEFXYZ';
const running = new WeakMap<Node, number>();
const originals = new WeakMap<Node, string>();

/**
 * Decode effect: each character flickers through glyphs and settles left to right.
 * Works on the element's own text nodes, so React keeps the nodes it rendered.
 */
export function scramble(el: Element, duration = 450): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text);

  for (const node of nodes) {
    const prev = running.get(node);
    if (prev) cancelAnimationFrame(prev);
    const original = originals.get(node) ?? node.nodeValue ?? '';
    originals.set(node, original);
    const start = performance.now();

    const tick = (now: number): void => {
      const p = Math.min(1, (now - start) / duration);
      const settled = Math.floor(p * original.length);
      let out = original.slice(0, settled);
      for (let i = settled; i < original.length; i++) {
        const ch = original[i];
        out += ch === ' ' || ch === '·' ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      node.nodeValue = out;
      if (p < 1) running.set(node, requestAnimationFrame(tick));
      else {
        node.nodeValue = original;
        running.delete(node);
      }
    };
    running.set(node, requestAnimationFrame(tick));
  }
}

/** Scramble every kicker in a beat the moment that beat comes on screen. */
export function watchBeatScramble(root: Element): () => void {
  const obs = new MutationObserver((records) => {
    for (const r of records) {
      const el = r.target as HTMLElement;
      if (el.dataset.beatPhase === 'active' && r.oldValue !== 'active') {
        el.querySelectorAll('.cinema-kicker').forEach((k) => scramble(k));
      }
    }
  });
  obs.observe(root, {
    subtree: true,
    attributes: true,
    attributeFilter: ['data-beat-phase'],
    attributeOldValue: true,
  });
  return () => obs.disconnect();
}
