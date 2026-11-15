// ---- Settings: defaults here, overridden by site.config.json ----
const CFG = {
  githubUser: 'xylthr',
  excludeRepos: ['xylthr.github.io', 'xylthr'],
  discord: 'xyl.thr',
  sounds: { hover: '', click: '', back: '' },   // e.g. 'sounds/hover.mp3'; empty = synthesized
  musicFile: ''                                  // e.g. 'music/song.mp3'; empty = built-in ambient
};
const cfgReady = fetch('site.config.json').then(r => r.ok ? r.json() : {}).then(c => Object.assign(CFG, c)).catch(() => {});
// ------------------------------------------------------------------

const $ = id => document.getElementById(id);
$('year').textContent = new Date().getFullYear();
const st = { sfx: true, mus: true };

/* ---- Sound: original synthesized UI sounds ---- */
const AC = window.AudioContext || window.webkitAudioContext;
let ctx;
function tone(freq, at, dur, vol, type) {
  const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02);
}
const SFX = {
  hover() { tone(1320, 0, 0.06, 0.025, 'sine'); },
  click() { tone(660, 0, 0.09, 0.05, 'triangle'); tone(990, 0.07, 0.16, 0.045, 'triangle'); },
  back()  { tone(660, 0, 0.08, 0.045, 'triangle'); tone(440, 0.07, 0.14, 0.045, 'triangle'); }
};
function play(name) {
  if (!st.sfx) return;
  if (CFG.sounds[name]) { const a = new Audio(CFG.sounds[name]); a.volume = 0.5; a.play().catch(() => {}); return; }
  if (!AC) return;
  ctx = ctx || new AC(); ctx.resume(); SFX[name]();
}
let lastHover = null;
document.addEventListener('pointerover', e => {
  if (e.pointerType === 'touch') return;
  const t = e.target.closest('a, button, .card, label');
  if (t && t !== lastHover) { lastHover = t; play('hover'); }
  if (!t) lastHover = null;
});
document.addEventListener('click', e => {
  const t = e.target.closest('a, button');
  if (t && t.id !== 'sfx' && t.id !== 'mus') play('click');
});

/* ---- Sound and music toggles ---- */
/* ---- Background music: original generative ambient, made in the browser ---- */
// To use your own track instead, set "musicFile" in site.config.json.
let music = null;
const CHORDS = [[110, 164.81, 261.63, 329.63], [87.31, 130.81, 220, 329.63], [130.81, 196, 261.63, 329.63], [98, 146.83, 220, 293.66]];
const SCALE = [440, 523.25, 587.33, 659.25, 783.99, 880];
let mMaster, mBus, mDelay, mRun = false, mT1, mT2, mIdx = 0;
function buildMusic() {
  ctx = ctx || new AC();
  mMaster = ctx.createGain(); mMaster.gain.value = 0;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
  mMaster.connect(lp); lp.connect(ctx.destination);
  mBus = ctx.createGain();
  const dry = ctx.createGain(); dry.gain.value = 0.7; mBus.connect(dry); dry.connect(mMaster);
  const len = ctx.sampleRate * 3, ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5); }
  const rev = ctx.createConvolver(); rev.buffer = ir;
  const wet = ctx.createGain(); wet.gain.value = 0.55; mBus.connect(rev); rev.connect(wet); wet.connect(mMaster);
  mDelay = ctx.createDelay(1); mDelay.delayTime.value = 0.55;
  const fb = ctx.createGain(); fb.gain.value = 0.35; mDelay.connect(fb); fb.connect(mDelay); mDelay.connect(mBus);
}
function padChord() {
  const t = ctx.currentTime;
  CHORDS[mIdx++ % CHORDS.length].forEach(f => [1, 1.004].forEach((d, j) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = j ? 'sine' : 'triangle'; o.frequency.value = f * d;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.03, t + 3);
    g.gain.setValueAtTime(0.03, t + 6); g.gain.linearRampToValueAtTime(0.0001, t + 11);
    o.connect(g); g.connect(mBus); o.start(t); o.stop(t + 11.1);
  }));
}
function pluck() {
  const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.value = SCALE[Math.floor(Math.random() * SCALE.length)];
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.5);
  o.connect(g); g.connect(mBus); g.connect(mDelay); o.start(t); o.stop(t + 3.6);
}
function chordLoop() { padChord(); mT1 = setTimeout(chordLoop, 8000); }
function pluckLoop() { pluck(); mT2 = setTimeout(pluckLoop, 1800 + Math.random() * 3200); }
function startMusic() {
  if (!AC) return;
  if (!mMaster) buildMusic();
  ctx.resume(); mMaster.gain.setTargetAtTime(0.5, ctx.currentTime, 1.5);
  if (!mRun) { mRun = true; chordLoop(); pluckLoop(); }
}
function stopMusic() {
  if (!mMaster) return;
  mMaster.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
  mRun = false; clearTimeout(mT1); clearTimeout(mT2);
}
function syncToggle(id, label, on) { const b = $(id); b.textContent = label + (on ? ' On' : ' Off'); b.setAttribute('aria-pressed', on); }
function applyMusic() {
  if (CFG.musicFile && !music) { music = new Audio(CFG.musicFile); music.loop = true; music.volume = 0.2; }
  if (music) { st.mus ? music.play().catch(() => {}) : music.pause(); } else { st.mus ? startMusic() : stopMusic(); } }
$('sfx').onclick = () => { st.sfx = !st.sfx; syncToggle('sfx', 'Sound', st.sfx); play('click'); };
$('mus').onclick = () => { st.mus = !st.mus; syncToggle('mus', 'Music', st.mus); applyMusic(); play(st.mus ? 'click' : 'back'); };
let started = false;   // browsers block autoplay, so music starts on the first interaction
['pointerdown', 'keydown'].forEach(ev => addEventListener(ev, () => { if (!started) { started = true; applyMusic(); } }));

/* ---- Discord copy ---- */
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2500); }
$('discord').onclick = () => navigator.clipboard.writeText(CFG.discord).then(() => toast('Copied Discord: ' + CFG.discord), () => toast('Discord: ' + CFG.discord));

/* ---- Projects ---- */
// Source order: ?demo=1 sample -> data/projects.json (made by the deploy workflow) -> live GitHub API.
let projects = [], demo = false;
function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
function btn(href, text, fill) { const a = el('a', 'btn' + (fill ? ' fill' : ''), text); a.href = href; a.target = '_blank'; a.rel = 'noopener'; return a; }
const fmtDate = d => new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

function render() {
  const q = $('search').value.trim().toLowerCase(), forks = $('forks').checked;
  const list = projects
    .filter(p => !p.fork || forks)
    .filter(p => !q || [p.name, p.description, p.language, (p.topics || []).join(' ')].join(' ').toLowerCase().includes(q));
  const box = $('list'); box.replaceChildren(); box.setAttribute('aria-busy', 'false');
  $('count').textContent = list.length + (list.length === 1 ? ' project' : ' projects');
  if (!list.length) { box.append(el('p', 'state', q ? 'No projects match your search.' : 'No public projects yet.')); return; }
  for (const p of list) {
    const c = el('article', 'card'), h = el('h3', null, p.name);
    if (p.featured) h.append(el('span', 'badge', 'FEATURED'));
    const meta = el('div', 'meta');
    if (p.language) meta.append(el('span', null, p.language));
    meta.append(el('span', null, '\u2605 ' + (p.stars || 0)), el('span', null, 'Updated ' + fmtDate(p.pushed)));
    if (p.release && p.release.tag) meta.append(el('span', null, p.release.tag));
    const acts = el('div', 'row'); acts.append(btn(p.url, 'Code'));
    const rel = p.release;
    if (rel && rel.assets && rel.assets.length) acts.append(btn(rel.assets.length === 1 ? rel.assets[0].url : rel.url, 'Download'));
    if (p.homepage) acts.append(btn(/^https?:/.test(p.homepage) ? p.homepage : 'https://' + p.homepage, 'Visit'));
    c.append(h, el('p', 'desc', p.description || 'No description yet.'), meta);
    if (p.topics && p.topics.length) c.append(el('div', 'topics', p.topics.slice(0, 5).map(t => '#' + t).join('  ')));
    c.append(acts); box.append(c);
  }
}
function showError(rate) {
  const box = $('list'); box.replaceChildren(); box.setAttribute('aria-busy', 'false'); $('count').textContent = '';
  const p = el('p', 'state', rate ? 'GitHub is limiting requests right now. Try again in a few minutes, or ' : 'Couldn\u2019t load projects. Check your connection, or ');
  const a = el('a', null, 'browse them on GitHub'); a.href = 'https://github.com/' + CFG.githubUser + '?tab=repositories'; a.target = '_blank'; a.rel = 'noopener';
  p.append(a, '.'); box.append(p);
}
const getJSON = async url => { const r = await fetch(url, { cache: 'no-cache' }); if (!r.ok) throw new Error('http'); return r.json(); };

// Fallback when data/projects.json is empty (local preview, or before the first deploy).
async function liveRepos() {
  const key = 'repos:' + CFG.githubUser;
  try { const c = JSON.parse(sessionStorage.getItem(key) || 'null'); if (c && Date.now() - c.t < 600000) return c.d; } catch (e) {}
  let all = [];
  for (let n = 1; n <= 5; n++) {
    const r = await fetch(`https://api.github.com/users/${CFG.githubUser}/repos?per_page=100&sort=pushed&page=${n}`, { headers: { Accept: 'application/vnd.github+json' } });
    if (!r.ok) throw new Error(r.status === 403 ? 'rate' : 'http');
    const b = await r.json(); all = all.concat(b);
    if (b.length < 100) break;
  }
  const skip = CFG.excludeRepos.map(s => s.toLowerCase());
  const d = all.filter(r => !r.archived && !r.fork && !skip.includes(r.name.toLowerCase()) && !(r.topics || []).includes('nosite')).map(r => ({
    name: r.name, description: r.description, url: r.html_url, homepage: r.homepage, language: r.language,
    stars: r.stargazers_count, topics: r.topics || [], featured: (r.topics || []).includes('featured'), pushed: r.pushed_at, release: null
  }));
  try { sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), d })); } catch (e) {}
  return d;
}
async function loadProjects() {
  await cfgReady;
  if (new URLSearchParams(location.search).has('demo')) {
    try { const d = await getJSON('data/projects.sample.json'); demo = true; $('demo').hidden = false; return d.projects; } catch (e) {}
  }
  try { const d = await getJSON('data/projects.json'); if (d.projects && d.projects.length) return d.projects; } catch (e) {}
  return liveRepos();
}
$('search').addEventListener('input', render);
$('forks').addEventListener('change', render);
loadProjects().then(d => { projects = d; render(); }).catch(e => showError(e.message === 'rate'));

