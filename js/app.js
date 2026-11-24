import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.0/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY, ROUTES } from "./config.js";

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const sprite = (id) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
const $ = (id) => document.getElementById(id);
const uname2email = (u) => u.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "") + "@users.pokez";
const normLoc = (s) => (s || "").trim().toLowerCase();
const ROUTE_NORMS = new Set(ROUTES.map(normLoc));

// ---- estado ----
let POKE = [];
const byId = new Map(), byName = new Map();
let user = null, profile = null, run = null, myPlayer = null;
let players = [], entries = [], channel = null, signupMode = false;

init();
async function init() {
  POKE = await fetch("data/pokemon.json").then((r) => r.json());
  for (const p of POKE) { byId.set(p.id, p); byName.set(p.es.toLowerCase(), p.id); byName.set(p.en.toLowerCase(), p.id); }
  $("pokeList").innerHTML = POKE.map((p) => `<option value="${p.es}">`).join("");
  $("locList").innerHTML = ROUTES.map((l) => `<option value="${l}">`).join("");
  wireEvents();
  db.auth.onAuthStateChange((event) => { if (event === "SIGNED_OUT") resetToAuth(); });
  const { data } = await db.auth.getSession();
  data.session ? afterLogin() : showAuth();
}

function wireEvents() {
  $("authSubmit").onclick = doAuth;
  $("authPass").onkeydown = (e) => { if (e.key === "Enter") doAuth(); };
  $("switchMode").onclick = (e) => { e.preventDefault(); toggleAuthMode(); };
  $("authAvatar").oninput = updateAuthAvatarPreview;
  $("logoutBtn").onclick = () => db.auth.signOut();
  $("userChip").onclick = openProfile;
  $("addBtn").onclick = () => openDialog();
  $("badgePlus").onclick = () => setBadges(myPlayer.badges + 1);
  $("badgeMinus").onclick = () => setBadges(myPlayer.badges - 1);
  $("cancelBtn").onclick = () => $("entryDialog").close();
  $("deleteBtn").onclick = deleteEntry;
  $("entryForm").onsubmit = (e) => { e.preventDefault(); saveEntry(); };
  $("fPokemon").oninput = updatePreview;
  $("pCancel").onclick = () => $("profileDialog").close();
  $("pClear").onclick = () => { $("pAvatar").value = ""; updateAvatarPreview(); };
  $("pAvatar").oninput = updateAvatarPreview;
  $("profileForm").onsubmit = (e) => { e.preventDefault(); saveProfile(); };
}

// avatar/color del jugador: sprite si tiene avatar, si no un punto de color
function playerIcon(prof) {
  if (prof?.avatar) return `<img class="avatar" src="${sprite(prof.avatar)}" alt="" onerror="this.outerHTML='<span class=&quot;dot&quot; style=&quot;background:${prof.color}&quot;></span>'">`;
  return `<span class="dot" style="background:${prof?.color || "#888"}"></span>`;
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
const PALETTE = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ec4899", "#14b8a6", "#f97316"];
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
      const avatar = byName.get($("authAvatar").value.trim().toLowerCase()) || null;
      const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
      await db.from("profiles").upsert({ id: data.user.id, display_name: uname, color, avatar });
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
    .on("postgres_changes", { event: "*", schema: "public", table: "entries", filter: `run_id=eq.${run.id}` }, reload)
    .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `run_id=eq.${run.id}` }, reload)
    .subscribe();
}

function render() {
  $("userChip").innerHTML = `${playerIcon(profile)}${esc(profile.display_name)}`;
  $("meChip").innerHTML = `${playerIcon(profile)}${esc(profile.display_name)}`;
  $("badgeCount").textContent = myPlayer?.badges ?? 0;
  renderRoutes();
  renderMyColumns();
  renderFriends();
}

function renderMyColumns() {
  const mine = entries.filter((e) => e.user_id === user.id);
  for (const st of ["team", "box", "dead"]) {
    const items = mine.filter((e) => e.status === st);
    $("cnt-" + st).textContent = items.length;
    $("list-" + st).innerHTML = items.map(monCard).join("") || `<span class="muted" style="font-size:.8rem">Vacío</span>`;
  }
  $("myColumns").querySelectorAll(".mon").forEach((el) =>
    (el.onclick = () => openDialog(entries.find((e) => e.id === el.dataset.id))));
}

function monCard(e) {
  const p = byId.get(e.pokemon_id);
  const name = e.nickname || p?.es || "???";
  const sub = [e.location, p && e.nickname ? p.es : null].filter(Boolean).join(" · ");
  return `<div class="mon ${e.status}" data-id="${e.id}">
    <img src="${sprite(e.pokemon_id)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
    <div class="info"><div class="nick">${esc(name)}</div><div class="sub">${esc(sub) || "&nbsp;"}</div></div>
    ${e.level ? `<span class="lvl">Lv ${e.level}</span>` : ""}
  </div>`;
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
  const rows = [...ROUTES, ...extras];

  const head = `<thead><tr><th class="rcorner">Ruta</th>${players.map((pl) =>
    `<th><div class="rhead">${playerIcon(pl.profiles)}<span>${esc(pl.profiles?.display_name || "???")}</span></div></th>`).join("")}</tr></thead>`;

  const body = rows.map((route) => {
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
    return `<tr><th class="rlabel">${esc(route)}</th>${cells}</tr>`;
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

function renderFriends() {
  $("friends").innerHTML = players.map((pl) => {
    const prof = pl.profiles || { display_name: "???", color: "#888" };
    const es = entries.filter((e) => e.user_id === pl.user_id);
    const dead = es.filter((e) => e.status === "dead");
    const team = es.filter((e) => e.status === "team");
    const chips = team.map((e) =>
      `<img src="${sprite(e.pokemon_id)}" title="${esc(e.nickname || byId.get(e.pokemon_id)?.es || "")}" loading="lazy" onerror="this.style.display='none'">`).join("")
      || `<span class="muted" style="font-size:.8rem">Sin equipo</span>`;
    return `<div class="friend ${pl.user_id === user.id ? "me-card" : ""}" style="border-top-color:${prof.color}">
      <div class="fname">${playerIcon(prof)}${esc(prof.display_name)}</div>
      <div class="stats">
        <span><b>${es.length - dead.length}</b> vivos</span>
        <span><b>${dead.length}</b> muertos</span>
        <span><b>${pl.badges}</b>/12 medallas</span>
      </div>
      <div class="team">${chips}</div>
    </div>`;
  }).join("");
}

async function setBadges(n) {
  n = Math.max(0, Math.min(12, n));
  if (!myPlayer || n === myPlayer.badges) return;
  const prev = myPlayer.badges; myPlayer.badges = n; $("badgeCount").textContent = n;
  const { error } = await db.from("players").update({ badges: n }).eq("id", myPlayer.id);
  if (error) { myPlayer.badges = prev; $("badgeCount").textContent = prev; toast(error.message, true); }
}

// ===================== perfil =====================
function openProfile() {
  $("pName").value = profile.display_name;
  $("pColor").value = profile.color || "#ef4444";
  $("pAvatar").value = profile.avatar ? byId.get(profile.avatar)?.es || "" : "";
  updateAvatarPreview();
  $("profileDialog").showModal();
}
function updateAvatarPreview() {
  const id = byName.get($("pAvatar").value.trim().toLowerCase());
  $("avatarPreview").innerHTML = id
    ? `<img src="${sprite(id)}" alt=""><span>${esc(byId.get(id).es)}</span>`
    : `<span>Sin avatar (se usará tu color)</span>`;
}
async function saveProfile() {
  const name = $("pName").value.trim();
  if (!name) return toast("Escribe un nombre", true);
  const avatar = byName.get($("pAvatar").value.trim().toLowerCase()) || null;
  const { error } = await db.from("profiles").update({ display_name: name, color: $("pColor").value, avatar }).eq("id", user.id);
  if (error) return toast(error.message, true);
  profile = { ...profile, display_name: name, color: $("pColor").value, avatar };
  $("profileDialog").close();
  await reload();
}

// ===================== diálogo Pokémon =====================
function openDialog(entry = null, presetRoute = null) {
  if (entry && entry.user_id !== user.id) return;   // no se editan Pokémon de otros
  $("entryTitle").textContent = entry ? "Editar Pokémon" : "Registrar Pokémon";
  $("fId").value = entry?.id || "";
  $("fPokemon").value = entry ? byId.get(entry.pokemon_id)?.es || "" : "";
  $("fNickname").value = entry?.nickname || "";
  $("fLocation").value = entry?.location || presetRoute || "";
  $("fLevel").value = entry?.level || "";
  $("fStatus").value = entry?.status || "team";
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
    location: $("fLocation").value.trim() || null,
    level: parseInt($("fLevel").value) || null,
    status: $("fStatus").value,
    notes: $("fNotes").value.trim() || null,
    updated_at: new Date().toISOString(),
  };
  const id = $("fId").value;
  const { error } = id
    ? await db.from("entries").update(row).eq("id", id)
    : await db.from("entries").insert(row);
  if (error) return toast(error.message, true);
  $("entryDialog").close();
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
function toast(msg, err = false) {
  const t = $("toast"); t.textContent = msg; t.className = "toast" + (err ? " err" : "");
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.add("hidden"), 2800);
}
