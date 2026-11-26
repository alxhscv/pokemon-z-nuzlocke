// Reglas puras de blackjack (sin DOM ni monedero). La ronda es un objeto mutable que las funciones van avanzando;
// el RNG es inyectable (rng() -> [0,1)) para poder probar con barajas amañadas.
export const DECKS = 6, PENETRATION = 0.75, MAX_HANDS = 3;
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"], SUITS = ["S", "H", "D", "C"];

export const cardValue = (c) => (c.r === "A" ? 11 : "JQK".includes(c.r) ? 10 : +c.r);

// total con ases flexibles; soft = queda algún As contando 11
export function total(cards) {
  let t = 0, aces = 0;
  for (const c of cards) { t += cardValue(c); if (c.r === "A") aces++; }
  while (t > 21 && aces) { t -= 10; aces--; }
  return { total: t, soft: aces > 0 };
}
const tot = (cards) => total(cards).total;
const is21two = (cards) => cards.length === 2 && tot(cards) === 21;
// blackjack natural: 21 con dos cartas y sin venir de un split
export const isNatural = (h) => !h.fromSplit && is21two(h.cards);

export function shuffle(arr, rng = Math.random) {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}
function freshCards(rng) {
  const cards = [];
  for (let d = 0; d < DECKS; d++) for (const s of SUITS) for (const r of RANKS) cards.push({ r, s });
  return shuffle(cards, rng);
}
// la carta de corte se aplica al empezar la ronda siguiente (needsShuffle), nunca a mitad de una
export function newShoe(rng = Math.random) {
  const cards = freshCards(rng);
  return { cards, pos: 0, cut: Math.floor(cards.length * PENETRATION), rng };
}
export const needsShuffle = (shoe) => shoe.pos >= shoe.cut;
function draw(shoe) {
  if (shoe.pos >= shoe.cards.length) { shoe.cards = freshCards(shoe.rng); shoe.pos = 0; }   // red de seguridad, no debería pasar con corte al 75%
  return shoe.cards[shoe.pos++];
}

const mkHand = (bet, cards = []) => ({ cards, bet, doubled: false, fromSplit: false, done: false, result: null, payout: 0 });

// reparte jugador, crupier, jugador, crupier(oculta). Devuelve la ronda en fase "insurance", "player" o "done"
export function startRound(shoe, bet) {
  const r = { shoe, hands: [mkHand(bet)], active: 0, dealer: [], insurance: 0, phase: "", holeHidden: true, paid: false, payout: 0, totalBet: 0 };
  r.hands[0].cards.push(draw(shoe)); r.dealer.push(draw(shoe)); r.hands[0].cards.push(draw(shoe)); r.dealer.push(draw(shoe));
  if (r.dealer[0].r === "A") r.phase = "insurance"; else peek(r);
  return r;
}
// el crupier mira su carta: si hay blackjack (suyo o del jugador) la ronda acaba sin turnos
function peek(r) {
  if (is21two(r.dealer) || isNatural(r.hands[0])) { r.phase = "done"; settle(r); } else r.phase = "player";
}

export const insuranceCost = (r) => Math.floor(r.hands[0].bet / 2);
export const canInsure = (r, balance) => r.phase === "insurance" && insuranceCost(r) >= 1 && balance >= insuranceCost(r);
// el que llama ya cobró el seguro con spend() antes de decir yes=true
export function takeInsurance(r, yes) {
  if (r.phase !== "insurance") return;
  r.insurance = yes ? insuranceCost(r) : 0;
  peek(r);
}

export function legal(r, balance) {
  const off = { hit: false, stand: false, double: false, split: false };
  if (!r || r.phase !== "player") return off;
  const h = r.hands[r.active];
  if (!h || h.done) return off;
  const two = h.cards.length === 2;
  return {
    hit: true, stand: true,
    double: two && balance >= h.bet,
    split: two && r.hands.length < MAX_HANDS && cardValue(h.cards[0]) === cardValue(h.cards[1]) && balance >= h.bet,
  };
}

// el saldo (spend) lo gestiona el que llama antes de doblar/dividir
export function act(r, a) {
  const h = r.hands[r.active];
  if (a === "hit") { h.cards.push(draw(r.shoe)); if (tot(h.cards) >= 21) h.done = true; }
  else if (a === "stand") h.done = true;
  else if (a === "double") { h.bet *= 2; h.doubled = true; h.cards.push(draw(r.shoe)); h.done = true; }
  else if (a === "split") {
    const moved = h.cards.pop(), n = mkHand(h.bet, [moved]), aces = moved.r === "A";
    h.fromSplit = n.fromSplit = true;
    r.hands.splice(r.active + 1, 0, n);
    h.cards.push(draw(r.shoe)); n.cards.push(draw(r.shoe));
    // ases divididos: una sola carta cada uno
    for (const x of [h, n]) if (aces || tot(x.cards) === 21) x.done = true;
  }
  while (r.hands[r.active] && r.hands[r.active].done) r.active++;
  if (r.active >= r.hands.length) r.phase = "dealer";
}

// el crupier pide con <=16 y planta en 17 (también blando); no juega si todas las manos se pasaron
export function dealerNeedsToDraw(r) {
  return r.hands.some((h) => tot(h.cards) <= 21) && tot(r.dealer) < 17;
}
export function dealerStep(r) {
  if (!dealerNeedsToDraw(r)) return null;
  const c = draw(r.shoe); r.dealer.push(c); return c;
}

// cada mano: result + payout (lo que se devuelve al jugador, apuesta incluida). r.payout es el total a cobrar con addCoins
export function settle(r) {
  r.phase = "done"; r.holeHidden = false;
  const d = tot(r.dealer), dBJ = is21two(r.dealer);
  let pay = 0, staked = r.insurance;
  for (const h of r.hands) {
    const p = tot(h.cards);
    if (isNatural(h)) { h.result = dBJ ? "push" : "bj"; h.payout = dBJ ? h.bet : h.bet + Math.round(h.bet * 1.5); }
    else if (p > 21) { h.result = "bust"; h.payout = 0; }
    else if (dBJ) { h.result = "lose"; h.payout = 0; }
    else if (d > 21 || p > d) { h.result = "win"; h.payout = h.bet * 2; }
    else if (p === d) { h.result = "push"; h.payout = h.bet; }
    else { h.result = "lose"; h.payout = 0; }
    pay += h.payout; staked += h.bet;
  }
  if (dBJ && r.insurance) pay += r.insurance * 3;   // seguro 2:1 (más lo apostado)
  r.payout = pay; r.totalBet = staked;
  return r;
}

export function selfTest() {
  const C = (s) => ({ r: s.slice(0, -1), s: s.slice(-1) });
  const rig = (list) => ({ cards: list.split(" ").map(C), pos: 0, cut: 999, rng: Math.random });
  const hand = (s) => s.split(" ").map(C);
  // totales, ases blandos/duros
  console.assert(total(hand("AS 6H")).total === 17 && total(hand("AS 6H")).soft, "A+6 blando 17");
  console.assert(total(hand("AS 6H KD")).total === 17 && !total(hand("AS 6H KD")).soft, "A+6+K duro 17");
  console.assert(total(hand("AS AH")).total === 12, "A+A = 12");
  console.assert(total(hand("AS AH 9C")).total === 21, "A+A+9 = 21");
  console.assert(total(hand("KS QH 5D")).total === 25, "bust 25");
  // baraja
  const sh = newShoe();
  console.assert(sh.cards.length === 312 && sh.cut === 234 && !needsShuffle(sh), "6 barajas, corte 75%");
  sh.pos = sh.cut; console.assert(needsShuffle(sh), "reshuffle en el corte");
  // blackjack natural 3:2 (apuesta 10 -> cobra 25)
  let r = startRound(rig("AS 9H KH 7D"), 10);
  console.assert(r.phase === "done" && r.hands[0].result === "bj" && r.payout === 25, "natural paga 3:2");
  // 21 normal con 3 cartas no es natural: paga 1:1
  r = startRound(rig("7S 10H 7H 8D 7C"), 10); act(r, "hit");
  console.assert(tot(r.hands[0].cards) === 21 && r.phase === "dealer", "21 normal planta solo");
  settle(r); console.assert(r.hands[0].result === "win" && r.payout === 20, "21 normal 1:1");
  // natural vs natural: push
  r = startRound(rig("AS KH KS AD"), 10);
  console.assert(r.hands[0].result === "push" && r.payout === 10, "natural vs natural = push");
  // bust: el crupier no roba
  r = startRound(rig("10S 10H 6S 7D 10C"), 10); act(r, "hit");
  console.assert(r.hands[0].cards.length === 3 && tot(r.hands[0].cards) === 26 && r.phase === "dealer" && !dealerNeedsToDraw(r), "bust cierra y crupier no juega");
  settle(r); console.assert(r.hands[0].result === "bust" && r.payout === 0, "bust pierde");
  // push
  r = startRound(rig("10S 10H 8S 8D"), 10); act(r, "stand"); settle(r);
  console.assert(r.hands[0].result === "push" && r.payout === 10, "push devuelve apuesta");
  // crupier planta en 17 blando
  r = startRound(rig("10S 6H 9S AD"), 10); act(r, "stand");
  console.assert(tot(r.dealer) === 17 && total(r.dealer).soft && !dealerNeedsToDraw(r), "planta en 17 blando");
  settle(r); console.assert(r.hands[0].result === "win", "19 gana a 17");
  // crupier pide con 16 y se pasa
  r = startRound(rig("10S 10H 9S 6D 10C"), 10); act(r, "stand"); console.assert(dealerStep(r), "pide con 16");
  settle(r); console.assert(r.hands[0].result === "win", "crupier se pasa");
  // doblar
  r = startRound(rig("5S 10H 6S 7D 10C"), 10);
  console.assert(legal(r, 10).double && !legal(r, 9).double, "doblar requiere saldo");
  act(r, "double"); console.assert(r.hands[0].bet === 20 && r.hands[0].cards.length === 3 && r.phase === "dealer", "doblar: 1 carta y fin");
  settle(r); console.assert(r.hands[0].result === "win" && r.payout === 40, "doblar gana x2");
  // no se puede doblar con 3 cartas
  r = startRound(rig("2S 10H 3S 7D 4C"), 10); act(r, "hit"); console.assert(!legal(r, 99).double && !legal(r, 99).split, "sin doblar/dividir con 3 cartas");
  // split normal: dos manos independientes
  r = startRound(rig("8H 10H 8S 7D 3C 10D 10S"), 10);
  console.assert(legal(r, 10).split && !legal(r, 9).split, "dividir requiere saldo");
  act(r, "split"); console.assert(r.hands.length === 2 && r.active === 0 && r.hands[0].cards.length === 2, "split crea 2 manos");
  act(r, "hit"); console.assert(r.active === 1, "21 pasa a la siguiente mano");
  act(r, "stand"); console.assert(r.phase === "dealer", "fin de manos");
  settle(r); console.assert(r.hands[0].result === "win" && r.hands[1].result === "win" && r.payout === 40, "split: 21 sin blackjack paga 1:1");
  // ases divididos: una carta, 21 no es natural
  r = startRound(rig("AH 9H AS 7D KC KD 2C"), 10); act(r, "split");
  console.assert(r.phase === "dealer" && r.hands.every((h) => h.done && !isNatural(h) && tot(h.cards) === 21), "ases: una carta y 21 normal");
  dealerStep(r); settle(r); console.assert(r.payout === 40, "ases divididos pagan 1:1");
  // máximo 3 manos
  r = startRound(rig("8H 10H 8S 7D 8C 2D 8D 2H 5C 5D 9C"), 10); act(r, "split"); act(r, "split");
  console.assert(r.hands.length === 3 && !legal(r, 99).split, "máximo 3 manos");
  // seguro 2:1: crupier con blackjack, jugador 19
  r = startRound(rig("10S AH 9S KD"), 10);
  console.assert(canInsure(r, 5) && !canInsure(r, 4) && insuranceCost(r) === 5, "seguro cuesta la mitad");
  takeInsurance(r, true);
  console.assert(r.phase === "done" && r.hands[0].result === "lose" && r.payout === 15 && r.payout - r.totalBet === 0, "seguro 2:1 compensa");
  // seguro perdido
  r = startRound(rig("10S AH 9S 9D"), 10); takeInsurance(r, true);
  console.assert(r.phase === "player", "sin blackjack del crupier sigue la ronda"); act(r, "stand"); settle(r);
  console.assert(r.payout === 0 && r.totalBet === 15, "seguro perdido");
  // crupier natural sin seguro (carta visible 10)
  r = startRound(rig("10S KH 9S AD"), 10);
  console.assert(r.phase === "done" && r.hands[0].result === "lose" && r.payout === 0, "blackjack del crupier");
  console.log("casino-bj-rules selfTest ok");
}
