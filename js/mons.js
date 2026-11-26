import { MEDALS } from "./config.js";
import { $, S, SVG, byId, db, emptyState, esc, hasMedal, medalImg, sprite, toast } from "./core.js";
import { openDialog } from "./dialog.js";

// Cementerio global: todos los muertos de todos, con dueño, nivel y "último suspiro"
export function renderGraveyard() {
  const dead = S.entries.filter((e) => e.status === "dead");
  if (!dead.length) { $("graveWall").innerHTML = emptyState("dead"); return; }
  const nameOf = (uid) => S.players.find((p) => p.user_id === uid)?.profiles?.display_name || "???";
  $("graveWall").innerHTML = dead.map((e) => {
    const p = byId.get(e.pokemon_id);
    const nick = e.nickname || p?.es || "???";
    const species = e.nickname && p ? p.es : null;
    const mine = e.user_id === S.user.id || S.isAdmin;
    const note = e.notes
      ? `<span class="epitaph">«${esc(e.notes)}»</span>`
      : `<span class="epitaph none">${mine ? "Añade su último suspiro…" : "Sin últimas palabras."}</span>`;
    const tag = mine ? `button type="button" aria-label="Editar ${esc(nick)}"` : "div";
    return `<div class="grave-card ${mine ? "mine" : ""}" data-id="${esc(e.id)}"><${tag} class="grave-body">
      <span class="cross" aria-hidden="true">${SVG.dead}</span>
      <span class="sprite"><img src="${sprite(e.pokemon_id)}" alt="${esc(nick)}" width="72" height="72" loading="lazy" onerror="this.style.visibility='hidden'"></span>
      <span class="gname">${esc(nick)}</span>
      <span class="gmeta">${species ? esc(species) + " · " : ""}de <b>${esc(nameOf(e.user_id))}</b></span>
      ${e.level ? `<span class="glvl">Cayó a Nv. ${e.level}</span>` : ""}
      ${note}
    </${mine ? "button" : "div"}></div>`;
  }).join("");
  // editar las tuyas (apodo, nivel y último suspiro) desde su lápida
  $("graveWall").querySelectorAll(".grave-card.mine").forEach((c) =>
    (c.onclick = () => openDialog(S.entries.find((e) => e.id === c.dataset.id))));
}

export function renderMyColumns() {
  const mine = S.entries.filter((e) => e.user_id === S.user.id);
  for (const st of ["team", "box", "dead"]) {
    const items = mine.filter((e) => e.status === st);
    $("cnt-" + st).textContent = items.length;
    let html = items.map(monCard).join("") || emptyState(st);
    // Equipo: huecos de pokéball hasta 6 (se ve que caben 6)
    if (st === "team" && items.length > 0 && items.length < 6) {
      html += `<div class="team-slots">${'<span class="slot"></span>'.repeat(6 - items.length)}</div>`;
    }
    $("list-" + st).innerHTML = html;
  }
  wireMons($("myColumns"));
}
export function wireMons(root) {
  root.querySelectorAll(".movebtn").forEach((b) =>
    (b.onclick = (ev) => { ev.stopPropagation(); updateStatus(b.dataset.id, b.dataset.move); }));
  root.querySelectorAll(".mon:not(.ro)").forEach((el) =>
    (el.onclick = (ev) => { if (ev.target.closest(".movebtn")) return; openDialog(S.entries.find((e) => e.id === el.dataset.id)); }));
}

// estados a los que se puede mover: icono SVG + etiqueta
export const MOVE = { box: [SVG.box, "A la caja"], team: [SVG.team, "Al equipo"], dead: [SVG.dead, "Al cementerio"] };

// partes comunes de la carta Pokédex (sprite en caja gris + nombre + Nº + Nv.)
export function monMark(e) {
  return e.status === "team" ? `<span class="state-mark pokeball" aria-hidden="true"></span>`
    : e.status === "dead" ? `<span class="state-mark" aria-hidden="true">${SVG.dead}</span>` : "";
}
export function monInner(e) {
  const p = byId.get(e.pokemon_id);
  const name = e.nickname || p?.es || "???";
  const species = e.nickname && p ? p.es : null;
  const sub = [e.location, species].filter(Boolean).join(" · ");
  return `<span class="sprite"><img src="${sprite(e.pokemon_id)}" alt="${esc(name)}" width="48" height="48" loading="lazy" onerror="this.style.visibility='hidden'"></span>
    <span class="info">
      <span class="nick">${esc(name)}</span>
      <span class="sub">${esc(sub) || `<span class="dex">Nº ${String(e.pokemon_id).padStart(3, "0")}</span>`}</span>
    </span>
    ${e.level ? `<span class="lvl">Nv. ${e.level}</span>` : ""}`;
}

export function monCard(e) {
  const moves = ["box", "team", "dead"].filter((s) => s !== e.status).map((s) =>
    `<button type="button" class="movebtn" data-move="${s}" data-id="${e.id}" title="${MOVE[s][1]}" aria-label="${MOVE[s][1]}">${MOVE[s][0]}</button>`).join("");
  const mark = monMark(e);
  return `<div class="mon ${e.status}" data-id="${e.id}">${mark}<button type="button" class="mon-open" aria-label="Editar ${esc(e.nickname || byId.get(e.pokemon_id)?.es || "Pokémon")}">${monInner(e)}</button><div class="moves">${moves}</div></div>`;
}

// tarjeta solo-lectura (para ver el equipo de otro payo)
export function monCardRO(e) {
  return `<div class="mon ro ${e.status}">${monMark(e)}<div class="mon-open">${monInner(e)}</div></div>`;
}

export async function updateStatus(id, status) {
  const { error } = await db.from("entries").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return toast(error.message, true);
}

// medallas visuales (solo lectura): las conseguidas en color, el resto en gris
export function medalsHTML(mask) {
  return MEDALS.map((m, k) => {
    const on = hasMedal(mask, k + 1);
    return `<span class="medal ${on ? "on" : "off"}" title="Medalla ${esc(m.name)}${on ? " ✓" : ""}" aria-label="Medalla ${esc(m.name)} ${on ? "conseguida" : "pendiente"}"><img src="${medalImg(m)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'"></span>`;
  }).join("");
}
