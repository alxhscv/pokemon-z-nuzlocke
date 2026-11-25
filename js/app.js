import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.0/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY, ROUTES, MEDALS } from "./config.js";

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const sprite = (id) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
const $ = (id) => document.getElementById(id);

// iconos SVG (presentación; sustituyen a los emojis)
const SVG = {
  box: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 4v5"/></svg>`,
  team: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h6M15 12h6"/><circle cx="12" cy="12" r="3"/></svg>`,
  dead: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 21V10a6 6 0 0112 0v11z"/><path d="M12 7v5M9.5 9.5h5"/></svg>`,
};
// estados de vacío con ilustración + texto con gracia
const EMPTY = {
  team: ["M5 3l4 4M19 3l-4 4M4 8h16l-1.5 11a2 2 0 01-2 1.7H7.5a2 2 0 01-2-1.7z", "Tu equipo está vacío. ¡A la hierba alta!"],
  box: ["M3 4h18v5H3zM3 9h18v11H3zM10 13h4", "La caja está vacía. De momento."],
  dead: ["M6 21V10a6 6 0 0112 0v11z|M12 7v5M9.5 9.5h5", "El cementerio está vacío. Que siga así."],
};
function emptyState(st) {
  const [d, txt] = EMPTY[st] || ["", "Nada por aquí."];
  const paths = d.split("|").map((p) => `<path d="${p}"/>`).join("");
  return `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" aria-hidden="true">${paths}</svg><span>${txt}</span></div>`;
}

// color de jugador: ahora fijo (verde Zygarde) para todos
const GREEN = "#2BB673";
// medallas: `players.badges` es una máscara de bits (bit i-1 = medalla i), así se marcan sueltas
const medalImg = (m) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/${m.img}.png`;
const hasMedal = (mask, i) => ((mask || 0) >> (i - 1)) & 1;
const countMedals = (mask) => MEDALS.reduce((n, _, k) => n + hasMedal(mask, k + 1), 0);
// avatar: un número = Pokémon por id; cualquier otra cosa = URL de imagen
function avatarSrc(av) { if (av == null || av === "") return null; av = String(av); return /^\d+$/.test(av) ? sprite(av) : esc(av); }  // URL escapada: se interpola en atributos HTML
function isPhoto(av) { return av != null && av !== "" && !/^\d+$/.test(String(av)); }
const uname2email = (u) => u.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "") + "@users.pokez";
const normLoc = (s) => (s || "").trim().toLowerCase();
const ROUTE_NORMS = new Set(ROUTES.map(normLoc));

// ---- estado ----
let POKE = [];
const byId = new Map(), byName = new Map();
let user = null, profile = null, run = null, myPlayer = null;
let players = [], entries = [], channel = null, signupMode = false;
let currentLoc = null;   // zona del Pokémon en edición (viene de la celda de ruta; ya no hay campo)

init();
async function init() {
  POKE = await fetch("data/pokemon.json").then((r) => r.json());
  for (const p of POKE) { byId.set(p.id, p); byName.set(p.es.toLowerCase(), p.id); byName.set(p.en.toLowerCase(), p.id); }
  $("pokeList").innerHTML = POKE.map((p) => `<option value="${p.es}">`).join("");
  wireEvents();
  db.auth.onAuthStateChange((event) => { if (event === "SIGNED_OUT") resetToAuth(); });
  const { data } = await db.auth.getSession();
  data.session ? afterLogin() : showAuth();
}

function wireEvents() {
  $("authSubmit").onclick = doAuth;
  $("authPass").onkeydown = $("authUser").onkeydown = (e) => { if (e.key === "Enter") doAuth(); };
  $("switchMode").onclick = (e) => { e.preventDefault(); toggleAuthMode(); };
  $("authAvatar").oninput = updateAuthAvatarPreview;
  $("logoutBtn").onclick = () => db.auth.signOut();
  $("userChip").onclick = $("meChip").onclick = () => selectTab("perfil");
  $("themeToggle").onclick = toggleTheme;
  applyThemeIcon();
  const tabs = [...document.querySelectorAll(".tab")];
  tabs.forEach((b, i) => {
    b.onclick = () => selectTab(b.dataset.tab);
    b.onkeydown = (e) => {
      const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      const n = tabs[(i + d + tabs.length) % tabs.length];
      n.focus(); selectTab(n.dataset.tab);
    };
  });
  $("addBtn").onclick = () => openDialog();
  $("cancelBtn").onclick = () => $("entryDialog").close();
  $("deleteBtn").onclick = deleteEntry;
  $("entryForm").onsubmit = (e) => { e.preventDefault(); saveEntry(); };
  $("fPokemon").oninput = updatePreview;
  $("pClear").onclick = () => { $("pAvatar").value = ""; $("pAvatarUrl").value = ""; updateAvatarPreview(); };
  $("pAvatar").oninput = updateAvatarPreview;
  $("pAvatarUrl").oninput = updateAvatarPreview;
  $("profileForm").onsubmit = (e) => { e.preventDefault(); saveProfile(); };
  $("payoClose").onclick = () => $("payoDialog").close();
}

// pestañas
function selectTab(name) {
  document.querySelectorAll(".tab").forEach((b) => {
    const on = b.dataset.tab === name;
    b.classList.toggle("active", on);
    b.setAttribute("aria-selected", on ? "true" : "false");
  });
  document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", p.id === "panel-" + name));
  if (name === "perfil") fillProfile();
}

// tema claro/oscuro (botón + prefers-color-scheme por defecto)
function currentTheme() {
  const set = document.documentElement.getAttribute("data-theme");
  if (set) return set;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
function toggleTheme() {
  const next = currentTheme() === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  try { localStorage.setItem("theme", next); } catch (e) {}
  applyThemeIcon();
}
function applyThemeIcon() {
  const dark = currentTheme() === "dark";
  document.querySelector(".icon-moon")?.classList.toggle("hidden", dark);
  document.querySelector(".icon-sun")?.classList.toggle("hidden", !dark);
  $("themeToggle")?.setAttribute("aria-label", dark ? "Cambiar a tema claro" : "Cambiar a tema oscuro");
}

// confeti dorado (medalla nueva)
function confetti() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const box = document.createElement("div");
  box.className = "confetti";
  for (let i = 0; i < 24; i++) {
    const c = document.createElement("i");
    c.style.left = Math.random() * 100 + "%";
    c.style.background = i % 3 ? "var(--gold)" : "var(--red)";
    c.style.animationDelay = Math.random() * .2 + "s";
    c.style.borderRadius = i % 2 ? "50%" : "2px";
    box.appendChild(c);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 1400);
}

// skeletons mientras carga Supabase
function showSkeletons() {
  const sk = `<div class="skel skel-mon"></div>`.repeat(3);
  for (const st of ["team", "box", "dead"]) $("list-" + st).innerHTML = sk;
}

// avatar del jugador: sprite/imagen si tiene avatar, si no un punto verde
function playerIcon(prof) {
  const src = avatarSrc(prof?.avatar);
  const dot = `<span class="dot" style="background:${GREEN}"></span>`;
  if (src) return `<img class="avatar${isPhoto(prof.avatar) ? " photo" : ""}" src="${src}" alt="" loading="lazy" onerror="this.outerHTML='<span class=&quot;dot&quot; style=&quot;background:${GREEN}&quot;></span>'">`;
  return dot;
}

// ===================== auth =====================
function showAuth() { signupMode = false; applyAuthMode(); $("userInfo").classList.add("hidden"); show("auth"); }
function toggleAuthMode() { signupMode = !signupMode; applyAuthMode(); }
function applyAuthMode() {
  $("authTitle").textContent = signupMode ? "Crear cuenta" : "Iniciar sesión";
  $("authSub").textContent = signupMode ? "Elige usuario, contraseña y tu avatar." : "Entra con tu usuario y contraseña.";
  $("authSubmit").textContent = signupMode ? "Crear cuenta" : "Entrar";
  $("switchText").textContent = signupMode ? "¿Ya tienes cuenta?" : "¿No tienes cuenta?";
  $("switchMode").textContent = signupMode ? "Inicia sesión" : "Crear una";
  $("avatarField").classList.toggle("hidden", !signupMode);
  $("authAvatarPreview").classList.toggle("hidden", !signupMode);
  if (signupMode) updateAuthAvatarPreview();
}
function updateAuthAvatarPreview() {
  const id = byName.get($("authAvatar").value.trim().toLowerCase());
  $("authAvatarPreview").innerHTML = id
    ? `<img src="${sprite(id)}" alt=""><span>${esc(byId.get(id).es)}</span>`
    : `<span>Elige un Pokémon como avatar (opcional)</span>`;
}

async function doAuth() {
  const uname = $("authUser").value.trim();
  const pass = $("authPass").value;
  if (!uname) return toast("Escribe un usuario", true);
  if (pass.length < 6) return toast("La contraseña necesita al menos 6 caracteres", true);
  const email = uname2email(uname);
  $("authSubmit").disabled = true;
  try {
    if (signupMode) {
      const { data, error } = await db.auth.signUp({ email, password: pass });
      if (error) return toast(traduceAuth(error.message), true);
      if (!data.session) return toast("Cuenta creada, ahora inicia sesión", true);
      const pid = byName.get($("authAvatar").value.trim().toLowerCase());
      await db.from("profiles").upsert({ id: data.user.id, display_name: uname, color: GREEN, avatar: pid ? String(pid) : null });
    } else {
      const { error } = await db.auth.signInWithPassword({ email, password: pass });
      if (error) return toast(traduceAuth(error.message), true);
    }
    await afterLogin();
  } finally { $("authSubmit").disabled = false; }
}

function traduceAuth(m) {
  if (/already registered/i.test(m)) return "Ese usuario ya existe";
  if (/Invalid login/i.test(m)) return "Usuario o contraseña incorrectos";
  if (/at least/i.test(m)) return "La contraseña es demasiado corta";
  return m;
}

async function afterLogin() {
  const { data } = await db.auth.getUser();
  user = data.user;
  if (!user) { await db.auth.signOut(); return showAuth(); }   // sesión caducada/ inválida → al login
  let { data: prof } = await db.from("profiles").select().eq("id", user.id).maybeSingle();
  if (!prof) ({ data: prof } = await db.from("profiles").insert({ id: user.id, display_name: user.email.split("@")[0] }).select().single());
  profile = prof;
  $("userInfo").classList.remove("hidden");
  // run única compartida
  const { data: r } = await db.from("runs").select().limit(1).maybeSingle();
  if (!r) return toast("La partida no está creada en la base de datos", true);
  await enterRun(r);
}

function resetToAuth() {
  channel?.unsubscribe();
  user = profile = run = myPlayer = null; players = []; entries = [];
  showAuth();
}

async function enterRun(r) {
  run = r;
  $("runName").textContent = r.name;
  // unirse (insert idempotente): el upsert ON CONFLICT falla con RLS cuando aún no eres miembro
  // (la policy SELECT de players es is_member()); el insert normal pasa y el duplicado (23505) se ignora.
  const { error: joinErr } = await db.from("players").insert({ run_id: r.id, user_id: user.id });
  if (joinErr && joinErr.code !== "23505") return toast("No se pudo entrar en la partida", true);
  const { data: mine } = await db.from("players").select().eq("run_id", r.id).eq("user_id", user.id).maybeSingle();
  if (!mine) return toast("No se pudo entrar en la partida", true);
  myPlayer = mine;
  show("app");
  showSkeletons();
  await reload();
  subscribe();
}

// ===================== datos + render =====================
async function reload() {
  const [{ data: pl }, { data: en }] = await Promise.all([
    db.from("players").select("id, user_id, badges, profiles(display_name, color, avatar)").eq("run_id", run.id).order("created_at"),
    db.from("entries").select().eq("run_id", run.id).order("created_at"),
  ]);
  players = pl || []; entries = en || [];
  myPlayer = players.find((p) => p.user_id === user.id) || myPlayer;
  const mp = players.find((p) => p.user_id === user.id);
  if (mp?.profiles) profile = mp.profiles;
  render();
}

function subscribe() {
  channel?.unsubscribe();
  channel = db.channel(`run-${run.id}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "entries", filter: `run_id=eq.${run.id}` }, onRealtime)
    .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `run_id=eq.${run.id}` }, onRealtime)
    .subscribe();
}

// cambio en vivo: destello del punto verde + recarga
function onRealtime() {
  const dot = $("liveDot");
  if (dot) { dot.classList.remove("on"); void dot.offsetWidth; dot.classList.add("on"); }
  reload();
}

function render() {
  $("userChip").innerHTML = `${playerIcon(profile)}${esc(profile.display_name)}`;
  $("meChip").innerHTML = `${playerIcon(profile)}${esc(profile.display_name)}`;
  renderRoutes();
  renderMyColumns();
  renderPayos();
  renderGraveyard();
  renderMedalsEdit();
}

// Cementerio global: todos los muertos de todos, con dueño, nivel y "último suspiro"
function renderGraveyard() {
  const dead = entries.filter((e) => e.status === "dead");
  if (!dead.length) { $("graveWall").innerHTML = emptyState("dead"); return; }
  const nameOf = (uid) => players.find((p) => p.user_id === uid)?.profiles?.display_name || "???";
  $("graveWall").innerHTML = dead.map((e) => {
    const p = byId.get(e.pokemon_id);
    const nick = e.nickname || p?.es || "???";
    const species = e.nickname && p ? p.es : null;
    const mine = e.user_id === user.id;
    const note = e.notes
      ? `<div class="epitaph">«${esc(e.notes)}»</div>`
      : `<div class="epitaph none">${mine ? "Añade su último suspiro…" : "Sin últimas palabras."}</div>`;
    return `<div class="grave-card ${mine ? "mine" : ""}" data-id="${esc(e.id)}">
      <span class="cross">${SVG.dead}</span>
      <span class="sprite"><img src="${sprite(e.pokemon_id)}" alt="${esc(nick)}" width="72" height="72" loading="lazy" onerror="this.style.visibility='hidden'"></span>
      <div class="gname">${esc(nick)}</div>
      <div class="gmeta">${species ? esc(species) + " · " : ""}de <b>${esc(nameOf(e.user_id))}</b></div>
      ${e.level ? `<span class="glvl">Cayó a Nv. ${e.level}</span>` : ""}
      ${note}
    </div>`;
  }).join("");
  // editar las tuyas (apodo, nivel y último suspiro) desde su lápida
  $("graveWall").querySelectorAll(".grave-card.mine").forEach((c) =>
    (c.onclick = () => openDialog(entries.find((e) => e.id === c.dataset.id))));
}

function renderMyColumns() {
  const mine = entries.filter((e) => e.user_id === user.id);
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
  const cols = $("myColumns");
  cols.querySelectorAll(".movebtn").forEach((b) =>
    (b.onclick = (ev) => { ev.stopPropagation(); updateStatus(b.dataset.id, b.dataset.move); }));
  cols.querySelectorAll(".mon").forEach((el) =>
    (el.onclick = (ev) => { if (ev.target.closest(".movebtn")) return; openDialog(entries.find((e) => e.id === el.dataset.id)); }));
}

// estados a los que se puede mover: icono SVG + etiqueta
const MOVE = { box: [SVG.box, "A la caja"], team: [SVG.team, "Al equipo"], dead: [SVG.dead, "Al cementerio"] };

// partes comunes de la carta Pokédex (sprite en caja gris + nombre + Nº + Nv.)
function monInner(e) {
  const p = byId.get(e.pokemon_id);
  const name = e.nickname || p?.es || "???";
  const species = e.nickname && p ? p.es : null;
  const sub = [e.location, species].filter(Boolean).join(" · ");
  const mark = e.status === "team" ? `<span class="state-mark pokeball"></span>`
    : e.status === "dead" ? `<span class="state-mark">${SVG.dead}</span>` : "";
  return `${mark}
    <span class="sprite"><img src="${sprite(e.pokemon_id)}" alt="${esc(name)}" width="48" height="48" loading="lazy" onerror="this.style.visibility='hidden'"></span>
    <div class="info">
      <div class="nick">${esc(name)}</div>
      <div class="sub">${esc(sub) || `<span class="dex">Nº ${String(e.pokemon_id).padStart(3, "0")}</span>`}</div>
    </div>
    ${e.level ? `<span class="lvl">Nv. ${e.level}</span>` : ""}`;
}

function monCard(e) {
  const moves = ["box", "team", "dead"].filter((s) => s !== e.status).map((s) =>
    `<button class="movebtn" data-move="${s}" data-id="${e.id}" title="${MOVE[s][1]}" aria-label="${MOVE[s][1]}">${MOVE[s][0]}</button>`).join("");
  return `<div class="mon ${e.status}" data-id="${e.id}">${monInner(e)}<div class="moves">${moves}</div></div>`;
}

// tarjeta solo-lectura (para ver el equipo de otro payo)
function monCardRO(e) {
  return `<div class="mon ro ${e.status}">${monInner(e)}</div>`;
}

async function updateStatus(id, status) {
  const { error } = await db.from("entries").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return toast(error.message, true);
  await reload();
}

// medallas visuales (solo lectura): las conseguidas en color, el resto en gris
function medalsHTML(mask) {
  return MEDALS.map((m, k) => {
    const on = hasMedal(mask, k + 1);
    return `<span class="medal ${on ? "on" : "off"}" title="Medalla ${esc(m.name)}${on ? " ✓" : ""}" aria-label="Medalla ${esc(m.name)} ${on ? "conseguida" : "pendiente"}"><img src="${medalImg(m)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'"></span>`;
  }).join("");
}

// Tabla de rutas × jugadores
function renderRoutes() {
  // filas: ROUTES + zonas usadas que no estén en ROUTES
  const extras = [];
  const seen = new Set();
  for (const e of entries) {
    const n = normLoc(e.location);
    if (e.location && !ROUTE_NORMS.has(n) && !seen.has(n)) { seen.add(n); extras.push(e.location.trim()); }
  }
  if (entries.some((e) => !e.location)) extras.push("");   // registrados sin zona (botón «Registrar»)
  const rows = [...ROUTES, ...extras];

  const head = `<thead><tr><th class="rcorner">Ruta</th>${players.map((pl) => {
    const prof = pl.profiles || {};
    const mine = pl.user_id === user.id;
    return `<th class="${mine ? "mine" : ""}" style="--me-col:${GREEN}">
      <div class="rhead"><span class="band"></span><div class="rhead-inner">${playerIcon(prof)}<span>${esc(prof.display_name || "???")}</span></div></div></th>`;
  }).join("")}</tr></thead>`;

  const body = rows.map((route, i) => {
    const cells = players.map((pl) => {
      const mine = pl.user_id === user.id;
      const es = entries.filter((e) => e.user_id === pl.user_id && normLoc(e.location) === normLoc(route));
      const content = es.map((e) => {
        const nm = e.nickname || byId.get(e.pokemon_id)?.es || "";
        return `<span class="rmon ${e.status}" data-id="${e.id}" title="${esc(nm)}">
          <img src="${sprite(e.pokemon_id)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'"><em>${esc(nm)}</em></span>`;
      }).join("");
      return `<td class="${mine ? "addable" : ""}" data-route="${esc(route)}" data-user="${pl.user_id}">${content || '<span class="empty">—</span>'}</td>`;
    }).join("");
    return `<tr><th class="rlabel"><span class="rnum">Zona ${String(i + 1).padStart(2, "0")}</span>${esc(route) || "Sin zona"}</th>${cells}</tr>`;
  }).join("");

  $("routesTable").innerHTML = head + `<tbody>${body}</tbody>`;

  // editar un Pokémon propio desde su celda
  $("routesTable").querySelectorAll(".rmon").forEach((el) => (el.onclick = (ev) => {
    ev.stopPropagation(); openDialog(entries.find((e) => e.id === el.dataset.id));
  }));
  // click en mi celda vacía → registrar con esa ruta
  $("routesTable").querySelectorAll("td.addable").forEach((td) => (td.onclick = (ev) => {
    if (ev.target.closest(".rmon")) return;
    openDialog(null, td.dataset.route);
  }));
}

// Payos: todas las cuentas; clic en una abre su perfil
function renderPayos() {
  $("friends").innerHTML = players.map((pl) => {
    const prof = pl.profiles || { display_name: "???", color: "#888" };
    const es = entries.filter((e) => e.user_id === pl.user_id);
    const dead = es.filter((e) => e.status === "dead").length;
    const team = es.filter((e) => e.status === "team");
    const chips = team.map((e) =>
      `<img src="${sprite(e.pokemon_id)}" alt="${esc(e.nickname || byId.get(e.pokemon_id)?.es || "")}" title="${esc(e.nickname || byId.get(e.pokemon_id)?.es || "")}" loading="lazy" onerror="this.style.display='none'">`).join("")
      || `<span class="muted">Sin equipo</span>`;
    const av = avatarSrc(prof.avatar);
    const bigAv = av
      ? `<img class="favatar${isPhoto(prof.avatar) ? " photo" : ""}" src="${av}" alt="" loading="lazy" onerror="this.outerHTML='<span class=&quot;favatar dot-av&quot; style=&quot;background:${GREEN}&quot;></span>'">`
      : `<span class="favatar dot-av" style="background:${GREEN}"></span>`;
    return `<div class="friend ${pl.user_id === user.id ? "me-card" : ""}" data-user="${pl.user_id}" style="--fc:${GREEN}">
      <div class="fhead"></div>
      ${bigAv}
      <div class="fname">${esc(prof.display_name)}</div>
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

function openPayo(uid) {
  const pl = players.find((p) => p.user_id === uid);
  if (!pl) return;
  const prof = pl.profiles || { display_name: "???", color: "#888" };
  const es = entries.filter((e) => e.user_id === uid);
  const sect = (icon, title, st) => {
    const arr = es.filter((e) => e.status === st);
    return `<h4>${icon} ${title} <span class="count">${arr.length}</span></h4>
      <div class="list">${arr.map(monCardRO).join("") || emptyState(st)}</div>`;
  };
  $("payoName").innerHTML = `${playerIcon(prof)}${esc(prof.display_name)}`;
  $("payoMedals").innerHTML = medalsHTML(pl.badges);
  $("payoBody").innerHTML = sect(SVG.team, "Equipo", "team") + sect(SVG.box, "Caja", "box") + sect(SVG.dead, "Cementerio", "dead");
  $("payoDialog").showModal();
}

// editor de medallas (pestaña Perfil): cada ficha se activa/desactiva por separado
function renderMedalsEdit() {
  if (!myPlayer) return;
  const mask = myPlayer.badges || 0;
  const tiles = MEDALS.map((m, k) => {
    const on = hasMedal(mask, k + 1);
    return `<button type="button" class="medal-tile ${on ? "on" : ""}" data-n="${k + 1}" aria-pressed="${on}" title="Medalla ${esc(m.name)}">
      <img src="${medalImg(m)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'"><span>${esc(m.name)}</span></button>`;
  }).join("");
  $("medalsEdit").innerHTML = `<div class="medals-head"><h3>Medallas</h3><span class="medals-count"><b>${countMedals(mask)}</b>/${MEDALS.length}</span></div><div class="medal-grid">${tiles}</div>`;
  $("medalsEdit").querySelectorAll(".medal-tile").forEach((b) => (b.onclick = () => toggleMedal(+b.dataset.n)));
}

async function toggleMedal(i) {
  if (!myPlayer) return;
  const prev = myPlayer.badges || 0, next = prev ^ (1 << (i - 1));
  myPlayer.badges = next;
  renderMedalsEdit(); renderPayos();
  if (next > prev) {
    confetti();
    $("medalsEdit").querySelector(`.medal-tile[data-n="${i}"]`)?.classList.add("just-on");
  }
  const { error } = await db.from("players").update({ badges: next }).eq("id", myPlayer.id);
  if (error) { myPlayer.badges = prev; renderMedalsEdit(); renderPayos(); toast(error.message, true); }
}

// ===================== perfil =====================
function fillProfile() {
  if (!profile) return;
  $("pName").value = profile.display_name;
  const av = profile.avatar;
  if (isPhoto(av)) { $("pAvatarUrl").value = av; $("pAvatar").value = ""; }
  else { $("pAvatar").value = av ? byId.get(+av)?.es || "" : ""; $("pAvatarUrl").value = ""; }
  updateAvatarPreview();
  renderMedalsEdit();
}
function updateAvatarPreview() {
  const url = $("pAvatarUrl").value.trim();
  const id = byName.get($("pAvatar").value.trim().toLowerCase());
  if (url) $("avatarPreview").innerHTML = `<img class="photo" src="${esc(url)}" alt="" onerror="this.style.display='none'"><span>Avatar por URL</span>`;
  else if (id) $("avatarPreview").innerHTML = `<img src="${sprite(id)}" alt=""><span>${esc(byId.get(id).es)}</span>`;
  else $("avatarPreview").innerHTML = `<span>Sin avatar (se usará un punto verde)</span>`;
}
async function saveProfile() {
  const name = $("pName").value.trim();
  if (!name) return toast("Escribe un nombre", true);
  const url = $("pAvatarUrl").value.trim();
  const pid = byName.get($("pAvatar").value.trim().toLowerCase());
  const avatar = url || (pid ? String(pid) : null);
  const { error } = await db.from("profiles").update({ display_name: name, color: GREEN, avatar }).eq("id", user.id);
  if (error) return toast(error.message, true);
  profile = { ...profile, display_name: name, color: GREEN, avatar };
  toast("Perfil guardado", false, true);
  await reload();
}

// ===================== diálogo Pokémon =====================
function openDialog(entry = null, presetRoute = null) {
  if (entry && entry.user_id !== user.id) return;   // no se editan Pokémon de otros
  $("entryTitle").textContent = entry ? "Editar Pokémon" : "Registrar Pokémon";
  $("fId").value = entry?.id || "";
  $("fPokemon").value = entry ? byId.get(entry.pokemon_id)?.es || "" : "";
  $("fNickname").value = entry?.nickname || "";
  currentLoc = entry?.location || presetRoute || null;   // zona: de la ruta clicada o la que ya tenía
  $("fLevel").value = entry?.level || "";
  $("fNotes").value = entry?.notes || "";
  $("deleteBtn").classList.toggle("hidden", !entry);
  updatePreview();
  $("entryDialog").showModal();
}

function updatePreview() {
  const id = byName.get($("fPokemon").value.trim().toLowerCase());
  $("pokePreview").innerHTML = id
    ? `<img src="${sprite(id)}" alt=""><span>${esc(byId.get(id).es)} · Nº ${id}</span>`
    : `<span>Escribe un nombre de Pokémon válido</span>`;
}

async function saveEntry() {
  const pid = byName.get($("fPokemon").value.trim().toLowerCase());
  if (!pid) return toast("Elige un Pokémon de la lista", true);
  const row = {
    run_id: run.id, player_id: myPlayer.id, user_id: user.id, pokemon_id: pid,
    nickname: $("fNickname").value.trim() || null,
    location: currentLoc,
    level: parseInt($("fLevel").value) || null,
    notes: $("fNotes").value.trim() || null,
    updated_at: new Date().toISOString(),
  };
  const id = $("fId").value;
  // nuevo Pokémon entra en la Caja; luego se mueve con los botones de la tarjeta
  const { error } = id
    ? await db.from("entries").update(row).eq("id", id)
    : await db.from("entries").insert({ ...row, status: "box" });
  if (error) return toast(error.message, true);
  $("entryDialog").close();
  if (!id) {
    const logo = document.querySelector(".topbar .logo");
    if (logo && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      logo.classList.remove("shake"); void logo.offsetWidth; logo.classList.add("shake");
    }
    toast("¡Pokémon capturado! Entra en la caja", false, true);
  }
  await reload();
}

async function deleteEntry() {
  const id = $("fId").value;
  if (!id || !confirm("¿Borrar este Pokémon?")) return;
  const { error } = await db.from("entries").delete().eq("id", id);
  if (error) return toast(error.message, true);
  $("entryDialog").close();
  await reload();
}

// ===================== utilidades =====================
function show(id) { for (const s of ["auth", "app"]) $(s).classList.toggle("hidden", s !== id); }
function esc(s) { return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
let toastT;
function toast(msg, err = false, ok = false) {
  const t = $("toast"); t.textContent = msg; t.className = "toast" + (err ? " err" : ok ? " ok" : "");
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.add("hidden"), 2800);
}
