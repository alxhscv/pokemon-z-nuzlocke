import { ROUTES, ROUTE_ZONES } from "./config.js";
import { $, ROUTE_NORMS, S, byId, db, esc, normLoc, playerIcon, sprite, toast } from "./core.js";
import { openDialog } from "./dialog.js";

// ---- Rutas: estados por casilla (pendiente / sin encuentro / fallido / capturado), zonas, progreso, filtros ----
export const ST_LABEL = { pending: "Pendiente", none: "Sin encuentro", failed: "Fallido", captured: "Capturado" };
export const ST_ICON = {   // Pokéball: vacía (pendiente) · tachada (sin encuentro) · rota (fallido)
  pending: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h6M15 12h6"/><circle cx="12" cy="12" r="3"/></svg>`,
  none: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h6M15 12h6"/><circle cx="12" cy="12" r="3"/><path d="M5 19L19 5" stroke-width="2.6"/></svg>`,
  failed: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3.2 10A9 9 0 0111 3.1L10 8l3 2-2 3"/><path d="M21 14a9 9 0 01-8.2 7l.7-4.5-3-2 2.3-2.5M3.3 14H8"/><path d="M16 10h5"/></svg>`,
};
export let routeFilter = "all", onlyMine = false;
export const collapsedZones = new Set();
export function cellState(uid, route) {
  const es = S.entries.filter((e) => e.user_id === uid && normLoc(e.location) === normLoc(route));
  if (es.length) return { st: "captured", es };
  const r = S.routeStatus.find((x) => x.user_id === uid && normLoc(x.route) === normLoc(route));
  return { st: r?.status || "pending", es };
}
export const routesDone = (uid, list = ROUTES) => list.filter((r) => cellState(uid, r).st !== "pending").length;

export function renderRoutes() {
  const cols = onlyMine && !S.isAdmin ? S.players.filter((p) => p.user_id === S.user.id) : S.players;
  const extras = [];
  const seen = new Set();
  for (const e of S.entries) {
    const n = normLoc(e.location);
    if (e.location && !ROUTE_NORMS.has(n) && !seen.has(n)) { seen.add(n); extras.push(e.location.trim()); }
  }
  if (S.entries.some((e) => !e.location)) extras.push("");   // registrados sin zona (botón «Registrar»)
  const zones = [...ROUTE_ZONES, ...(extras.length ? [["Otras zonas", extras]] : [])];

  // progreso del grupo + filtros
  const total = ROUTES.length, done = S.players.reduce((n, p) => n + routesDone(p.user_id), 0), max = S.players.length * total;
  const pct = max ? Math.round((done / max) * 100) : 0;
  const chip = (k, l) => `<button type="button" class="chip${routeFilter === k ? " on" : ""}" data-rf="${k}" aria-pressed="${routeFilter === k}">${l}</button>`;
  $("routesBar").innerHTML = `<div class="rprogress"><span>Progreso del grupo <b>${pct}%</b></span><div class="bar" role="progressbar" aria-label="Progreso del grupo" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div></div>
    <div class="rfilters" role="group" aria-label="Filtros">${chip("all", "Todas")}${chip("pending", "Pendientes")}${chip("failed", "Fallidas")}
    ${S.isAdmin ? "" : `<button type="button" class="chip${onlyMine ? " on" : ""}" data-mine="1" aria-pressed="${onlyMine}">Solo mías</button>`}</div>`;
  $("routesBar").querySelectorAll("[data-rf]").forEach((b) => (b.onclick = () => { routeFilter = b.dataset.rf; renderRoutes(); }));
  $("routesBar").querySelector("[data-mine]")?.addEventListener("click", () => { onlyMine = !onlyMine; renderRoutes(); });

  const head = `<thead><tr><th scope="col" class="rcorner">Ruta</th>${cols.map((pl) => {
    const prof = pl.profiles || {};
    const mine = pl.user_id === S.user.id, d = routesDone(pl.user_id);
    return `<th scope="col" class="${mine ? "mine" : ""}">
      <div class="rhead"><span class="band"></span><div class="rhead-inner">${playerIcon(prof)}<span>${esc(prof.display_name || "???")}</span></div>
      <small class="rprog">${d}/${total}</small><div class="bar mini" aria-hidden="true"><i style="width:${total ? (d / total) * 100 : 0}%"></i></div></div></th>`;
  }).join("")}</tr></thead>`;

  const keep = (r) => {
    if (routeFilter === "pending") return S.isAdmin ? cols.some((p) => cellState(p.user_id, r).st === "pending") : cellState(S.user.id, r).st === "pending";
    if (routeFilter === "failed") return cols.some((p) => cellState(p.user_id, r).st === "failed");
    return true;
  };
  const current = S.isAdmin ? null : ROUTES.find((r) => cellState(S.user.id, r).st === "pending");   // tu siguiente ruta
  const subject = S.isAdmin ? null : S.user.id;

  const body = zones.map(([zname, zroutes]) => {
    const rows = zroutes.filter(keep);
    if (!rows.length) return "";
    const open = !collapsedZones.has(zname);
    const zd = subject ? `<span class="zprog">${routesDone(subject, zroutes)}/${zroutes.length}</span>` : "";
    const zhead = `<tr class="zone"><th colspan="${cols.length + 1}"><button type="button" class="zbtn" data-zone="${esc(zname)}" aria-expanded="${open}"><span class="caret" aria-hidden="true">${open ? "▾" : "▸"}</span>${esc(zname)}${zd}</button></th></tr>`;
    if (!open) return zhead;
    return zhead + rows.map((route) => {
      const cells = cols.map((pl) => {
        const mine = pl.user_id === S.user.id;
        const { st, es } = cellState(pl.user_id, route);
        const addable = mine || S.isAdmin;
        const content = st === "captured" ? es.map((e) => {
          const nm = e.nickname || byId.get(e.pokemon_id)?.es || "";
          const tag = addable ? `button type="button" aria-label="Editar ${esc(nm)}"` : "span";
          return `<${tag} class="rmon ${e.status}" data-id="${e.id}" title="${esc(nm)}">
            <img src="${sprite(e.pokemon_id)}" alt="" width="42" height="42" loading="lazy" onerror="this.style.visibility='hidden'"><em>${esc(nm)}</em></${addable ? "button" : "span"}>`;
        }).join("") : addable
          ? `<button type="button" class="cs ${st}" title="${ST_LABEL[st]}" aria-label="${esc(route) || "Sin zona"}: ${ST_LABEL[st]}">${ST_ICON[st]}<em>${ST_LABEL[st]}</em></button>`
          : `<span class="cs ${st}" title="${ST_LABEL[st]}">${ST_ICON[st]}<em>${ST_LABEL[st]}</em></span>`;
        return `<td class="c-${st} ${addable ? "addable" : ""}" data-route="${esc(route)}" data-user="${pl.user_id}">${content}</td>`;
      }).join("");
      return `<tr><th scope="row" class="rlabel${route === current ? " current" : ""}">${route === current ? '<span class="here" title="Tu siguiente ruta">›</span>' : ""}${esc(route) || "Sin zona"}</th>${cells}</tr>`;
    }).join("");
  }).join("");

  $("routesTable").innerHTML = head + `<tbody>${body || `<tr><td class="empty-row" colspan="${cols.length + 1}">No hay rutas con este filtro.</td></tr>`}</tbody>`;

  $("routesTable").querySelectorAll(".zbtn").forEach((b) => (b.onclick = () => {
    collapsedZones.has(b.dataset.zone) ? collapsedZones.delete(b.dataset.zone) : collapsedZones.add(b.dataset.zone);
    renderRoutes();
  }));
  // editar un Pokémon propio desde su celda
  $("routesTable").querySelectorAll(".rmon").forEach((el) => (el.onclick = (ev) => {
    ev.stopPropagation(); openDialog(S.entries.find((e) => e.id === el.dataset.id));
  }));
  // clic en una casilla propia → elegir estado o registrar captura
  $("routesTable").querySelectorAll("td.addable").forEach((td) => (td.onclick = (ev) => {
    if (ev.target.closest(".rmon")) return;
    td.dataset.route ? openCell(td.dataset.route, td.dataset.user)
      : openDialog(null, "", S.players.find((p) => p.user_id === td.dataset.user));
  }));
}

export let cellCtx = null;
export function openCell(route, uid) {
  const pl = S.players.find((p) => p.user_id === uid);
  if (!pl) return;
  const { st, es } = cellState(uid, route);
  cellCtx = { route, uid, pl };
  $("cellTitle").textContent = route;
  $("cellWho").textContent = `${uid === S.user.id ? "Tu casilla" : "Casilla de " + (pl.profiles?.display_name || "???")} · ${ST_LABEL[st]}`;
  document.querySelectorAll("#cellDialog [data-act]").forEach((b) => {
    const act = b.dataset.act;
    b.disabled = es.length > 0 && (act === "none" || act === "failed");   // con captura no tiene sentido marcarla sin encuentro/fallida
    b.classList.toggle("sel", act === st);
  });
  $("cellDialog").showModal();
}
export async function cellAction(act) {
  const { route, uid, pl } = cellCtx;
  if (act === "capture") { $("cellDialog").close(); return openDialog(null, route, pl); }
  const { error } = act === "pending"
    ? await db.from("route_status").delete().eq("user_id", uid).eq("route", route)
    : await db.from("route_status").upsert({ user_id: uid, route, status: act }, { onConflict: "user_id,route" });
  if (error) return toast(error.message, true);
  $("cellDialog").close();
}
