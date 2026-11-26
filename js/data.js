import { $, S, db, esc, playerIcon } from "./core.js";
import { renderRoutes } from "./rutas.js";
import { renderGraveyard, renderMyColumns } from "./mons.js";
import { refreshPayo, renderMedalsEdit, renderPayos } from "./payos.js";
import { renderConectados } from "./presence.js";
import { renderBannerGrid } from "./perfil.js";

let hasBanner = true, channel = null, rsChannel = null, pfChannel = null;

// ===================== datos + render =====================
export async function reload() {
  const qPlayers = (withBanner) => db.from("players").select(`id, user_id, badges, profiles(display_name, color, avatar${withBanner ? ", banner" : ""})`).eq("run_id", S.run.id).order("created_at");
  let [plr, { data: en }, { data: rs }] = await Promise.all([
    qPlayers(hasBanner),
    db.from("entries").select().eq("run_id", S.run.id).order("created_at"),
    db.from("route_status").select("user_id,route,status"),   // si routes.sql aún no está aplicado, error → vacío
  ]);
  if (plr.error && hasBanner) { hasBanner = false; plr = await qPlayers(false); }   // banners.sql aún no aplicado
  if (!S.user || !S.run) return;   // se cerró sesión mientras cargaba
  const pl = plr.data;
  S.players = pl || []; S.entries = en || []; S.routeStatus = rs || [];
  S.myPlayer = S.players.find((p) => p.user_id === S.user.id) || S.myPlayer;
  const mp = S.players.find((p) => p.user_id === S.user.id);
  if (mp?.profiles) S.profile = mp.profiles;
  render();
}

export function subscribe() {
  channel?.unsubscribe();
  channel = db.channel(`run-${S.run.id}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "entries", filter: `run_id=eq.${S.run.id}` }, onRealtime)
    .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `run_id=eq.${S.run.id}` }, onRealtime)
    .subscribe();
  rsChannel?.unsubscribe();
  pfChannel?.unsubscribe();
  pfChannel = db.channel("profiles-ch").on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, onRealtime).subscribe();
  rsChannel = db.channel("route-status").on("postgres_changes", { event: "*", schema: "public", table: "route_status" }, onRealtime).subscribe();
}

// cambio en vivo: destello del punto rojo + recarga
export function onRealtime() {
  const dot = $("liveDot");
  if (dot) { dot.classList.remove("on"); void dot.offsetWidth; dot.classList.add("on"); }
  reload();
}

export function render() {
  $("userChip").innerHTML = `${playerIcon(S.profile)}<span class="uname">${esc(S.profile.display_name)}</span>`;
  $("menuProfile").classList.toggle("hidden", S.isAdmin);
  $("meChip").innerHTML = `${playerIcon(S.profile)}${esc(S.profile.display_name)}`;
  renderRoutes();
  renderMyColumns();
  renderPayos();
  renderConectados();
  renderGraveyard();
  renderMedalsEdit();
  renderBannerGrid();
  refreshPayo();
}

export function unsubscribeAll() { channel?.unsubscribe(); rsChannel?.unsubscribe(); pfChannel?.unsubscribe(); }
