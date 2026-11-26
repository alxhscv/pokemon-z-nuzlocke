import assert from "node:assert/strict";
import { startRound, act, settle, takeInsurance, dealerStep, legal, canInsure } from "../js/casino-bj-rules.js";
const C = (s) => ({ r: s.slice(0, -1), s: s.slice(-1) });
// baraja fija: orden de reparto = jugador, crupier, jugador, crupier(oculta), y luego las cartas que se roben
const rig = (list) => ({ cards: list.split(" ").map(C), pos: 0, cut: 999, rng: Math.random });

// natural paga 3:2 (apuesta 10 → cobra 25)
let r = startRound(rig("AS 9H KH 7D"), 10);
assert.equal(r.hands[0].result, "bj"); assert.equal(r.payout, 25);
// natural contra natural: empate
r = startRound(rig("AS KH KS AD"), 10);
assert.equal(r.hands[0].result, "push"); assert.equal(r.payout, 10);
// doblar: requiere saldo, apuesta x2, una carta y gana x2
r = startRound(rig("5S 10H 6S 7D 10C"), 10);
assert.ok(legal(r, 10).double); assert.ok(!legal(r, 9).double);
act(r, "double"); settle(r);
assert.equal(r.hands[0].bet, 20); assert.equal(r.hands[0].result, "win"); assert.equal(r.payout, 40);
// dividir: dos manos, cada una gana 1:1 (21 tras split no es natural)
r = startRound(rig("8H 10H 8S 7D 3C 10D 10S"), 10);
assert.ok(legal(r, 10).split); assert.ok(!legal(r, 9).split);
act(r, "split"); act(r, "hit"); act(r, "stand"); settle(r);
assert.equal(r.hands.length, 2); assert.equal(r.payout, 40);
// seguro 2:1: crupier con blackjack, jugador 19 → queda en tablas (15 cobrados de 15 apostados)
r = startRound(rig("10S AH 9S KD"), 10);
assert.ok(canInsure(r, 5)); assert.ok(!canInsure(r, 4));
takeInsurance(r, true);
assert.equal(r.hands[0].result, "lose"); assert.equal(r.payout, 15); assert.equal(r.totalBet, 15);
// seguro perdido: sigue la ronda y no cobra nada
r = startRound(rig("10S AH 9S 9D"), 10); takeInsurance(r, true);
assert.equal(r.phase, "player"); act(r, "stand"); settle(r);
assert.equal(r.payout, 0); assert.equal(r.totalBet, 15);
// crupier pide con 16 y se pasa
r = startRound(rig("10S 10H 9S 6D 10C"), 10); act(r, "stand");
assert.ok(dealerStep(r)); settle(r); assert.equal(r.hands[0].result, "win");
console.log("ok");
