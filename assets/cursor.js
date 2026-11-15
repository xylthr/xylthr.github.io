/* Custom cursor for mouse devices: a square dot plus a diamond that trails it and opens up over links.
   Touch screens and pen devices keep their normal behavior. */
(() => {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mk = c => { const d = document.createElement('div'); d.className = c; d.setAttribute('aria-hidden', 'true'); document.body.append(d); return d; };
  const dot = mk('cur-dot'), ring = mk('cur-ring');
  document.documentElement.classList.add('cc');
  let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y, shown = false;
  const HOT = 'a, button, label, .card, [role=button]';

  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    x = e.clientX; y = e.clientY;
    if (!shown) { shown = true; rx = x; ry = y; document.body.classList.add('cur-on'); }
    dot.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;
  });
  addEventListener('pointerover', e => {
    const t = e.target.closest ? e.target : e.target.parentElement;
    document.body.classList.toggle('cur-text', !!t.closest('input, textarea'));   // text fields keep the normal caret
    ring.classList.toggle('hot', !!t.closest(HOT));
  });
  addEventListener('pointerdown', () => ring.classList.add('down'));
  addEventListener('pointerup', () => ring.classList.remove('down'));
  document.documentElement.addEventListener('mouseleave', () => document.body.classList.remove('cur-on'));
  document.documentElement.addEventListener('mouseenter', () => shown && document.body.classList.add('cur-on'));

  (function loop() {
    rx += (x - rx) * (still ? 1 : .18); ry += (y - ry) * (still ? 1 : .18);
    ring.style.transform = `translate3d(${rx}px,${ry}px,0)`;
    requestAnimationFrame(loop);
  })();
})();
