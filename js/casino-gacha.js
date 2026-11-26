// Gacha del Casino: moneda ficticia (casino-wallet), animaciones por rareza en un overlay con un único canvas 2D.
import { byId, sprite, esc } from "./core.js";
import { getBalance, onBalance, spend } from "./casino-wallet.js";
import { tone, noise } from "./casino-audio.js";

// ---------- CONFIG (todo lo ajustable vive aquí) ----------
// p = probabilidad en % (suma 100) · charge = ms de carga antes de revelar (la revelación añade el resto) · ids = pool fijo
// Común y Raro no llevan ids: se reparten por tramos entre los Pokémon que no están en los pools especiales.
export const GACHA_CFG = {
  cost1: 100, cost10: 900, pity: 50, histMax: 30,
  tiers: [
    { name: "Común", p: 60, color: "#9aa5b1", charge: 900 },
    { name: "Raro", p: 25, color: "#3b9cff", charge: 1300 },
    { name: "Épico", p: 10, color: "#b05cff", charge: 1800,   // pseudolegendarios + iniciales finales + algunos icónicos
      ids: [149, 248, 373, 376, 445, 635, 706, 784, 887, 998, 3, 6, 9, 154, 157, 160, 254, 257, 260, 392, 395, 389, 497, 500, 503, 652, 655, 658, 724, 727, 730, 812, 815, 818, 908, 911, 914, 130, 143, 131, 448, 468, 197, 196] },
    { name: "Legendario", p: 4, color: "#ffb400", charge: 2400, // legendarios reales
      ids: [144, 145, 146, 150, 243, 244, 245, 249, 250, 377, 378, 379, 380, 381, 382, 383, 384, 480, 481, 482, 483, 484, 485, 486, 487, 488, 638, 639, 640, 641, 642, 643, 644, 645, 646, 716, 717, 718, 785, 786, 787, 788, 789, 790, 791, 792, 888, 889, 890, 898] },
    { name: "Mítico", p: 1, color: "#ff4fd8", charge: 3000,     // singulares y míticos
      ids: [151, 251, 385, 386, 489, 490, 491, 492, 493, 494, 647, 648, 649, 719, 720, 721, 801, 802, 807, 808, 809, 893, 1025] },
  ],
};
const TIERS = GACHA_CFG.tiers, N = TIERS.length, LEG = 3; // LEG = primer tier que reinicia el pity
const KEY = "casinoGacha", BLUE = "#3b9cff", GOLD = "#ffc83a";

// ---------- lógica pura (sin DOM) ----------
// from = tier mínimo: renormaliza las probabilidades sobre los tiers >= from (pity y garantía del x10)
export function rollTier(rng = Math.random, from = 0) {
  let tot = 0; for (let i = from; i < N; i++) tot += TIERS[i].p;
  let x = rng() * tot;
  for (let i = from; i < N; i++) { x -= TIERS[i].p; if (x < 0) return i; }
  return N - 1;
}
// n tiradas desde un contador de pity; devuelve los tiers y el pity resultante
export function pull(n, pity, rng = Math.random) {
  const tiers = [];
  for (let i = 0; i < n; i++) {
    const t = pity >= GACHA_CFG.pity ? rollTier(rng, LEG) : rollTier(rng);
    pity = t >= LEG ? 0 : pity + 1; tiers.push(t);
  }
  if (n >= 10 && Math.max(...tiers) < 1) {            // x10: al menos un Raro o superior
    const t = rollTier(rng, 1); tiers[n - 1] = t; if (t >= LEG) pity = 0;
  }
  return { tiers, pity };
}
let pools = null;
function buildPools() {
  const ids = byId.size ? [...byId.keys()].map(Number) : Array.from({ length: 1025 }, (_, i) => i + 1), have = new Set(ids);
  const fixed = TIERS.map((t) => (t.ids || []).filter((i) => have.has(i))), used = new Set(fixed.flat());
  const rest = ids.filter((i) => !used.has(i));
  return fixed.map((f, i) => (f.length ? f : rest.filter((_, k) => (k % 4 === 0) === (i === 1))));
}
export function pickId(tier, rng = Math.random) {
  pools = pools || buildPools();
  const p = pools[tier]; return p[Math.floor(rng() * p.length)];
}
// Autocomprobación: ejecutar selfTest() en consola; devuelve true si todo cumple
export function selfTest() {
  let bad = 0; const ok = (c, m) => { console.assert(c, m); if (!c) bad++; };
  let s = 12345; const rng = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const cnt = Array(N).fill(0), M = 40000; for (let i = 0; i < M; i++) cnt[rollTier(rng)]++;
  TIERS.forEach((t, i) => ok(Math.abs(cnt[i] / M * 100 - t.p) < 1.2, `prob tier ${i}: ${cnt[i] / M * 100}`));
  const a = pull(GACHA_CFG.pity + 1, 0, () => 0);
  ok(a.tiers.slice(0, GACHA_CFG.pity).every((t) => t === 0) && a.tiers[GACHA_CFG.pity] >= LEG && a.pity === 0, "pity garantiza Legendario+");
  ok(pull(10, 0, () => 0).tiers.some((t) => t >= 1), "x10 garantiza Raro+");
  ok(pull(1, 0, () => 0).tiers[0] === 0 && pull(1, 7, () => 0).pity === 8, "pity cuenta fallos");
  ok(rollTier(() => 0.999999) === N - 1 && rollTier(() => 0, 2) === 2, "bordes de rollTier");
  ok(TIERS.every((_, i) => TIERS[i].p > 0) && TIERS.reduce((x, t) => x + t.p, 0) === 100, "suma 100%");
  return bad === 0;
}

// ---------- estado persistido ----------
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && typeof s === "object") return { pity: Math.max(0, +s.pity || 0), hist: Array.isArray(s.hist) ? s.hist : [], inv: s.inv && typeof s.inv === "object" ? s.inv : {} };
  } catch (e) {}
  return { pity: 0, hist: [], inv: {} };
}
const save = (st) => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };
const nameOf = (id) => byId.get(id)?.es || `#${id}`;
const valid = (r) => r && TIERS[r.tier] && Number.isFinite(+r.id);

// ---------- sonido ----------
const BASE = [523, 659, 784, 988, 1175];
function sfxRiser(t, ms) {
  tone({ f: 180 + t * 50, to: 700 + t * 450, dur: ms / 1000, type: t >= LEG ? "sawtooth" : "triangle", vol: .06 + t * .01 });
  if (t >= 1) noise({ dur: ms / 1000, hz: 900 + t * 700, vol: .04 + t * .02, q: 2 });
}
function sfxImpact(t) {
  const f = BASE[t]; tone({ f, dur: .35 + t * .12, type: "triangle", vol: .2 });
  if (t >= 2) { tone({ f: f * 1.25, dur: .5, vol: .12, at: .06 }); tone({ f: f * 1.5, dur: .6, vol: .12, at: .12 }); }
  if (t >= LEG) { tone({ f: 90, to: 40, dur: .7, vol: .35 }); noise({ dur: .6, hz: 250, vol: .4 }); [0, 1, 2, 3].forEach((i) => tone({ f: f * (1 + i * .25), dur: .4, type: "square", vol: .06, at: .3 + i * .1 })); }
}
const sfxFlip = (t) => { noise({ dur: .08, hz: 2500, vol: .12 }); tone({ f: BASE[t] * (t ? 1 : .6), dur: .2, vol: .1, at: .04 }); };

// ---------- motor de partículas (un solo canvas, se destruye al terminar) ----------
function makeFx(stage, reduced) {
  const cv = document.createElement("canvas"); cv.className = "cg-cv"; stage.append(cv);
  const g = cv.getContext("2d"), ps = [], bolts = [];
  let W = 0, H = 0, raf = 0, last = performance.now(), alive = true;
  const fx = { scale: 1, attr: null, size: () => ({ W, H }) };
  const resize = () => { const d = Math.min(devicePixelRatio || 1, 2); W = stage.clientWidth; H = stage.clientHeight; cv.width = W * d; cv.height = H * d; g.setTransform(d, 0, 0, d, 0, 0); };
  resize(); addEventListener("resize", resize);
  const add = (p) => { if (ps.length < 1600) ps.push({ g: 0, drag: 0, size: 3, r: 0, vr: 0, ...p, max: p.life }); };
  // n se reduce con prefers-reduced-motion para no saturar
  const q = (n) => (reduced ? Math.ceil(n * .15) : n);
  fx.burst = (x, y, n, cols, speed, life = 1, o = {}) => { for (let i = 0; i < q(n); i++) { const a = Math.random() * 6.283, v = speed * (.3 + Math.random() * .7); add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * (.6 + Math.random() * .6), c: cols[i % cols.length], size: 2 + Math.random() * 3, drag: 1.2, ...o }); } };
  fx.add = (n, f) => { for (let i = 0; i < q(n); i++) add(f(i)); };
  fx.bolt = (x1, y1, x2, y2) => { const pts = [[x1, y1]], k = 9; for (let i = 1; i < k; i++) pts.push([x1 + (x2 - x1) * i / k + (Math.random() - .5) * 70, y1 + (y2 - y1) * i / k + (Math.random() - .5) * 30]); pts.push([x2, y2]); bolts.push({ pts, life: .18 }); };
  fx.clear = () => { ps.length = 0; bolts.length = 0; fx.attr = null; };
  fx.destroy = () => { alive = false; cancelAnimationFrame(raf); removeEventListener("resize", resize); cv.remove(); };
  function frame(t) {
    if (!alive) return;
    const dt = Math.min(.05, (t - last) / 1000) * fx.scale; last = t;
    g.clearRect(0, 0, W, H); g.globalCompositeOperation = "lighter";
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i]; p.life -= dt;
      if (p.life <= 0) { ps.splice(i, 1); continue; }
      if (fx.attr) { const dx = fx.attr.x - p.x, dy = fx.attr.y - p.y, d = Math.hypot(dx, dy) || 1; if (d < 14) { ps.splice(i, 1); continue; } p.vx += dx / d * fx.attr.k * dt; p.vy += dy / d * fx.attr.k * dt; }
      p.vy += p.g * dt; const dr = Math.max(0, 1 - p.drag * dt); p.vx *= dr; p.vy *= dr; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
      g.globalAlpha = Math.min(1, p.life / p.max * 1.5); g.fillStyle = p.c;
      if (p.rect) { g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillRect(-p.size, -p.size / 2, p.size * 2, p.size); g.restore(); }
      else { g.beginPath(); g.arc(p.x, p.y, p.size, 0, 6.283); g.fill(); }
    }
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i]; b.life -= dt; if (b.life <= 0) { bolts.splice(i, 1); continue; }
      g.globalAlpha = b.life / .18; g.lineJoin = "round";
      [[8, "rgba(176,92,255,.5)"], [2, "#fff"]].forEach(([w, c]) => { g.lineWidth = w; g.strokeStyle = c; g.beginPath(); b.pts.forEach(([x, y], j) => (j ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); });
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  return fx;
}

// ---------- tarjetas ----------
function cardHTML(r, flipped = true) {
  const T = TIERS[r.tier];
  return `<div class="cg-card cg-t${r.tier}" style="--c:${T.color}"><span class="cg-badge">${esc(T.name)}</span><img src="${esc(sprite(r.id))}" alt="" loading="lazy"><b>${esc(nameOf(r.id))}</b><i>#${r.id}</i><span class="cg-glare"></span></div>`;
}
// inclinación 3D siguiendo el ratón (+ brillo) para las tarjetas holográficas
function tilt(card) {
  card.onpointermove = (e) => { const b = card.getBoundingClientRect(), x = (e.clientX - b.left) / b.width, y = (e.clientY - b.top) / b.height; card.style.setProperty("--rx", (.5 - y) * 26 + "deg"); card.style.setProperty("--ry", (x - .5) * 26 + "deg"); card.style.setProperty("--gx", x * 100 + "%"); card.style.setProperty("--gy", y * 100 + "%"); };
  card.onpointerleave = () => ["--rx", "--ry"].forEach((k) => card.style.setProperty(k, "0deg"));
}

// ---------- secuencias de animación ----------
const el = (cls, html = "", st) => { const d = document.createElement("div"); d.className = cls; d.innerHTML = html; return d; };
const wait = (st, ms) => new Promise((res) => setTimeout(() => { if (!st.dead) res(); }, ms)); // tras saltar nunca resuelve: la secuencia queda huérfana
const put = (st, cls, css = "", life = 3000) => { const d = el(cls); d.style.cssText = css; st.fxl.append(d); setTimeout(() => d.remove(), life); return d; };
const flash = (st, col = "#fff") => { if (!st.reduced) put(st, "cg-flash", `--f:${col}`, 700); };
const shake = (st, lvl) => { if (st.reduced) return; st.stage.classList.remove("cg-sh1", "cg-sh2"); void st.stage.offsetWidth; st.stage.classList.add("cg-sh" + lvl); setTimeout(() => st.stage.classList.remove("cg-sh" + lvl), 700); };
const tag = (st, text, cls) => { const w = el("cg-word " + cls); w.setAttribute("aria-hidden", "true"); [...text].forEach((ch, i) => { const s = document.createElement("span"); s.textContent = ch; s.style.animationDelay = i * (st.reduced ? 0 : 110) + "ms"; w.append(s); }); st.fxl.append(w); return w; };
function showCard(st, r) {
  st.slot.innerHTML = `<div class="cg-pop cg-p${r.tier}">${cardHTML(r)}</div>`;
  const c = st.slot.querySelector(".cg-card"); if (r.tier >= 2) tilt(c);
  st.cardShown = true;
}
function setAura(st, col) { st.aura.style.setProperty("--ac", col); }
const rand = (a, b) => a + Math.random() * (b - a);

// carga con tensión; el aura engaña: sale azul/dorado al azar y a veces vira al final, sin relación con el resultado
async function charge(st, r, cx, cy) {
  const ms = st.reduced ? 600 : TIERS[r.tier].charge, t0 = performance.now(), flip = Math.random() < .5, gold = Math.random() < .5;
  sfxRiser(r.tier, ms);
  setAura(st, gold ? GOLD : BLUE); st.aura.style.animationDuration = ms + "ms"; st.aura.classList.add("on");
  let done = false;
  while (performance.now() - t0 < ms) {
    const k = (performance.now() - t0) / ms;
    if (!st.reduced) st.fx.add(Math.round(1 + k * 4), () => { const a = rand(0, 6.283), d = rand(.25, .5) * Math.min(st.fx.size().W, st.fx.size().H); return { x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, vx: -Math.cos(a) * d * 2.2, vy: -Math.sin(a) * d * 2.2, life: .45, c: gold ? GOLD : BLUE, size: 2 }; });
    if (!done && flip && k > .72) { done = true; setAura(st, gold ? BLUE : GOLD); }
    await wait(st, 70);
  }
  st.aura.classList.remove("on");
}

const REVEAL = [
  // Común: destello sutil + rebote (el rebote lo da la clase cg-p0)
  async (st, r, cx, cy) => { flash(st, "#fff"); st.fx.burst(cx, cy, 14, [TIERS[0].color], 170, .6); sfxImpact(0); await wait(st, 350); },
  // Raro: anillos de energía, partículas azules, brillo en el borde
  async (st, r, cx, cy) => {
    for (let i = 0; i < 3; i++) put(st, "cg-ring", `--c:${TIERS[1].color};animation-delay:${i * .18}s`, 1500);
    st.fx.burst(cx, cy, 60, [BLUE, "#9fd0ff"], 320, .9); flash(st, BLUE); sfxImpact(1); await wait(st, 700);
  },
  // Épico: grietas de luz, relámpagos, partículas en espiral, shake leve
  async (st, r, cx, cy) => {
    for (let i = 0; i < 9; i++) put(st, "cg-crack", `--a:${i * 40 + rand(-10, 10)}deg;--c:${TIERS[2].color}`, 2200);
    shake(st, 1); flash(st, "#d9b3ff"); sfxImpact(2);
    const W = st.fx.size().W; for (let i = 0; i < 4; i++) st.fx.bolt(rand(W * .2, W * .8), 0, cx + rand(-60, 60), cy);
    for (let k = 0; k < 28 && !st.reduced; k++) { const a = k * .5; st.fx.add(3, (j) => ({ x: cx, y: cy, vx: Math.cos(a + j * 2) * 240, vy: Math.sin(a + j * 2) * 240, life: 1.1, c: j % 2 ? "#b05cff" : "#e4c6ff", drag: .8, size: 3 })); if (k % 7 === 6) st.fx.bolt(cx + rand(-200, 200), 0, cx, cy); await wait(st, 40); }
    st.fx.burst(cx, cy, 40, ["#b05cff", "#fff"], 380, 1); await wait(st, 500);
  },
  // Legendario: pantalla negra, haz, explosión dorada, lluvia de monedas, rayos giratorios, flash, texto letra a letra
  async (st, r, cx, cy) => {
    st.stage.classList.add("cg-black"); await wait(st, st.reduced ? 100 : 450);
    put(st, "cg-beam", "", 2500); sfxImpact(3); await wait(st, st.reduced ? 100 : 350);
    put(st, "cg-rays", "", 4000); shake(st, 2); flash(st, "#fff");
    st.fx.burst(cx, cy, 220, [GOLD, "#fff2b0", "#ff9d00"], 520, 1.4);
    const H = st.fx.size().H, W = st.fx.size().W;
    for (let k = 0; k < (st.reduced ? 1 : 16); k++) { st.fx.add(8, (j) => ({ x: rand(0, W), y: -10, vx: rand(-40, 40), vy: rand(100, 300), g: 380, life: (H + 40) / 340 + 1, c: j % 3 ? GOLD : ["#ff5a7a", "#5ad1ff", "#9dff6a"][j % 3], size: 3, rect: true, vr: rand(-8, 8) })); await wait(st, 90); }
    tag(st, "LEGENDARIO", "cg-w3"); await wait(st, st.reduced ? 200 : 1300);
  },
  // Mítico (~6 s): slow-mo, glitch, fondo roto, agujero de luz, fuegos artificiales, texto neón
  async (st, r, cx, cy) => {
    const { W, H } = st.fx.size(), rain = ["#ff4f4f", "#ffb400", "#fff04f", "#4fff7a", "#4fc8ff", "#b04fff", "#ff4fd8"];
    st.fx.scale = .3; st.stage.classList.add("cg-glitch", "cg-black"); sfxImpact(2); shake(st, 1);
    await wait(st, st.reduced ? 100 : 700); st.fx.scale = 1;
    // fragmentos del fondo roto
    if (!st.reduced) for (let i = 0; i < 18; i++) { const x = (i % 6) / 6 * 100, y = Math.floor(i / 6) / 3 * 100, w = 100 / 6, h = 100 / 3; put(st, "cg-shard", `left:${x}%;top:${y}%;width:${w + .5}%;height:${h + .5}%;--dx:${rand(-60, 60)}vw;--dy:${rand(-40, 90)}vh;--r:${rand(-200, 200)}deg;clip-path:polygon(${Math.random() < .5 ? "0 0,100% 0,100% 100%" : "0 0,100% 100%,0 100%"});animation-delay:${i * 30}ms`, 2500); }
    st.stage.classList.remove("cg-glitch");
    // agujero de luz que absorbe partículas
    put(st, "cg-hole", "", 2600); st.fx.attr = { x: cx, y: cy, k: 1100 };
    for (let k = 0; k < (st.reduced ? 2 : 14); k++) { st.fx.add(14, (j) => { const a = rand(0, 6.283), d = Math.max(W, H) * rand(.4, .7); return { x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, vx: 0, vy: 0, life: 1.6, c: rain[j % 7], size: 2.5 }; }); await wait(st, 80); }
    st.fx.attr = null; st.fx.scale = .35; flash(st, "#fff"); sfxImpact(4); shake(st, 2); st.stage.classList.add("cg-glitch");
    st.fx.burst(cx, cy, 320, rain, 600, 1.6); await wait(st, st.reduced ? 100 : 450); st.fx.scale = 1; st.stage.classList.remove("cg-glitch");
    // fuegos artificiales
    for (let k = 0; k < (st.reduced ? 1 : 7); k++) { const x = rand(W * .15, W * .85), y = rand(H * .1, H * .5), c = rain[k % 7]; st.fx.burst(x, y, 70, [c, "#fff"], 300, 1.3, { g: 160 }); tone({ f: rand(600, 1400), to: 200, dur: .25, vol: .08 }); await wait(st, 260); }
    tag(st, "MÍTICO", "cg-w4"); await wait(st, st.reduced ? 200 : 600);
  },
];

// ---------- overlay ----------
// Reproduce la tirada; resuelve al cerrar. Los resultados ya están guardados, saltar solo acorta la animación.
async function play(results, opener) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches, multi = results.length > 1;
  const ov = el("cg-ov");
  ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", multi ? "Resultado de 10 tiradas" : "Resultado de la tirada");
  ov.innerHTML = `<div class="cg-stage"><div class="cg-bg"></div><div class="cg-aura"></div><div class="cg-fxl"></div><div class="cg-slot"></div></div><div class="cg-sr" aria-live="polite"></div><button type="button" class="cg-skip" aria-label="Saltar animación">Saltar animación <kbd>Esc</kbd></button><button type="button" class="cg-close" aria-label="Cerrar resultado" hidden>Cerrar</button>`;
  document.body.append(ov);
  const stage = ov.querySelector(".cg-stage"), btnSkip = ov.querySelector(".cg-skip"), btnClose = ov.querySelector(".cg-close");
  const st = { ov, stage, aura: ov.querySelector(".cg-aura"), fxl: ov.querySelector(".cg-fxl"), slot: ov.querySelector(".cg-slot"), reduced, dead: false, cardShown: false };
  st.fx = makeFx(stage, reduced);
  let skip; const skipP = new Promise((r) => (skip = r)), prev = document.activeElement;
  let finished = false, close;
  const closeP = new Promise((r) => (close = r));
  const onKey = (e) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); finished ? close() : (st.dead = true, skip()); }
    else if (e.key === "Tab") { e.preventDefault(); (finished ? btnClose : btnSkip).focus(); }
  };
  document.addEventListener("keydown", onKey, true);
  btnSkip.onclick = () => { st.dead = true; skip(); }; btnClose.onclick = () => close();
  btnSkip.focus();

  const cx = () => st.fx.size().W / 2, cy = () => st.fx.size().H / 2;
  const seq = multi ? gridSeq(st, results) : (async () => {
    const r = results[0]; 
    await charge(st, r, cx(), cy()); await REVEAL[r.tier](st, r, cx(), cy()); showCard(st, r);
  })();
  await Promise.race([seq, skipP]);
  // fin (normal o saltado): limpiar efectos y mostrar el resultado final
  st.dead = true; st.fx.clear(); st.fxl.innerHTML = ""; st.aura.classList.remove("on"); st.stage.className = "cg-stage";
  if (multi) { st.slot.innerHTML = gridHTML(results, true); st.slot.querySelectorAll(".cg-card").forEach((c) => +c.className.match(/cg-t(\d)/)[1] >= 2 && tilt(c)); }
  else showCard(st, results[0]);
  const best = results.reduce((a, b) => (b.tier > a.tier ? b : a));
  ov.querySelector(".cg-sr").textContent = multi ? `Resultado: mejor premio ${nameOf(best.id)}, ${TIERS[best.tier].name}.` : `Obtuviste ${nameOf(best.id)}, ${TIERS[best.tier].name}.`;
  finished = true; btnSkip.hidden = true; btnClose.hidden = false; btnClose.focus();
  await closeP;
  document.removeEventListener("keydown", onKey, true); st.fx.destroy(); ov.remove();
  if (prev && prev.focus && document.contains(prev)) prev.focus(); else opener?.focus();
}

const gridHTML = (rs, on) => `<div class="cg-grid">${rs.map((r) => `<div class="cg-flip${on ? " on" : ""}"><div class="cg-in"><div class="cg-back" aria-hidden="true">?</div><div class="cg-front">${cardHTML(r)}</div></div></div>`).join("")}</div>`;

// x10: cartas boca abajo que se voltean una a una; las Épico+ lanzan una mini-animación antes
async function gridSeq(st, rs) {
  st.slot.innerHTML = gridHTML(rs, false);
  const cells = [...st.slot.querySelectorAll(".cg-flip")];
  for (let i = 0; i < rs.length; i++) {
    const r = rs[i], c = cells[i];
    if (r.tier >= 2 && !st.reduced) {
      const b = c.getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2, T = TIERS[r.tier];
      c.style.setProperty("--c", T.color); c.classList.add("cg-hot"); sfxRiser(r.tier, 700);
      for (let k = 0; k < 8; k++) { st.fx.add(5, () => { const a = rand(0, 6.283); return { x: x + Math.cos(a) * 90, y: y + Math.sin(a) * 90, vx: -Math.cos(a) * 160, vy: -Math.sin(a) * 160, life: .5, c: T.color, size: 2 }; }); await wait(st, 85); }
      if (r.tier >= LEG) shake(st, 1);
      st.fx.burst(x, y, r.tier >= LEG ? 120 : 60, [T.color, "#fff"], 360, 1); flash(st, T.color); c.classList.remove("cg-hot");
    }
    c.classList.add("on"); sfxFlip(r.tier);
    await wait(st, st.reduced ? 90 : 380);
  }
}

// ---------- panel ----------
export function mountGacha(root) {
  const state = load(), cfg = GACHA_CFG;
  let filter = -1, busy = false;
  root.innerHTML = `<div class="cg">
    <p class="cg-info">Cada tirada cuesta <b>${cfg.cost1}</b> monedas (x10: <b>${cfg.cost10}</b>, con al menos un Raro o superior garantizado). Probabilidades: ${TIERS.map((t) => `<span class="cg-chip" style="--c:${t.color}">${esc(t.name)} ${t.p}%</span>`).join(" ")}. Pity: si pasan ${cfg.pity} tiradas sin Legendario o superior, la siguiente lo garantiza.</p>
    <div class="cg-pity"><span>Pity <b class="cg-pn"></b>/${cfg.pity}</span><div class="cg-bar" aria-hidden="true"><i></i></div></div>
    <div class="cg-act">
      <button type="button" class="btn cg-pull" data-n="1" aria-label="Tirar una vez por ${cfg.cost1} monedas">Tirar x1 <small>${cfg.cost1}</small></button>
      <button type="button" class="btn cg-pull cg-x10" data-n="10" aria-label="Tirar diez veces por ${cfg.cost10} monedas">Tirar x10 <small>${cfg.cost10}</small></button>
    </div>
    <p class="cg-msg" role="status"></p>
    <div class="cg-sr" aria-live="polite"></div>
    <h3 class="cg-h">Últimas tiradas</h3><div class="cg-hist"></div>
    <h3 class="cg-h">Colección <span class="cg-cnt"></span></h3>
    <div class="cg-filters" role="group" aria-label="Filtrar colección por rareza"></div>
    <div class="cg-inv"></div></div>`;
  const $ = (s) => root.querySelector(s), btns = [...root.querySelectorAll(".cg-pull")];

  function render() {
    const { pity, hist, inv } = state;
    $(".cg-pn").textContent = pity; $(".cg-bar i").style.width = Math.min(100, pity / cfg.pity * 100) + "%";
    $(".cg-hist").innerHTML = hist.filter(valid).slice(0, cfg.histMax).map((r) => `<span class="cg-h-i" style="--c:${TIERS[r.tier].color}" title="${esc(nameOf(r.id))} · ${esc(TIERS[r.tier].name)}"><img src="${esc(sprite(r.id))}" alt="${esc(nameOf(r.id))}" loading="lazy"></span>`).join("") || `<span class="cg-empty">Aún no has tirado.</span>`;
    const items = Object.entries(inv).map(([id, v]) => ({ id: +id, n: v?.n || 0, tier: v?.tier })).filter((x) => TIERS[x.tier] && x.n > 0);
    $(".cg-cnt").textContent = `(${items.length} distintos)`;
    $(".cg-filters").innerHTML = [-1, ...TIERS.keys()].map((t) => `<button type="button" class="cg-f${t === filter ? " on" : ""}" data-t="${t}" aria-pressed="${t === filter}" style="--c:${t < 0 ? "var(--txt)" : TIERS[t].color}">${t < 0 ? "Todos" : esc(TIERS[t].name)}</button>`).join("");
    const list = items.filter((x) => filter < 0 || x.tier === filter).sort((a, b) => b.tier - a.tier || a.id - b.id);
    $(".cg-inv").innerHTML = list.map((x) => `<div class="cg-it" style="--c:${TIERS[x.tier].color}" title="${esc(TIERS[x.tier].name)}"><img src="${esc(sprite(x.id))}" alt="" loading="lazy"><span>${esc(nameOf(x.id))}</span>${x.n > 1 ? `<em>x${x.n}</em>` : ""}</div>`).join("") || `<span class="cg-empty">Nada en esta rareza todavía.</span>`;
  }
  function refreshBtns() {
    const bal = getBalance();
    btns.forEach((b) => { const cost = b.dataset.n === "1" ? cfg.cost1 : cfg.cost10; b.disabled = busy || bal < cost; });
    $(".cg-msg").textContent = bal < cfg.cost1 ? "Saldo insuficiente: recarga o reinicia tus monedas arriba." : bal < cfg.cost10 ? `Te faltan monedas para el x10 (${cfg.cost10}).` : "";
  }
  root.addEventListener("click", (e) => {
    const f = e.target.closest(".cg-f"); if (f) { filter = +f.dataset.t; render(); }
  });
  btns.forEach((b) => (b.onclick = async () => {
    const n = +b.dataset.n, cost = n === 1 ? cfg.cost1 : cfg.cost10;
    if (busy || !spend(cost)) { refreshBtns(); return; }
    busy = true; refreshBtns();
    const { tiers, pity } = pull(n, state.pity);
    const results = tiers.map((tier) => ({ tier, id: pickId(tier) }));
    // se guarda ya: así saltar o cerrar la pestaña a mitad no pierde la tirada
    state.pity = pity;
    state.hist = [...results].reverse().concat(state.hist).slice(0, cfg.histMax);
    results.forEach((r) => { const v = state.inv[r.id] || { n: 0, tier: r.tier }; v.n++; state.inv[r.id] = v; });
    save(state);
    await play(results, b);
    busy = false; render(); refreshBtns();
    const best = results.reduce((a, c) => (c.tier > a.tier ? c : a));
    $(".cg-sr").textContent = `Última tirada: ${nameOf(best.id)}, ${TIERS[best.tier].name}.`;
  }));
  onBalance(refreshBtns);
  render(); refreshBtns();
}
