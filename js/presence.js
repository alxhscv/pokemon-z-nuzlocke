import { $, S, db, esc, playerIcon, toast } from "./core.js";
import { renderPayos } from "./payos.js";

// ===================== fichaje =====================
// latido cada 30 s (clock_ping); 90 s sin latido = desconectado. Ver supabase/presence.sql
export let presence = new Map(), lastConn = new Map(), pingT, pollT, tickT;
export const p2 = (n) => String(n).padStart(2, "0");
export function fmtClock(s) { s = Math.max(0, Math.floor(s)); return `${p2(Math.floor(s / 3600))}:${p2(Math.floor((s % 3600) / 60))}:${p2(s % 60)}`; }
export function fmtAgo(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 1) return "un momento";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h} h` : `${Math.floor(h / 24)} d`;
}
export const hhmm = (d) => new Date(d).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
export const clockSpan = (start) => `<span data-clock="${esc(start)}">${fmtClock((Date.now() - new Date(start)) / 1000)}</span>`;
export function fmtDur(s) {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min`;
}
export async function startPresence() {
  stopPresence();
  pingT = setInterval(ping, 30000);
  await loadPresence();
  pollT = setInterval(loadPresence, 30000);
  tickT = setInterval(() => document.querySelectorAll("[data-clock]").forEach((el) => {
    el.textContent = fmtClock((Date.now() - new Date(el.dataset.clock)) / 1000);
  }), 1000);
}
export async function stopPresence(out = false) {
  clearInterval(pingT); clearInterval(pollT); clearInterval(tickT);
  if (out && !S.isAdmin) await db.rpc("clock_out");
}
export async function loadPresence() {
  const [{ data, error }, { data: ses }] = await Promise.all([
    db.rpc("presence_summary"),
    db.from("sessions").select("user_id,started_at,last_seen,ended_at").order("last_seen", { ascending: false }).limit(300),
  ]);
  if (error) return toast("No se pudo leer el fichaje: " + error.message, true);   // sin tocar el estado local
  if (!S.user) return;
  presence = new Map((data || []).map((r) => [r.user_id, r]));
  lastConn = new Map();
  for (const s of ses || []) if (!lastConn.has(s.user_id)) lastConn.set(s.user_id, s);   // la más reciente de cada uno
  clocked = !S.isAdmin && !!presence.get(S.user?.id)?.online;   // la verdad la tiene el servidor
  renderConectados(); renderPayos(); fillHours(); updateClockUI();
}

// fichaje manual: sin fichar no cuentas horas ni sales como conectado
export let clocked = false, localStart = null;   // localStart: entrada según este navegador, por si la lectura falla
export async function ping() {
  if (!clocked) return;
  const { data, error } = await db.rpc("clock_ping");
  if (!error && data === false) { clocked = false; updateClockUI(); toast("Tu fichaje caducó. Ficha de nuevo.", true); }
}
export async function toggleClock() {
  if (S.isAdmin) return;
  document.querySelectorAll(".clock-toggle").forEach((b) => (b.disabled = true));
  const { error } = await db.rpc(clocked ? "clock_out" : "clock_in");
  document.querySelectorAll(".clock-toggle").forEach((b) => (b.disabled = false));
  if (error) return toast(error.message, true);
  const was = clocked;
  clocked = !was; localStart = clocked ? new Date().toISOString() : null;
  updateClockUI();   // la interfaz cambia al instante; luego se concilia con el servidor
  toast(was ? `Salida registrada a las ${hhmm(Date.now())}` : `Entrada registrada a las ${hhmm(localStart)}`, false, true);
  await loadPresence();
}
export function updateClockUI() {
  const on = clocked, start = presence.get(S.user?.id)?.session_start || (on ? localStart : null), live = on && start;
  document.querySelectorAll(".clock-toggle").forEach((b) => {
    b.classList.toggle("on", on); b.classList.toggle("hidden", S.isAdmin); b.setAttribute("aria-pressed", on);
    if (b.dataset.full) { b.classList.toggle("danger", on); b.classList.toggle("primary", !on); }
    // barra superior: al fichar pasa de «Fichar» a un cronómetro en marcha
    b.querySelector(".clock-label").innerHTML = b.dataset.full ? (on ? "Fichar salida" : "Fichar entrada") : (on ? `<span class="lbl">Fichar salida</span>${live ? `<span class="clock-mini">${clockSpan(start)}</span>` : ""}` : "Fichar entrada");
  });
  const card = $("clockCard");
  card.classList.toggle("hidden", S.isAdmin); card.classList.toggle("on", on);
  $("clockDot").classList.toggle("on", on);
  $("clockState").textContent = live ? `Fichado · entrada a las ${hhmm(start)}` : on ? "Fichado" : "Sin fichar";
  $("clockBig").classList.toggle("hidden", !live);
  $("clockBig").innerHTML = live ? clockSpan(start) : "";
  const total = presence.get(S.user?.id)?.total_seconds;
  $("clockTotal").textContent = total ? `Horas jugadas: ${fmtDur(total)}` : "Aún sin horas";
}
export function fillHours() {
  if (S.user && $("pHours")) $("pHours").textContent = fmtDur(presence.get(S.user.id)?.total_seconds || 0);
}
export const lastTs = (p) => { const s = lastConn.get(p.user_id); return s ? new Date(s.ended_at || s.last_seen).getTime() : 0; };
export function renderConectados() {
  const others = S.players.filter((p) => p.user_id !== S.user?.id);   // lo tuyo va aparte, arriba
  const on = others.filter((p) => presence.get(p.user_id)?.online);
  const off = others.filter((p) => !presence.get(p.user_id)?.online).sort((x, y) => lastTs(y) - lastTs(x));
  $("cntOnline").textContent = on.length;
  $("onlineList").innerHTML = on.length ? on.map((p) => `<div class="friend online-row">
      ${playerIcon(p.profiles)}<span class="fname">${esc(p.profiles?.display_name || "???")}</span>
      <span class="since">lleva <b>${clockSpan(presence.get(p.user_id).session_start)}</b></span>
    </div>`).join("") : `<div class="empty-state"><span>Nadie más conectado ahora mismo.</span></div>`;
  $("recentList").innerHTML = off.map((p) => {
    const s = lastConn.get(p.user_id);
    const info = s ? `hace ${fmtAgo(Date.now() - lastTs(p))} · duró ${fmtDur((new Date(s.last_seen) - new Date(s.started_at)) / 1000)}` : "Nunca se ha conectado";
    return `<div class="friend online-row off">${playerIcon(p.profiles)}<span class="fname">${esc(p.profiles?.display_name || "???")}</span><span class="since">${info}</span></div>`;
  }).join("");
}

export function resetPresence() { presence = new Map(); }
