import { $, S, esc, playerIcon, toast } from "./core.js";
import { reload } from "./data.js";
import { computeRanking } from "./ranking-calc.js";
import { adminDeleteBattle, adminRecordBattle } from "./api.js";

const profOf = (uid) => S.players.find((p) => p.user_id === uid)?.profiles;
const nameOf = (uid) => profOf(uid)?.display_name || "???";
const MEDAL = ["🥇", "🥈", "🥉"];

export function ago(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "hace un momento";
  const m = s / 60, h = m / 60, d = h / 24;
  if (m < 60) return `hace ${Math.floor(m)} min`;
  if (h < 24) return `hace ${Math.floor(h)} h`;
  return d < 30 ? `hace ${Math.floor(d)} d` : new Date(iso).toLocaleDateString("es-ES");
}
export const notReadyHTML = () => `<p class="notice warn" role="alert">Falta aplicar supabase/gacha_ranking.sql en Supabase</p>`;

export function renderRanking() {
  const box = $("rankingBody");
  if (!box || !S.user) return;
  const ready = S.rankingReady !== false, battles = S.battles || [];
  const keep = ["rkWin", "rkLose", "rkNote"].map((id) => $(id)?.value);   // no perder lo escrito al refrescar
  const rows = computeRanking(S.players, battles);
  const table = rows.length ? `<div class="table-wrap"><table class="rank-table">
    <caption class="sr-only">Clasificación de jugadores</caption>
    <thead><tr><th scope="col">Puesto</th><th scope="col">Jugador</th><th scope="col" class="num">Victorias</th><th scope="col" class="num">Derrotas</th><th scope="col" class="num">% victorias</th></tr></thead>
    <tbody>${rows.map((r, i) => `<tr${r.user_id === S.user.id ? ' class="me"' : ""}>
      <td class="pos">${MEDAL[i] ? `<span role="img" aria-label="Puesto ${i + 1}">${MEDAL[i]}</span>` : i + 1}</td>
      <th scope="row" class="who">${playerIcon(profOf(r.user_id))}<span>${esc(nameOf(r.user_id))}</span></th>
      <td class="num">${r.wins}</td><td class="num">${r.losses}</td><td class="num">${r.played ? Math.round(r.winrate * 100) + "%" : "–"}</td></tr>`).join("")}</tbody></table></div>`
    : `<div class="empty-state"><span>Aún no hay jugadores.</span></div>`;
  const opts = S.players.map((p) => `<option value="${esc(p.user_id)}">${esc(p.profiles?.display_name || "???")}</option>`).join("");
  const form = S.isAdmin ? `<form class="card admin-form" id="rkForm">
    <h3>Registrar batalla</h3>
    <p class="muted">El ganador recibe +50 monedas y el perdedor +20.</p>
    <div class="form-row">
      <label>Ganador<select id="rkWin" required>${opts}</select></label>
      <label>Perdedor<select id="rkLose" required>${opts}</select></label>
      <label>Nota (opcional)<input id="rkNote" maxlength="80" placeholder="Ej. Final de liga" autocomplete="off"></label>
    </div>
    <div class="form-actions"><button type="submit" class="btn primary"${ready ? "" : " disabled"}>Registrar batalla</button></div></form>` : "";
  const list = battles.length ? `<ul class="battle-list">${battles.map((b) => `<li>
      <span class="bw">${playerIcon(profOf(b.winner_id))}<b>${esc(nameOf(b.winner_id))}</b></span>
      <span class="vs">venció a</span>
      <span class="bw">${playerIcon(profOf(b.loser_id))}<b>${esc(nameOf(b.loser_id))}</b></span>
      ${b.note ? `<span class="bnote">${esc(b.note)}</span>` : ""}
      <time class="when" datetime="${esc(b.created_at)}">${ago(b.created_at)}</time>
      ${S.isAdmin ? `<button type="button" class="btn danger sm" data-del="${esc(b.id)}" aria-label="Borrar batalla"${ready ? "" : " disabled"}>Borrar</button>` : ""}</li>`).join("")}</ul>`
    : `<div class="empty-state"><span>Ninguna batalla todavía. La arena espera retadores.</span></div>`;
  box.innerHTML = `${ready ? "" : notReadyHTML()}${table}${form}<h3 class="sect">Últimas batallas</h3>${list}`;
  ["rkWin", "rkLose", "rkNote"].forEach((id, i) => { if ($(id) && keep[i]) $(id).value = keep[i]; });
  if ($("rkLose") && !keep[1] && S.players[1]) $("rkLose").value = S.players[1].user_id;
  $("rkForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const w = $("rkWin").value, l = $("rkLose").value;
    if (w === l) return toast("Ganador y perdedor deben ser distintos", true);
    try { await adminRecordBattle(w, l, $("rkNote").value.trim().slice(0, 80) || null); $("rkNote").value = ""; toast("Batalla registrada", false, true); await reload(); }
    catch (err) { toast(err.message || "No se pudo registrar", true); }
  });
  box.querySelectorAll("[data-del]").forEach((b) => (b.onclick = async () => {
    if (!confirm("¿Borrar esta batalla?")) return;
    try { await adminDeleteBattle(b.dataset.del); toast("Batalla borrada", false, true); await reload(); }
    catch (err) { toast(err.message || "No se pudo borrar", true); }
  }));
}
