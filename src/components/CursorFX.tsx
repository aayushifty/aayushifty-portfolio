import React, { useEffect, useRef } from 'react';

const MAGNET = '.cinema-link-action, header nav button, header > div > button';

/** Desktop-only cursor: a dot that tracks exactly, a ring that trails and swells over links,
 *  and links that lean toward the pointer. Off for touch and reduced motion. */
export const CursorFX: React.FC = () => {
  const dotRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!fine.matches || calm.matches) return;
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    const root = document.documentElement;
    root.dataset.cursor = 'fx';
    let x = -100, y = -100, rx = -100, ry = -100, raf = 0;
    let magnet: HTMLElement | null = null;

    const loop = (): void => {
      rx += (x - rx) * 0.2;
      ry += (y - ry) * 0.2;
      dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      raf = Math.abs(x - rx) + Math.abs(y - ry) > 0.1 ? requestAnimationFrame(loop) : 0;
    };
    const kick = (): void => {
      if (!raf) raf = requestAnimationFrame(loop);
    };

    const release = (): void => {
      if (magnet) magnet.style.translate = '';
      magnet = null;
      ring.dataset.hover = '';
    };

    const onMove = (e: PointerEvent): void => {
      if (e.pointerType !== 'mouse') return;
      x = e.clientX;
      y = e.clientY;
      ring.dataset.on = 'true';
      const hit = (e.target as Element | null)?.closest<HTMLElement>(MAGNET) ?? null;
      if (hit !== magnet) {
        release();
        magnet = hit;
      }
      if (magnet) {
        const r = magnet.getBoundingClientRect();
        const dx = (x - (r.left + r.width / 2)) * 0.12;
        const dy = (y - (r.top + r.height / 2)) * 0.16;
        magnet.style.translate = `${dx.toFixed(1)}px ${dy.toFixed(1)}px`;
        ring.dataset.hover = 'true';
      }
      kick();
    };
    const onLeave = (): void => {
      ring.dataset.on = '';
      release();
    };
    const onDown = (): void => { ring.dataset.down = 'true'; };
    const onUp = (): void => { ring.dataset.down = ''; };

    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    return () => {
      cancelAnimationFrame(raf);
      release();
      delete root.dataset.cursor;
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);

  return (
    <>
      <div ref={ringRef} className="cursor-fx cursor-ring" aria-hidden="true" />
      <div ref={dotRef} className="cursor-fx cursor-dot" aria-hidden="true" />
    </>
  );
};
