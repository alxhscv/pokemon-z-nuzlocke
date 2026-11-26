// Pestaña Casino: cabecera con saldo, sub-pestañas (Gacha · Blackjack · Clásico) y montaje perezoso de cada módulo.
import { $ } from "./core.js";
import { getBalance, onBalance, recharge, resetWallet } from "./casino-wallet.js";
import { isMuted, setMuted } from "./casino-audio.js";
import { mountGacha } from "./casino-gacha.js";
import { mountBlackjack } from "./casino-bj.js";

const MOUNT = { gacha: ["casGacha", mountGacha], bj: ["casBj", mountBlackjack] }, done = new Set();
let shown = getBalance(), raf = 0, ready = false;

// el contador sube/baja animado hacia el saldo real
function animateTo(target) {
  cancelAnimationFrame(raf);
  const from = shown, t0 = performance.now(), reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const step = (t) => {
    const k = reduce ? 1 : Math.min(1, (t - t0) / 600);
    shown = Math.round(from + (target - from) * (1 - Math.pow(1 - k, 3)));
    $("casBal").textContent = shown;
    if (k < 1) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  $("casBalBox").classList.remove("up", "down"); void $("casBalBox").offsetWidth;
  if (target !== from) $("casBalBox").classList.add(target > from ? "up" : "down");
  $("casRecharge").hidden = target !== 0;
}

export function selectCasinoView(v) {
  document.querySelectorAll(".cas-tab").forEach((b) => { const on = b.dataset.cas === v; b.classList.toggle("active", on); b.setAttribute("aria-selected", String(on)); });
  for (const id of ["casGacha", "casBj", "casClassic"]) $(id).hidden = true;
  const [id, mount] = MOUNT[v] || ["casClassic"];
  $(id).hidden = false;
  $(id).classList.remove("cas-in"); void $(id).offsetWidth; $(id).classList.add("cas-in");
  if (mount && !done.has(v)) { done.add(v); mount($(id)); }
}

export function initCasino() {
  if (ready) return;
  ready = true;
  document.querySelectorAll(".cas-tab").forEach((b) => (b.onclick = () => selectCasinoView(b.dataset.cas)));
  onBalance(animateTo);
  $("casBal").textContent = shown;
  $("casRecharge").hidden = getBalance() !== 0;
  $("casRecharge").onclick = recharge;
  $("casReset").onclick = () => { if (confirm("¿Volver al saldo inicial?")) resetWallet(); };
  const mute = () => { $("casMute").textContent = isMuted() ? "🔇" : "🔊"; $("casMute").setAttribute("aria-pressed", String(isMuted())); };
  $("casMute").onclick = () => { setMuted(!isMuted()); mute(); };
  mute();
  selectCasinoView("gacha");
}
