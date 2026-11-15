/* Visual effects: shader background, card tilt, scroll reveal, title scramble.
   Everything is optional: with no WebGL2 or with "reduce motion", the page falls back to the plain CSS background. */
(() => {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- Shader background: contour lines that bend around the cursor, ripple on click, drift on scroll ---- */
  const VS = `#version 300 es
void main(){ vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;
  const FS = `#version 300 es
precision highp float;
uniform vec2 uRes, uMouse; uniform vec3 uClick; uniform float uTime, uScroll;
out vec4 o;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * n(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }
void main(){
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  vec2 m = (uMouse * uRes - 0.5 * uRes) / uRes.y;
  vec2 c = (uClick.xy * uRes - 0.5 * uRes) / uRes.y;
  float d = length(p - m), cd = length(p - c), age = uClick.z;
  float ring = age < 0.0 ? 0.0 : exp(-pow((cd - age * 0.6) * 9.0, 2.0)) * exp(-age * 1.4);
  vec2 q = p + (p - m) * 0.3 * exp(-d * d * 5.0) + normalize(p - c + 1e-4) * ring * 0.05;
  q.y += uScroll;
  float t = uTime * 0.035;
  vec2 w = vec2(fbm(q * 1.4 + t), fbm(q * 1.4 + 5.2 - t));
  float f = fbm(q * 1.1 + 2.2 * w + t) + exp(-d * d * 7.0) * 0.22 + ring * 0.12;
  float g = f * 10.0, fr = min(fract(g), 1.0 - fract(g)), wd = min(fwidth(g), 0.5);
  float line = 1.0 - smoothstep(wd * 0.5, wd * 1.5, fr);
  float major = step(mod(floor(g + 0.5), 5.0), 0.5);
  vec3 base = mix(vec3(0.85, 0.83, 0.72), vec3(0.66, 0.64, 0.54), smoothstep(0.2, 1.0, length(gl_FragCoord.xy / uRes - 0.5) * 1.5));
  vec3 ink = vec3(0.29, 0.275, 0.224);
  vec3 col = mix(base, ink, line * (0.16 + 0.2 * major));
  col += vec3(0.07, 0.06, 0.02) * exp(-d * d * 9.0) + (h(gl_FragCoord.xy + uTime) - 0.5) * 0.03;
  o = vec4(col, 1.0);
}`;
  (function shader() {
    const cv = document.createElement('canvas'); cv.id = 'fx'; cv.setAttribute('aria-hidden', 'true');
    const gl = cv.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'low-power' });
    if (!gl) return;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { console.warn('Shader failed:', gl.getProgramInfoLog(pr)); return; }
    gl.useProgram(pr);
    const U = k => gl.getUniformLocation(pr, k);
    const u = { res: U('uRes'), mouse: U('uMouse'), click: U('uClick'), time: U('uTime'), scroll: U('uScroll') };
    document.querySelector('.bg').after(cv);
    const mouse = { x: .5, y: .5, tx: .5, ty: .5 }; let click = { x: .5, y: .5, t: -99 };
    function size() { const r = Math.min(devicePixelRatio || 1, 1.25); cv.width = innerWidth * r; cv.height = innerHeight * r; gl.viewport(0, 0, cv.width, cv.height); }
    function draw(ms) {
      mouse.x += (mouse.tx - mouse.x) * .08; mouse.y += (mouse.ty - mouse.y) * .08;
      const age = (ms - click.t) / 1000;
      gl.uniform2f(u.res, cv.width, cv.height); gl.uniform2f(u.mouse, mouse.x, mouse.y);
      gl.uniform3f(u.click, click.x, click.y, age < 4 ? age : -1);
      gl.uniform1f(u.time, ms / 1000); gl.uniform1f(u.scroll, scrollY * 0.0005);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!still) requestAnimationFrame(draw);
    }
    addEventListener('resize', () => { size(); if (still) draw(performance.now()); });
    addEventListener('pointermove', e => {
      mouse.tx = e.clientX / innerWidth; mouse.ty = 1 - e.clientY / innerHeight;
      const r = document.documentElement.style;   // title shadow follows the cursor
      r.setProperty('--sx', ((.5 - mouse.tx) * 16).toFixed(1)); r.setProperty('--sy', ((mouse.ty - .5) * 16).toFixed(1));
    });
    addEventListener('pointerdown', e => { click = { x: e.clientX / innerWidth, y: 1 - e.clientY / innerHeight, t: performance.now() }; });
    size(); requestAnimationFrame(draw);
  })();

  if (still) return;

  /* ---- Title scramble on load and hover ---- */
  const h1 = document.querySelector('h1');
  if (h1) {
    const final = h1.textContent, chars = 'X<>/\\+#=*'; h1.setAttribute('aria-label', final);
    const scramble = () => {
      clearInterval(h1._i); let f = 0;
      h1._i = setInterval(() => {
        f++; h1.textContent = [...final].map((ch, i) => (i < f / 2 || ch === '’') ? ch : chars[Math.random() * chars.length | 0]).join('');
        if (f / 2 >= final.length) { clearInterval(h1._i); h1.textContent = final; }
      }, 35);
    };
    h1.addEventListener('pointerenter', scramble); scramble();
  }

  /* ---- Scroll reveal (first batch of cards only, so searching doesn't re-animate) ---- */
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in'); io.unobserve(e.target);
    setTimeout(() => e.target.classList.remove('reveal', 'in'), 1000);   // hand transitions back to hover/tilt
  }), { threshold: .12 }) : null;
  const prep = (n, i = 0) => { if (!io) return; n.classList.add('reveal'); n.style.transitionDelay = (i % 6) * 60 + 'ms'; io.observe(n); };
  document.querySelectorAll('section h2, .tools, .plate').forEach((n, i) => prep(n, i));
  const list = document.getElementById('list'); let seen = false;
  new MutationObserver(() => { const cs = list.querySelectorAll('.card'); if (!cs.length || seen) return; seen = true; cs.forEach(prep); }).observe(list, { childList: true });

  /* ---- 3D tilt on project cards ---- */
  list.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const c = e.target.closest('.card'); if (!c) return;
    const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
    c.style.transform = `perspective(800px) rotateX(${(-y * 6).toFixed(2)}deg) rotateY(${(x * 8).toFixed(2)}deg) translateY(-3px)`;
  });
  list.addEventListener('pointerout', e => { const c = e.target.closest('.card'); if (c && !c.contains(e.relatedTarget)) c.style.transform = ''; });
})();
