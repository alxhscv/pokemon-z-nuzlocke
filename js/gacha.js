import { $, S, byId, confetti, esc, playerIcon, sprite, toast } from "./core.js";
import { reload } from "./data.js";
import { GACHA_COST, adminGiveCoins, pullGacha } from "./api.js";
import { ago, notReadyHTML } from "./ranking.js";

const RAR = { comun: ["Común", 70], raro: ["Raro", 22], epico: ["Épico", 7], legendario: ["Legendario", 1] };
const ORDER = Object.keys(RAR);
const rank = (r) => ORDER.indexOf(r);
const nameOf = (uid) => S.players.find((p) => p.user_id === uid)?.profiles?.display_name || "???";
const mon = (id) => byId.get(+id)?.es || `#${id}`;
const rname = (r) => RAR[r]?.[0] || esc(r);
const gcard = (pid, rar, extra = "", badge = "") => `<div class="gcard r-${esc(rar)}"${extra}>${badge}<img src="${sprite(pid)}" alt="" loading="lazy"><b>${esc(mon(pid))}</b><span class="rtag">${rname(rar)}</span></div>`;

let last = [], busy = false, demo = false;

const CAPS = `<span class="capsule" aria-hidden="true"></span>`;
// tirada de prueba: solo en el navegador, no gasta monedas ni se guarda (la usa cualquiera para ver la animación)
async function demoPull(n) {
  if (busy) return;
  busy = true; demo = true; renderGacha();
  await new Promise((r) => setTimeout(r, 1500));
  const ids = [...byId.keys()];
  last = Array.from({ length: n }, () => {
    let x = Math.random() * 100, rar = ORDER[0];
    for (const r of ORDER) { if ((x -= RAR[r][1]) < 0) { rar = r; break; } }
    return { pokemon_id: ids[Math.floor(Math.random() * ids.length)], rarity: rar };
  });
  if (last.some((p) => p.rarity === "legendario")) confetti();
  busy = false; renderGacha();
}

async function pull(n) {
  if (busy) return;
  busy = true; demo = false; renderGacha();
  try {
    last = await pullGacha(n);
    if (last.some((p) => p.rarity === "legendario")) confetti();
    await reload();
  } catch (e) { toast(e.message || "No se pudo tirar", true); }
  busy = false; renderGacha();
}

export function renderGacha() {
  const box = $("gachaBody");
  if (!box || !S.user) return;
  const ready = S.rankingReady !== false, coins = S.wallets?.[S.user.id] ?? 0, pulls = S.pulls || [];
  const can = (n) => ready && !S.isAdmin && !busy && coins >= GACHA_COST * n;
  const keep = ["gUser", "gAmount"].map((id) => $(id)?.value);
  const mine = new Map();
  for (const p of pulls) if (p.user_id === S.user.id) { const m = mine.get(p.pokemon_id) || { rarity: p.rarity, n: 0 }; m.n++; mine.set(p.pokemon_id, m); }
  const coll = [...mine].sort((a, b) => rank(b[1].rarity) - rank(a[1].rarity) || a[0] - b[0]);
  const opts = S.players.map((p) => `<option value="${esc(p.user_id)}">${esc(p.profiles?.display_name || "???")}</option>`).join("");
  const admin = S.isAdmin ? `<section class="card admin-form"><h3>Administrar monedas</h3>
    <form id="gForm" class="form-row">
      <label>Usuario<select id="gUser">${opts}</select></label>
      <label>Cantidad (puede ser negativa)<input id="gAmount" type="number" step="1" required placeholder="Ej. 100"></label>
      <button type="submit" class="btn primary"${ready ? "" : " disabled"}>Dar monedas</button>
    </form>
    <div class="table-wrap"><table class="rank-table"><caption class="sr-only">Saldos</caption><thead><tr><th scope="col">Jugador</th><th scope="col" class="num">Monedas</th></tr></thead>
    <tbody>${S.players.map((p) => `<tr><th scope="row" class="who">${playerIcon(p.profiles)}<span>${esc(p.profiles?.display_name || "???")}</span></th><td class="num">${S.wallets?.[p.user_id] ?? 0}</td></tr>`).join("")}</tbody></table></div></section>` : "";
  const player = `<section class="card gacha-main">
    ${S.isAdmin ? "" : `<div class="wallet"><span class="coin" aria-hidden="true"></span><b>${coins}</b> monedas</div>
    <div class="gbtns"><button type="button" class="btn primary" id="g1"${can(1) ? "" : " disabled"}>Tirar x1 (${GACHA_COST})</button>
    <button type="button" class="btn primary" id="g10"${can(10) ? "" : " disabled"}>Tirar x10 (${GACHA_COST * 10})</button></div>`}
    <div class="gbtns"><button type="button" class="btn" id="gd1"${busy ? " disabled" : ""}>Tirada gratis x1</button>
    <button type="button" class="btn" id="gd10"${busy ? " disabled" : ""}>Tirada gratis x10</button></div>
    <p class="muted">Las tiradas gratis son de prueba: no gastan monedas ni se guardan en tu colección.</p>
    <div class="reveal" aria-live="polite">${busy ? CAPS : last.length ? last.map((p, i) => gcard(p.pokemon_id, p.rarity, ` style="--i:${i}"`)).join("") : `<span class="muted">Tu última tirada aparecerá aquí.</span>`}</div></section>`;
  box.innerHTML = `${ready ? "" : notReadyHTML()}${player}
    <h3 class="sect">Probabilidades</h3>
    <div class="table-wrap"><table class="rank-table"><caption class="sr-only">Probabilidades por rareza</caption><thead><tr><th scope="col">Rareza</th><th scope="col" class="num">Probabilidad</th></tr></thead>
    <tbody>${ORDER.map((r) => `<tr><th scope="row"><span class="rtag r-${r}">${RAR[r][0]}</span></th><td class="num">${RAR[r][1]}%</td></tr>`).join("")}</tbody></table></div>
    ${S.isAdmin ? "" : `<h3 class="sect">Mi colección <span class="count">${coll.length}</span></h3>
    <div class="gcoll">${coll.map(([pid, m]) => gcard(pid, m.rarity, "", m.n > 1 ? `<i class="gx" aria-label="${m.n} repetidos">x${m.n}</i>` : "")).join("") || `<div class="empty-state"><span>Colección vacía. Una tirada y empiezas.</span></div>`}</div>`}
    ${admin}
    <h3 class="sect">Últimas tiradas de todos</h3>
    ${pulls.length ? `<ul class="battle-list">${pulls.slice(0, 15).map((p) => `<li><span class="bw"><b>${esc(nameOf(p.user_id))}</b></span><span class="vs">sacó</span><span class="rtag r-${esc(p.rarity)}">${esc(mon(p.pokemon_id))}</span><time class="when">${ago(p.created_at)}</time></li>`).join("")}</ul>` : `<div class="empty-state"><span>Nadie ha tirado todavía.</span></div>`}`;
  $("g1")?.addEventListener("click", () => pull(1));
  $("g10")?.addEventListener("click", () => pull(10));
  $("gd1")?.addEventListener("click", () => demoPull(1));
  $("gd10")?.addEventListener("click", () => demoPull(10));
  ["gUser", "gAmount"].forEach((id, i) => { if ($(id) && keep[i]) $(id).value = keep[i]; });
  $("gForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const amt = parseInt($("gAmount").value, 10);
    if (!amt) return toast("Cantidad no válida", true);
    try { await adminGiveCoins($("gUser").value, amt); $("gAmount").value = ""; toast("Monedas actualizadas", false, true); await reload(); }
    catch (err) { toast(err.message || "No se pudo", true); }
  });
}
