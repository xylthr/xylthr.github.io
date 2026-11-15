/* Hologram: a rotating 3D wireframe above a projector base, drawn on a 2D canvas (no libraries).
   Moves with the mouse, glitches and changes shape when clicked. Also drives the foil sheen on cards. */
(() => {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- Foil sheen on cards and link plates follows the pointer ---- */
  addEventListener('pointermove', e => {
    const c = e.target.closest && e.target.closest('.card, .plate'); if (!c) return;
    const r = c.getBoundingClientRect();
    c.style.setProperty('--hx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
    c.style.setProperty('--hy', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
  });

  const hero = document.querySelector('.hero'); if (!hero) return;

  /* ---- Shapes: { v: [[x,y,z]...], e: [[i,j]...], dots } ---- */
  const near = (v, d) => { const e = []; for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) if (Math.hypot(v[i][0] - v[j][0], v[i][1] - v[j][1], v[i][2] - v[j][2]) < d) e.push([i, j]); return e; };
  const unit = v => { const m = Math.max(...v.map(p => Math.hypot(...p))); return v.map(p => p.map(c => c / m)); };
  const T = (1 + Math.sqrt(5)) / 2;
  const ico = unit([[-1,T,0],[1,T,0],[-1,-T,0],[1,-T,0],[0,-1,T],[0,1,T],[0,-1,-T],[0,1,-T],[T,0,-1],[T,0,1],[-T,0,-1],[-T,0,1]]);
  const cube = []; for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) cube.push([x, y, z]);
  const tess = unit(cube.concat(cube.map(p => p.map(c => c * .5)))); const tessE = near(tess.slice(0, 8), 1.2).concat(near(tess.slice(8), .6)); for (let i = 0; i < 8; i++) tessE.push([i, i + 8]);
  const tv = [], te = [], N = 22, M = 10;
  for (let u = 0; u < N; u++) for (let w = 0; w < M; w++) { const a = u / N * 6.2832, b = w / M * 6.2832; tv.push([(1 + .38 * Math.cos(b)) * Math.cos(a), .38 * Math.sin(b), (1 + .38 * Math.cos(b)) * Math.sin(a)]); }
  for (let u = 0; u < N; u++) for (let w = 0; w < M; w++) { te.push([u * M + w, u * M + (w + 1) % M], [u * M + w, ((u + 1) % N) * M + w]); }
  const sv = [[0, 1, 0], [0, -1, 0]], se = [], K = 6, L = 14, rg = (i, j) => 2 + i * L + j % L;
  for (let i = 0; i < K; i++) { const th = (i + 1) / (K + 1) * Math.PI; for (let j = 0; j < L; j++) sv.push([Math.sin(th) * Math.cos(j / L * 6.2832), Math.cos(th), Math.sin(th) * Math.sin(j / L * 6.2832)]); }
  for (let j = 0; j < L; j++) { se.push([0, rg(0, j)], [rg(K - 1, j), 1]); for (let i = 0; i < K; i++) { se.push([rg(i, j), rg(i, j + 1)]); if (i < K - 1) se.push([rg(i, j), rg(i + 1, j)]); } }
  const SHAPES = [
    { name: 'Icosahedron', v: ico, e: near(ico, 1.15), dots: true },
    { name: 'Tesseract', v: tess, e: tessE, dots: true },
    { name: 'Torus', v: unit(tv), e: te },
    { name: 'Sphere', v: sv, e: se, dots: true }
  ];

  /* ---- Elements ---- */
  const wrap = document.createElement('div'); wrap.className = 'holo-wrap';
  const cv = document.createElement('canvas'); cv.id = 'holo'; cv.tabIndex = 0; cv.setAttribute('role', 'button');
  const label = document.createElement('p'); label.className = 'holo-label';
  wrap.append(cv, label);
  const dh = hero.querySelector('.dossier .dh'); dh ? dh.after(wrap) : hero.append(wrap);   // lives in the FILE 001 panel when it exists
  const ctx = cv.getContext('2d'); let size = 0, dpr = 1, vis = false, idx = 0, glitch = -9999, mx = 0, my = 0;
  const setLabel = () => { label.textContent = SHAPES[idx].name.toUpperCase() + ' \u00b7 CLICK'; cv.setAttribute('aria-label', 'Hologram: ' + SHAPES[idx].name + '. Activate to change shape.'); };
  const next = () => { glitch = performance.now(); setTimeout(() => { idx = (idx + 1) % SHAPES.length; setLabel(); if (still) draw(performance.now()); }, 160); if (still) draw(performance.now()); };
  setLabel();
  cv.addEventListener('click', next);
  cv.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); next(); } });
  addEventListener('pointermove', e => { mx = e.clientX / innerWidth * 2 - 1; my = e.clientY / innerHeight * 2 - 1; });
  const fit = () => { const r = cv.getBoundingClientRect(); dpr = Math.min(devicePixelRatio || 1, 2); size = r.width; cv.width = cv.height = Math.round(r.width * dpr); if (still) draw(performance.now()); };
  new ResizeObserver(fit).observe(cv);
  new IntersectionObserver(es => { vis = es[0].isIntersecting; }).observe(cv);

  /* ---- Drawing ---- */
  const PASSES = [{ c: '#1fb8a6', dx: -3, a: .55 }, { c: '#d6457f', dx: 3, a: .45 }, { c: '#4a4639', dx: 0, a: .95 }];
  function draw(ms) {
    if (!size) return;
    const t = still ? 0 : ms / 1000, gl = Math.max(0, 1 - (ms - glitch) / 450), S = size;
    const R = S * .3, cx = S / 2, cy = S * .43, by = S * .84, rx = S * .34, ry = S * .08;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, S, S); ctx.lineCap = 'round';
    // projector beam + base rings
    const bg = ctx.createLinearGradient(0, by, 0, cy - R); bg.addColorStop(0, 'rgba(31,184,166,.22)'); bg.addColorStop(1, 'rgba(31,184,166,0)');
    ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(cx - rx * .9, by); ctx.lineTo(cx - R * .8, cy - R); ctx.lineTo(cx + R * .8, cy - R); ctx.lineTo(cx + rx * .9, by); ctx.fill();
    for (let k = 0; k < 3; k++) {
      ctx.beginPath(); ctx.ellipse(cx, by, rx * (1 - k * .27), ry * (1 - k * .27), 0, 0, 6.2832);
      ctx.strokeStyle = k === 0 ? '#4a4639' : '#1fb8a6'; ctx.globalAlpha = k === 0 ? .8 : .7; ctx.lineWidth = k === 0 ? 1.5 : 1.2;
      ctx.setLineDash(k ? [6, 6] : []); ctx.lineDashOffset = -t * 18 * (k % 2 ? 1 : -1); ctx.stroke();
    }
    ctx.setLineDash([]);
    // rotate + project
    const sh = SHAPES[idx], ay = t * .5 + (still ? .7 : mx * 1.1), ax = .35 + (still ? 0 : my * .5 + Math.sin(t * .6) * .1);
    const ca = Math.cos(ay), sa = Math.sin(ay), cb = Math.cos(ax), sb = Math.sin(ax);
    const P = sh.v.map(([x, y, z]) => { const x1 = x * ca + z * sa, z1 = -x * sa + z * ca, y1 = y * cb - z1 * sb, z2 = y * sb + z1 * cb, s = 3 / (3 + z2); return [cx + x1 * s * R, cy + y1 * s * R, z2]; });
    const flick = still ? 1 : .88 + Math.random() * .12;
    for (const p of PASSES) {
      const dx = p.dx * (1 + gl * 4) + (gl ? (Math.random() - .5) * gl * 14 : 0);
      ctx.strokeStyle = p.c; ctx.fillStyle = p.c; ctx.lineWidth = 1.2;
      for (const [i, j] of sh.e) {
        if (gl && Math.random() < gl * .35) continue;
        const a = P[i], b = P[j]; ctx.globalAlpha = p.a * flick * (.3 + .7 * (1 - ((a[2] + b[2]) / 2 + 1) / 2));
        ctx.beginPath(); ctx.moveTo(a[0] + dx, a[1]); ctx.lineTo(b[0] + dx, b[1]); ctx.stroke();
      }
      if (sh.dots) for (const a of P) { ctx.globalAlpha = p.a * flick * (.3 + .7 * (1 - (a[2] + 1) / 2)); ctx.fillRect(a[0] + dx - 2, a[1] - 2, 4, 4); }
    }
    // scan band brightens whatever it passes over
    if (!still) {
      const y = (ms * .05) % (S * 1.3) - S * .15, g = ctx.createLinearGradient(0, y - 40, 0, y + 40);
      g.addColorStop(0, 'rgba(31,230,200,0)'); g.addColorStop(.5, 'rgba(31,230,200,.7)'); g.addColorStop(1, 'rgba(31,230,200,0)');
      ctx.globalCompositeOperation = 'source-atop'; ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(0, y - 40, S, 80); ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
  }
  (function loop(ms) { if (vis && !still) draw(ms); requestAnimationFrame(loop); })(performance.now());
})();
