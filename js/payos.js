import { MEDALS, BANNERS } from "./config.js";
import { $, S, SVG, avatarSrc, bannerHTML, bannerOf, byId, confetti, countMedals, db, emptyState, esc, hasMedal, isPhoto, medalImg, playerIcon, sprite, toast } from "./core.js";
import { presence } from "./presence.js";
import { medalsHTML, monCard, monCardRO, wireMons } from "./mons.js";
import { setBanner } from "./perfil.js";
import { reload } from "./data.js";

// banner sin título fijo: muestra la frase del jugador (si la hay)

// Payos: todas las cuentas; clic en una abre su perfil
export function renderPayos() {
  $("friends").innerHTML = S.players.map((pl) => {
    const prof = pl.profiles || { display_name: "???", color: "#888" };
    const es = S.entries.filter((e) => e.user_id === pl.user_id);
    const dead = es.filter((e) => e.status === "dead").length;
    const team = es.filter((e) => e.status === "team");
    const chips = team.map((e) =>
      `<img src="${sprite(e.pokemon_id)}" alt="${esc(e.nickname || byId.get(e.pokemon_id)?.es || "")}" title="${esc(e.nickname || byId.get(e.pokemon_id)?.es || "")}" loading="lazy" onerror="this.style.display='none'">`).join("")
      || `<span class="muted">Sin equipo</span>`;
    const av = avatarSrc(prof.avatar);
    const bigAv = av
      ? `<img class="favatar${isPhoto(prof.avatar) ? " photo" : ""}" src="${av}" alt="" loading="lazy" onerror="this.outerHTML='<span class=&quot;favatar dot-av&quot;></span>'">`
      : `<span class="favatar dot-av"></span>`;
    return `<div class="friend ${pl.user_id === S.user.id ? "me-card" : ""}" data-user="${pl.user_id}">
      <button type="button" class="friend-open" aria-label="Ver perfil de ${esc(prof.display_name)}"></button>
      ${bannerHTML(prof)}
      ${bigAv}
      <div class="fname"><span class="online-dot${presence.get(pl.user_id)?.online ? " on" : ""}" role="img" aria-label="${presence.get(pl.user_id)?.online ? "Conectado" : "Desconectado"}" title="${presence.get(pl.user_id)?.online ? "Conectado" : "Desconectado"}"></span>${esc(prof.display_name)}</div>
      <div class="stats">
        <span class="alive"><b>${es.length - dead}</b> vivos</span>
        <span class="fallen"><b>${dead}</b> caídos</span>
      </div>
      <div class="medals-view">${medalsHTML(pl.badges)}</div>
      <div class="team">${chips}</div>
    </div>`;
  }).join("");
  $("friends").querySelectorAll(".friend").forEach((c) => (c.onclick = () => openPayo(c.dataset.user)));
}

export function openPayo(uid) {
  const pl = S.players.find((p) => p.user_id === uid);
  if (!pl) return;
  S.payoUid = uid;
  const admin = $("payoAdmin");
  admin.classList.toggle("hidden", !S.isAdmin);
  if (S.isAdmin) {
    const name = pl.profiles?.display_name || "";
    admin.innerHTML = `<input id="payoRename" maxlength="20" value="${esc(name)}" aria-label="Nombre visible">
      <button type="button" class="btn ghost" id="payoRenameBtn">Renombrar</button>
      <select id="payoBannerSel" aria-label="Banner">${BANNERS.map((b) => `<option value="${b.id}">${esc(b.name)}</option>`).join("")}</select>
      <button type="button" class="btn danger" id="payoDelBtn">Eliminar usuario</button>`;
    $("payoBannerSel").value = bannerOf(pl.profiles).id;
    $("payoBannerSel").onchange = (e) => setBanner(uid, e.target.value);
    $("payoRenameBtn").onclick = () => renamePlayer(uid);
    $("payoDelBtn").onclick = () => deletePlayer(uid);
  }
  fillPayo(pl);
  $("payoDialog").showModal();
}
// repinta el modal (también con cambios en vivo); el bloque admin no se toca para no perder lo escrito
export function refreshPayo() {
  if (!$("payoDialog").open || !S.payoUid) return;
  const pl = S.players.find((p) => p.user_id === S.payoUid);
  if (!pl) return $("payoDialog").close();   // la cuenta ya no existe
  fillPayo(pl);
}
export function fillPayo(pl) {
  const prof = pl.profiles || { display_name: "???" };
  const es = S.entries.filter((e) => e.user_id === pl.user_id);
  const sect = (icon, title, st) => {
    const arr = es.filter((e) => e.status === st);
    return `<h4>${icon} ${title} <span class="count">${arr.length}</span></h4>
      <div class="list">${arr.map(S.isAdmin ? monCard : monCardRO).join("") || emptyState(st)}</div>`;
  };
  $("payoName").innerHTML = `${playerIcon(prof)}${esc(prof.display_name)}`;
  $("payoBanner").innerHTML = bannerHTML(prof, "payo-banner");
  if (S.isAdmin) { $("payoMedals").innerHTML = medalTilesHTML(pl.badges); wireMedalTiles($("payoMedals"), pl); }
  else $("payoMedals").innerHTML = medalsHTML(pl.badges);
  $("payoBody").innerHTML = sect(SVG.team, "Equipo", "team") + sect(SVG.box, "Caja", "box") + sect(SVG.dead, "Cementerio", "dead");
  if (S.isAdmin) wireMons($("payoBody"));
}
export async function renamePlayer(uid) {
  const name = $("payoRename").value.trim();
  if (!name) return toast("Escribe un nombre", true);
  const { error } = await db.from("profiles").update({ display_name: name }).eq("id", uid);
  if (error) return toast(error.message, true);
  toast("Nombre cambiado", false, true);
  await reload();
}
export async function deletePlayer(uid) {
  const name = S.players.find((p) => p.user_id === uid)?.profiles?.display_name || "este usuario";
  if (!confirm(`¿Eliminar a ${name}? Se borran su cuenta y todos sus Pokémon. No se puede deshacer.`)) return;
  const { error } = await db.rpc("admin_delete_user", { uid });
  if (error) return toast(error.message, true);
  $("payoDialog").close();
  toast("Usuario eliminado", false, true);
  await reload();
}

// fichas de medalla seleccionables una a una (Perfil propio y, para el admin, las de cualquier payo)
export function medalTilesHTML(mask) {
  const tiles = MEDALS.map((m, k) => {
    const on = hasMedal(mask, k + 1);
    return `<button type="button" class="medal-tile ${on ? "on" : ""}" data-n="${k + 1}" aria-pressed="${on}" title="Medalla ${esc(m.name)}">
      <img src="${medalImg(m)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'"><span>${esc(m.name)}</span></button>`;
  }).join("");
  return `<div class="medals-head"><span class="medals-count"><b>${countMedals(mask)}</b>/${MEDALS.length}</span></div><div class="medal-grid">${tiles}</div>`;
}
export function wireMedalTiles(root, pl) {
  root.querySelectorAll(".medal-tile").forEach((b) => (b.onclick = () => toggleMedal(pl, +b.dataset.n, root)));
}
export function renderMedalsEdit() {
  if (!S.myPlayer) return;
  $("medalsEdit").innerHTML = `<h3>Medallas</h3>` + medalTilesHTML(S.myPlayer.badges);
  wireMedalTiles($("medalsEdit"), S.myPlayer);
}

export async function toggleMedal(pl, i, root) {
  const prev = pl.badges || 0, next = prev ^ (1 << (i - 1));
  const redraw = () => { renderMedalsEdit(); renderPayos(); refreshPayo(); };
  pl.badges = next;
  redraw();
  if (next > prev) {
    confetti();
    root.querySelector(`.medal-tile[data-n="${i}"]`)?.classList.add("just-on");
  }
  const { error } = await db.from("players").update({ badges: next }).eq("id", pl.id);
  if (error) { pl.badges = prev; redraw(); toast(error.message, true); }
}
