// Blackjack: render + animaciones + sonido. Las reglas viven en casino-bj-rules.js; el saldo en casino-wallet.js.
import { getBalance, addCoins, spend, onBalance } from "./casino-wallet.js";
import { tone, noise } from "./casino-audio.js";
import * as R from "./casino-bj-rules.js";

/* ---------- config ---------- */
const CHIPS = [1, 5, 25, 100, 500];
const SUIT_ES = { S: "picas", H: "corazones", D: "diamantes", C: "tréboles" };
const RANK_ES = { A: "As", J: "Jota", Q: "Reina", K: "Rey" };
const PIPS = { // [columna 0|1|2, y] en un naipe de 100x140
  2: [[1, 28], [1, 112]], 3: [[1, 28], [1, 70], [1, 112]], 4: [[0, 28], [2, 28], [0, 112], [2, 112]],
  5: [[0, 28], [2, 28], [1, 70], [0, 112], [2, 112]], 6: [[0, 28], [2, 28], [0, 70], [2, 70], [0, 112], [2, 112]],
  7: [[0, 28], [2, 28], [1, 49], [0, 70], [2, 70], [0, 112], [2, 112]],
  8: [[0, 28], [2, 28], [1, 49], [0, 70], [2, 70], [1, 91], [0, 112], [2, 112]],
  9: [[0, 28], [2, 28], [0, 56], [2, 56], [1, 70], [0, 84], [2, 84], [0, 112], [2, 112]],
  10: [[0, 28], [2, 28], [1, 42], [0, 56], [2, 56], [0, 84], [2, 84], [1, 98], [0, 112], [2, 112]],
};
const COLX = [34, 50, 66];

/* ---------- sonido ---------- */
const sfx = {
  deal: () => { noise({ dur: .07, vol: .2, hz: 3800, q: .8 }); noise({ dur: .05, vol: .1, hz: 1800, at: .03 }); },
  flip: () => { noise({ dur: .09, vol: .18, hz: 5200 }); tone({ f: 500, to: 900, dur: .1, type: "triangle", vol: .06 }); },
  chip: () => { tone({ f: 2000, to: 1500, dur: .06, type: "triangle", vol: .1 }); noise({ dur: .04, vol: .15, hz: 4500 }); },
  win: () => [523, 659, 784].forEach((f, i) => tone({ f, dur: .22, type: "triangle", vol: .13, at: i * .1 })),
  lose: () => tone({ f: 330, to: 140, dur: .5, type: "sawtooth", vol: .08 }),
  bj: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ f, dur: .3, type: "triangle", vol: .13, at: i * .09 })); noise({ dur: .6, vol: .08, hz: 7000, at: .35 }); },
};

/* ---------- utilidades de animación ---------- */
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait = (ms) => new Promise((r) => setTimeout(r, reduced() ? 0 : ms));
const play = (node, kf, opt) => (reduced() || !node.animate ? Promise.resolve()
  : node.animate(kf, { easing: "cubic-bezier(.2,.7,.2,1)", ...opt }).finished.catch(() => {}));

/* ---------- vistas puras (HTML) ---------- */
const cardName = (c) => `${RANK_ES[c.r] || c.r} de ${SUIT_ES[c.s]}`;

function cardSvg(c) {
  const col = c.s === "H" || c.s === "D" ? "#c4161c" : "#16181d";
  const use = (x, y, s, flip) => `<use href="#bj-s${c.s}" x="${x - s / 2}" y="${y - s / 2}" width="${s}" height="${s}" fill="${col}"${flip ? ` transform="rotate(180 ${x} ${y})"` : ""}/>`;
  const corner = `<text x="11" y="21" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="${c.r === "10" ? 16 : 19}" fill="${col}">${c.r}</text>${use(11, 33, 11)}`;
  let mid = "";
  if (PIPS[c.r]) mid = PIPS[c.r].map(([k, y]) => use(COLX[k], y, 17, y > 70)).join("");
  else if (c.r === "A") mid = use(50, 70, c.s === "S" ? 46 : 38);
  else {
    // figuras: marco dorado, mitad tintada y adorno propio (corona K, estrella Q, pluma J)
    const orn = { K: "M-9 5L-9-5L-4.5 0L0-8L4.5 0L9-5L9 5Z", Q: "M0-8L2.4-2.5L8.5-2L4-1.8L5.5 4L0 1L-5.5 4L-4-1.8L-8.5-2L-2.4-2.5Z", J: "M-3 6C-9 0-6-6 2-8C0-3 2 0 6 1C2 5-1 7-3 6Z" }[c.r];
    const half = (flip) => `<g${flip ? ' transform="rotate(180 50 70)"' : ""}><path d="M23 27H77V70H23Z" fill="${col}" opacity=".08"/><g transform="translate(50 38)" fill="#d4a017" stroke="#8a6508" stroke-width=".6"><path d="${orn}"/></g>${use(34, 52, 11)}</g>`;
    mid = `<rect x="22" y="26" width="56" height="88" rx="5" fill="#fff8e1" stroke="#d4a017" stroke-width="1.6"/>${half(false)}${half(true)}`
      + `<text x="50" y="82" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="40" fill="${col}" stroke="#d4a017" stroke-width=".8" paint-order="stroke">${c.r}</text>`;
  }
  return `<svg viewBox="0 0 100 140" aria-hidden="true"><rect x=".6" y=".6" width="98.8" height="138.8" rx="8" fill="#fffdf7" stroke="#cfc7b4" stroke-width="1.2"/>`
    + `<rect x="3.5" y="3.5" width="93" height="133" rx="6" fill="none" stroke="#ece5d2" stroke-width=".8"/>${corner}<g transform="rotate(180 50 70)">${corner}</g>${mid}</svg>`;
}

// desglosa un importe en fichas (voraz) y las apila por denominación
function stackHTML(amount) {
  let rest = amount, cols = "";
  for (const v of [...CHIPS].reverse()) {
    const n = Math.floor(rest / v); rest -= n * v;
    if (n) cols += `<span class="bj-col">${`<span class="bj-disc" data-v="${v}"><i>${v}</i></span>`.repeat(Math.min(n, 6))}</span>`;
  }
  return `<span class="bj-stack" role="img" aria-label="Apuesta de ${amount} monedas">${cols}</span><b class="bj-amt">${amount}</b>`;
}

const TEMPLATE = `
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
 <symbol id="bj-sS" viewBox="0 0 20 20"><path d="M10 1C10 1 2 8 2 12c0 3 3 4 5.500 2.500C7 17 6 18 5 19h10c-1-1-2-2-2.500-4.500C15 16 18 15 18 12 18 8 10 1 10 1Z"/></symbol>
 <symbol id="bj-sH" viewBox="0 0 20 20"><path d="M10 18C2 12 1 7 4 4.500 6.500 2.500 9 4 10 6c1-2 3.500-3.500 6-1.500 3 2.500 2 7.500-6 13.500Z"/></symbol>
 <symbol id="bj-sD" viewBox="0 0 20 20"><path d="M10 1l7 9-7 9-7-9Z"/></symbol>
 <symbol id="bj-sC" viewBox="0 0 20 20"><circle cx="10" cy="5.500" r="3.800"/><circle cx="5.500" cy="11.500" r="3.800"/><circle cx="14.500" cy="11.500" r="3.800"/><path d="M10 10l3 9H7Z"/></symbol>
</defs></svg>
<div class="bj-table">
 <div class="bj-shoe" aria-hidden="true"><i></i></div>
 <div class="bj-flashfx" aria-hidden="true"></div>
 <div class="bj-banner" aria-hidden="true"></div>
 <section class="bj-zone bj-dealer" aria-label="Crupier">
  <div class="bj-label">Crupier <span class="bj-tot" data-bj="dtotal"></span></div>
  <div class="bj-cards" data-bj="dealer"></div>
 </section>
 <div class="bj-mid">
  <svg class="bj-arc" viewBox="0 0 800 130" aria-hidden="true"><defs><path id="bj-arc1" d="M110 22Q400 112 690 22"/><path id="bj-arc2" d="M190 70Q400 132 610 70"/></defs>
   <text class="bj-arc1"><textPath href="#bj-arc1" startOffset="50%" text-anchor="middle">BLACKJACK PAYS 3 TO 2</textPath></text>
   <text class="bj-arc2"><textPath href="#bj-arc2" startOffset="50%" text-anchor="middle">DEALER MUST STAND ON 17</textPath></text></svg>
  <p class="bj-msg" role="status" aria-live="polite" data-bj="msg"></p>
 </div>
 <section class="bj-zone bj-player" aria-label="Jugador">
  <div class="bj-hands" data-bj="hands"></div>
  <div class="bj-spot" data-bj="spot"></div>
 </section>
</div>
<div class="bj-panel" data-bj="bet">
 <div class="bj-chips" role="group" aria-label="Fichas">${CHIPS.map((v) => `<button type="button" class="bj-chip" data-v="${v}" aria-label="Apostar ficha de ${v}"><span class="bj-disc" data-v="${v}"><i>${v}</i></span></button>`).join("")}</div>
 <div class="bj-row">
  <button type="button" class="bj-btn" data-do="clear" aria-label="Borrar apuesta">Borrar apuesta</button>
  <button type="button" class="bj-btn" data-do="repeat" aria-label="Repetir apuesta anterior">Repetir apuesta</button>
  <button type="button" class="bj-btn bj-primary" data-do="deal" aria-label="Repartir cartas">Repartir</button>
 </div>
 <p class="bj-hint" role="status" aria-live="polite" data-bj="hint"></p>
</div>
<div class="bj-panel" data-bj="act" hidden>
 <div class="bj-row">
  <button type="button" class="bj-btn" data-a="hit" aria-label="Pedir carta (H)">Pedir <kbd>H</kbd></button>
  <button type="button" class="bj-btn" data-a="stand" aria-label="Plantarse (S)">Plantarse <kbd>S</kbd></button>
  <button type="button" class="bj-btn" data-a="double" aria-label="Doblar apuesta (D)">Doblar <kbd>D</kbd></button>
  <button type="button" class="bj-btn" data-a="split" aria-label="Dividir pareja (P)">Dividir <kbd>P</kbd></button>
 </div>
</div>
<div class="bj-panel" data-bj="ins" hidden>
 <div class="bj-row">
  <button type="button" class="bj-btn bj-primary" data-i="yes" aria-label="Contratar seguro">Seguro</button>
  <button type="button" class="bj-btn" data-i="no" aria-label="Sin seguro">Sin seguro</button>
 </div>
</div>`;

/* ---------- montaje ---------- */
export function mountBlackjack(root) {
  root.classList.add("bj");
  root.innerHTML = TEMPLATE;
  const $ = (s) => root.querySelector(s), $$ = (s) => [...root.querySelectorAll(s)];
  const el = {
    table: $(".bj-table"), shoe: $(".bj-shoe"), banner: $(".bj-banner"), flash: $(".bj-flashfx"),
    dealer: $("[data-bj=dealer]"), dTot: $("[data-bj=dtotal]"), hands: $("[data-bj=hands]"), msg: $("[data-bj=msg]"),
    spot: $("[data-bj=spot]"), hint: $("[data-bj=hint]"),
    panels: { bet: $("[data-bj=bet]"), act: $("[data-bj=act]"), ins: $("[data-bj=ins]") },
  };
  // estado: bet = apuesta en construcción (aún sin cobrar; se cobra al repartir para que recargar no pierda monedas)
  const S = { bet: 0, last: 0, round: null, phase: "bet", busy: false, shoe: R.newShoe() };

  const say = (t) => { el.msg.textContent = t; };
  const panel = (name) => { for (const k in el.panels) el.panels[k].hidden = k !== name; };

  /* --- cartas --- */
  function cardEl(c, down) {
    const d = document.createElement("div");
    d.className = "bj-card"; d.dataset.k = c.r + c.s;
    d.setAttribute("role", "img"); d.setAttribute("aria-label", down ? "Carta oculta" : cardName(c));
    d.innerHTML = `<div class="bj-flip${down ? " bj-down" : ""}"><div class="bj-face bj-front">${cardSvg(c)}</div><div class="bj-face bj-back"></div></div>`;
    return d;
  }
  // la carta sale volando del zapato con rotación y se asienta; si va boca arriba se voltea en el vuelo
  async function dealTo(box, c, down) {
    const node = cardEl(c, down); box.appendChild(node);
    const a = el.shoe.getBoundingClientRect(), b = node.getBoundingClientRect();
    const dx = a.left + a.width / 2 - (b.left + b.width / 2), dy = a.top + a.height / 2 - (b.top + b.height / 2);
    sfx.deal();
    if (!down) play(node.firstChild, [{ transform: "rotateY(180deg)" }, { transform: "rotateY(0)" }], { duration: 380, delay: 60 });
    await play(node, [{ transform: `translate(${dx}px,${dy}px) rotate(-28deg) scale(.7)`, opacity: .85 }, { transform: "none", opacity: 1 }], { duration: 440 });
    await wait(90);
  }
  async function revealHole(r) {
    const node = el.dealer.children[1]; if (!node) return;
    const f = node.firstChild;
    f.classList.remove("bj-down"); node.setAttribute("aria-label", cardName(r.dealer[1]));
    r.holeHidden = false; sfx.flip();
    await play(f, [{ transform: "rotateY(180deg)" }, { transform: "rotateY(0)" }], { duration: 480 });
    updateDealer(r);
  }

  /* --- manos --- */
  const handShell = () => {
    const h = document.createElement("div"); h.className = "bj-h";
    h.innerHTML = `<div class="bj-cards"></div><div class="bj-tot"></div><div class="bj-hbet"></div><div class="bj-res"></div>`;
    return h;
  };
  function ensureHands(r) {
    while (el.hands.children.length < r.hands.length) el.hands.appendChild(handShell());
    while (el.hands.children.length > r.hands.length) el.hands.lastChild.remove();
  }
  function updateHand(r, i) {
    const h = r.hands[i], node = el.hands.children[i], t = R.total(h.cards);
    node.querySelector(".bj-tot").textContent = t.total > 21 ? `${t.total} · Se pasa` : t.soft && t.total < 21 ? `${t.total - 10} / ${t.total}` : t.total;
    node.querySelector(".bj-hbet").innerHTML = node.classList.contains("bj-gone") ? "" : stackHTML(h.bet);
    node.classList.toggle("bj-active", r.phase === "player" && r.active === i && r.hands.length > 1);
    node.classList.toggle("bj-bust", t.total > 21);
    node.setAttribute("aria-label", `Mano ${i + 1}: ${t.total}`);
  }
  // sincroniza el DOM con el modelo; solo anima las cartas nuevas (tras split se rehace desde la primera que difiera)
  async function syncPlayer(r) {
    ensureHands(r);
    for (let i = 0; i < r.hands.length; i++) {
      const box = el.hands.children[i].firstChild, cards = r.hands[i].cards;
      let m = 0; while (m < box.children.length && m < cards.length && box.children[m].dataset.k === cards[m].r + cards[m].s) m++;
      while (box.children.length > m) box.lastChild.remove();
      for (let k = m; k < cards.length; k++) await dealTo(box, cards[k], false);
      updateHand(r, i);
    }
    for (let i = 0; i < r.hands.length; i++) updateHand(r, i);
  }
  function updateDealer(r) {
    const t = r.holeHidden ? R.total(r.dealer.slice(0, 1)).total : R.total(r.dealer);
    el.dTot.textContent = typeof t === "number" ? t : t.total > 21 ? `${t.total} · Se pasa` : t.soft && t.total < 21 ? `${t.total - 10} / ${t.total}` : t.total;
  }
  async function syncDealer(r) {
    for (let k = el.dealer.children.length; k < r.dealer.length; k++) await dealTo(el.dealer, r.dealer[k], k === 1 && r.holeHidden);
    updateDealer(r);
  }

  /* --- apuesta --- */
  function renderBet(dropV) {
    el.spot.innerHTML = S.bet ? stackHTML(S.bet) : `<span class="bj-spot-hint">APUESTA</span>`;
    if (dropV) { const d = el.spot.querySelectorAll(`.bj-disc[data-v="${dropV}"]`); d[d.length - 1]?.classList.add("bj-drop"); }
  }
  function clearTable() {
    S.round = null; el.dealer.innerHTML = ""; el.dTot.textContent = ""; el.hands.innerHTML = ""; say("");
  }
  function addChip(v) {
    if (S.busy || S.phase !== "bet" || S.bet + v > getBalance()) return;
    if (S.round) clearTable();
    S.bet += v; sfx.chip(); renderBet(v); refresh();
  }

  /* --- controles --- */
  function refresh() {
    const bal = getBalance(), r = S.round, bet = S.phase === "bet" && !S.busy;
    $$(".bj-chip").forEach((b) => (b.disabled = !bet || S.bet + +b.dataset.v > bal));
    $("[data-do=clear]").disabled = !bet || !S.bet;
    $("[data-do=repeat]").disabled = !bet || S.bet > 0 || !S.last || bal < 1;
    $("[data-do=deal]").disabled = !bet || S.bet < 1;
    const L = r && !S.busy ? R.legal(r, bal) : {};
    $$("[data-a]").forEach((b) => (b.disabled = !L[b.dataset.a]));
    const ins = r && !S.busy && r.phase === "insurance";
    $("[data-i=yes]").disabled = !ins || !R.canInsure(r, bal);
    $("[data-i=no]").disabled = !ins;
    if ($("[data-i=yes]")) $("[data-i=yes]").textContent = r ? `Seguro (${R.insuranceCost(r)})` : "Seguro";
    el.hint.textContent = !bet ? "" : bal === 0 && !S.bet ? "Sin monedas: pulsa «Recarga gratis» en la cabecera para seguir jugando."
      : S.bet ? `Apuesta: ${S.bet}. Pulsa Repartir.` : "Elige fichas para apostar.";
  }

  /* --- flujo de la ronda --- */
  async function deal() {
    if (S.busy || S.phase !== "bet" || S.bet < 1 || !spend(S.bet)) return;
    S.busy = true; S.last = S.bet; const amount = S.bet; S.bet = 0;
    clearTable(); renderBet(); panel("act"); refresh();
    if (R.needsShuffle(S.shoe)) {
      say("Barajando…"); S.shoe = R.newShoe();
      play(el.shoe, [{ transform: "none" }, { transform: "translateX(-8px) rotate(-3deg)" }, { transform: "translateX(8px) rotate(3deg)" }, { transform: "none" }], { duration: 700 });
      sfx.flip(); await wait(900); say("");
    }
    const r = (S.round = R.startRound(S.shoe, amount)); S.phase = "play";
    el.table.classList.add("bj-playing");
    ensureHands(r);
    const box = el.hands.children[0].firstChild;
    await dealTo(box, r.hands[0].cards[0], false); await dealTo(el.dealer, r.dealer[0], false);
    await dealTo(box, r.hands[0].cards[1], false); await dealTo(el.dealer, r.dealer[1], true);
    updateHand(r, 0); updateDealer(r);
    if (r.phase === "insurance") { panel("ins"); say("El crupier enseña un As. ¿Contratas seguro?"); S.busy = false; refresh(); return; }
    await proceed(r);
  }
  async function insure(yes) {
    const r = S.round;
    if (S.busy || !r || r.phase !== "insurance") return;
    if (yes) { if (!R.canInsure(r, getBalance()) || !spend(R.insuranceCost(r))) return; sfx.chip(); }
    S.busy = true; R.takeInsurance(r, yes); panel("act"); refresh();
    say(yes ? "Seguro contratado." : "Sin seguro."); await wait(450);
    await proceed(r);
  }
  async function proceed(r) {
    if (r.phase === "done") return finish(r);
    updateHand(r, 0); say("Tu turno."); S.busy = false; refresh();
  }
  async function act(a) {
    const r = S.round;
    if (S.busy || !r || r.phase !== "player" || !R.legal(r, getBalance())[a]) return;
    if ((a === "double" || a === "split") && !spend(r.hands[r.active].bet)) return;
    if (a !== "hit" && a !== "stand") sfx.chip();
    S.busy = true; R.act(r, a); refresh();
    await syncPlayer(r);
    if (r.phase === "dealer") return dealerTurn(r);
    say("Tu turno."); S.busy = false; refresh();
  }
  async function dealerTurn(r) {
    say("Turno del crupier…"); refresh();
    await wait(300); await revealHole(r); await wait(450);
    while (R.dealerStep(r)) { await syncDealer(r); await wait(420); }
    await finish(r);
  }
  const LABEL = { bj: "¡Blackjack!", win: "Gana", push: "Empate", lose: "Pierde", bust: "Se pasa" };
  async function finish(r) {
    S.busy = true; refresh();
    if (r.holeHidden) { await wait(300); await revealHole(r); await wait(350); }
    updateDealer(r);
    if (r.phase !== "done") R.settle(r);
    if (!r.paid) { r.paid = true; if (r.payout > 0) addCoins(r.payout); }   // se cobra una sola vez
    const net = r.payout - r.totalBet, anyBJ = r.hands.some((h) => h.result === "bj");
    ensureHands(r);
    r.hands.forEach((h, i) => {
      const node = el.hands.children[i], gain = h.payout - h.bet;
      node.classList.remove("bj-active"); node.classList.add(`bj-r-${h.result}`);
      node.querySelector(".bj-res").textContent = `${LABEL[h.result]}${h.result === "win" || h.result === "bj" ? ` +${gain}` : ""}`;
      updateHand(r, i);
      const st = node.querySelector(".bj-hbet");
      if (h.result === "win" || h.result === "bj") play(st, [{ transform: "none", opacity: 1 }, { transform: "translateY(110px) scale(.8)", opacity: 0 }], { duration: 750, delay: 250, fill: "forwards" });
      else if (h.result !== "push") play(st, [{ transform: "none", opacity: 1 }, { transform: "translateY(-150px) scale(.8)", opacity: 0 }], { duration: 750, delay: 250, fill: "forwards" });
      else return;
      setTimeout(() => (st.style.visibility = "hidden"), reduced() ? 0 : 1000);
    });
    say(anyBJ ? `¡Blackjack! Cobras ${net} monedas.` : r.dealer.length && R.total(r.dealer).total > 21 && net > 0 ? `El crupier se pasa. Ganas ${net} monedas.`
      : net > 0 ? `Ganas ${net} monedas.` : net < 0 ? `Pierdes ${-net} monedas.` : "Empate: se devuelve tu apuesta.");
    if (anyBJ) { sfx.bj(); celebrate(); } else if (net > 0) sfx.win(); else if (net < 0) sfx.lose();
    S.phase = "bet"; S.busy = false; el.table.classList.remove("bj-playing");
    panel("bet"); renderBet(); refresh();
  }
  function celebrate() {
    el.banner.textContent = "BLACKJACK!";
    el.banner.classList.remove("bj-on"); el.flash.classList.remove("bj-on"); void el.banner.offsetWidth;
    el.banner.classList.add("bj-on"); el.flash.classList.add("bj-on");
  }

  /* --- eventos --- */
  $$(".bj-chip").forEach((b) => (b.onclick = () => addChip(+b.dataset.v)));
  $("[data-do=clear]").onclick = () => { if (S.busy) return; S.bet = 0; renderBet(); refresh(); };
  $("[data-do=repeat]").onclick = () => {
    if (S.busy || S.phase !== "bet") return;
    if (S.round) clearTable();
    S.bet = Math.min(S.last, getBalance()); sfx.chip(); renderBet(); refresh();
  };
  $("[data-do=deal]").onclick = deal;
  $$("[data-a]").forEach((b) => (b.onclick = () => act(b.dataset.a)));
  $("[data-i=yes]").onclick = () => insure(true);
  $("[data-i=no]").onclick = () => insure(false);
  onBalance(refresh);
  // atajos solo con la vista visible y sin foco en un campo de texto
  document.addEventListener("keydown", (e) => {
    if (root.hidden || root.offsetParent === null || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest?.("input,textarea,select,[contenteditable]")) return;
    const a = { h: "hit", s: "stand", d: "double", p: "split" }[e.key.toLowerCase()];
    if (a) { e.preventDefault(); act(a); }
  });

  renderBet(); refresh();
}
