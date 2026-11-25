import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.0/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY, ROUTES, ROUTE_ZONES, MEDALS, BANNERS } from "./config.js";

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const sprite = (id) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
const $ = (id) => document.getElementById(id);

// iconos SVG (presentación; sustituyen a los emojis)
const itemImg = (n) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${n}.png`;
const itemTag = (n) => `<img class="iimg" src="${itemImg(n)}" alt="" width="30" height="30" onerror="this.style.visibility='hidden'">`;
const SVG = { box: itemTag("great-ball"), team: itemTag("poke-ball"), dead: itemTag("old-amber") };
// estados de vacío con ilustración + texto con gracia
const EMPTY = {
  team: ["M5 3l4 4M19 3l-4 4M4 8h16l-1.5 11a2 2 0 01-2 1.7H7.5a2 2 0 01-2-1.7z", "Tu equipo está vacío. ¡A la hierba alta!"],
  box: ["M3 4h18v5H3zM3 9h18v11H3zM10 13h4", "La caja está vacía. De momento."],
  dead: ["M6 21V10a6 6 0 0112 0v11z|M12 7v5M9.5 9.5h5", "El cementerio está vacío. Que siga así."],
};
function emptyState(st) {
  const [d, txt] = EMPTY[st] || ["", "Nada por aquí."];
  return `<div class="empty-state">${{ team: SVG.team, box: SVG.box, dead: SVG.dead }[st] || ""}<span>${txt}</span></div>`;
}

// banners de perfil
const bannerOf = (prof) => BANNERS.find((b) => b.id === prof?.banner) || BANNERS[0];
const bannerArt = (b) => b.item ? itemImg(b.item)
  : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${b.shiny ? "shiny/" : ""}${b.pk}.png`;
const bannerVars = (b) => `--b1:${b.c1};--b2:${b.c2}`;
function bannerHTML(prof, cls = "fhead") {
  const b = bannerOf(prof);
  return `<div class="${cls} banner" style="${bannerVars(b)}"><img class="bart" src="${bannerArt(b)}" alt="" loading="lazy" onerror="this.style.display='none'"><span class="btitle">${esc(b.title)}</span></div>`;
}

// color de jugador: ahora fijo (rojo) para todos
const BRAND = "#E3350D";
// medallas: `players.badges` es una máscara de bits (bit i-1 = medalla i), así se marcan sueltas
const medalImg = (m) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/${m.img}.png`;
const hasMedal = (mask, i) => ((mask || 0) >> (i - 1)) & 1;
const countMedals = (mask) => MEDALS.reduce((n, _, k) => n + hasMedal(mask, k + 1), 0);
// avatar: un número = Pokémon por id; cualquier otra cosa = URL de imagen
function avatarSrc(av) { if (av == null || av === "") return null; av = String(av); return /^\d+$/.test(av) ? sprite(av) : esc(av); }  // URL escapada: se interpola en atributos HTML
function isPhoto(av) { return av != null && av !== "" && !/^\d+$/.test(String(av)); }
const uname2email = (u) => u.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "") + "@users.pokez";
const ADMIN_EMAIL = "admin@users.pokez";   // la seguridad real está en RLS (supabase/admin.sql); esto solo adapta la interfaz
const normLoc = (s) => (s || "").trim().toLowerCase();
const ROUTE_NORMS = new Set(ROUTES.map(normLoc));

// ---- estado ----
let POKE = [];
const byId = new Map(), byName = new Map();
let user = null, profile = null, run = null, myPlayer = null;
let hasBanner = true;
let players = [], entries = [], routeStatus = [], channel = null, rsChannel = null, pfChannel = null, signupMode = false;
let isAdmin = false, payoUid = null, dialogOwner = null;
let currentLoc = null;   // zona del Pokémon en edición (viene de la celda de ruta; ya no hay campo)

window.addEventListener("unhandledrejection", (e) => { e.preventDefault(); console.error(e.reason); toast("Algo ha fallado. Si se repite, recarga la página.", true); });
init().catch((e) => { console.error(e); toast("No se pudo iniciar la web", true); });
async function init() {
  POKE = await fetch("data/pokemon.json").then((r) => r.json()).catch(() => []);
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
  $("logoutBtn").onclick = async () => { await stopPresence(true); db.auth.signOut(); };
  $("meChip").onclick = () => { if (!isAdmin) selectTab("perfil"); };
  $("userChip").onclick = (e) => { e.stopPropagation(); toggleMenu(); };
  $("menuProfile").onclick = () => { closeMenu(); selectTab("perfil"); };
  $("menuTheme").onclick = () => { closeMenu(); toggleTheme(); };
  document.addEventListener("click", (e) => { if (!e.target.closest(".usermenu")) closeMenu(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });
  $("cellClose").onclick = () => $("cellDialog").close();
  document.querySelectorAll("#cellDialog [data-act]").forEach((b) => (b.onclick = () => cellAction(b.dataset.act)));
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
  document.querySelectorAll(".clock-toggle").forEach((b) => (b.onclick = toggleClock));
  $("missionForm").onsubmit = (e) => { e.preventDefault(); saveMission(); };
  $("mCancel").onclick = () => $("missionDialog").close();
  $("mDelete").onclick = deleteMission;
  $("mItem").innerHTML = `<option value="">Sin icono</option>` + REWARD_ITEMS.map(([v, n]) => `<option value="${v}">${n}</option>`).join("");
  $("missionList").onclick = (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.done) completeMission(b.dataset.done);
    if (b.dataset.edit) openMission(missions.find((m) => m.id === b.dataset.edit));
  };
  $("missionsHead").onclick = (e) => { if (e.target.closest("#newMissionBtn")) openMission(); };
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
  if (name === "misiones") loadMissions();
}

// tema claro/oscuro (botón + prefers-color-scheme por defecto)
function currentTheme() {
  const set = document.documentElement.getAttribute("data-theme");
  if (set) return set;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
function toggleTheme() {
  const next = currentTheme() === "dark" ? "light" : "dark";
  const apply = () => { document.documentElement.setAttribute("data-theme", next); applyThemeIcon(); };
  try { localStorage.setItem("theme", next); } catch (e) {}
  // crossfade único de toda la página (evita que cada elemento transicione por su cuenta); sin él o con reduced-motion, cambio directo
  if (document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) document.startViewTransition(apply);
  else apply();
}
function toggleMenu() { const o = $("userMenu").classList.toggle("hidden"); $("userChip").setAttribute("aria-expanded", String(!o)); }
function closeMenu() { $("userMenu")?.classList.add("hidden"); $("userChip")?.setAttribute("aria-expanded", "false"); }
function applyThemeIcon() {
  const dark = currentTheme() === "dark";
  // el icono y el texto muestran el tema ACTUAL
  document.querySelector(".icon-moon")?.classList.toggle("hidden", !dark);
  document.querySelector(".icon-sun")?.classList.toggle("hidden", dark);
  $("themeName").textContent = $("menuThemeName").textContent = dark ? "Oscuro" : "Claro";
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

// avatar del jugador: sprite/imagen si tiene avatar, si no un punto rojo
function playerIcon(prof) {
  const src = avatarSrc(prof?.avatar);
  const dot = `<span class="dot" style="background:${BRAND}"></span>`;
  if (src) return `<img class="avatar${isPhoto(prof.avatar) ? " photo" : ""}" src="${src}" alt="" loading="lazy" onerror="this.outerHTML='<span class=&quot;dot&quot; style=&quot;background:${BRAND}&quot;></span>'">`;
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
      await db.from("profiles").upsert({ id: data.user.id, display_name: uname, color: BRAND, avatar: pid ? String(pid) : null });
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
  isAdmin = user.email === ADMIN_EMAIL;
  if (isAdmin) profile = { display_name: "Admin", avatar: null };   // sin perfil ni fila en players: invisible para el resto
  else {
    let { data: prof } = await db.from("profiles").select().eq("id", user.id).maybeSingle();
    if (!prof) ({ data: prof } = await db.from("profiles").insert({ id: user.id, display_name: user.email.split("@")[0] }).select().single());
    profile = prof;
  }
  $("userInfo").classList.remove("hidden");
  // run única compartida
  const { data: r } = await db.from("runs").select().limit(1).maybeSingle();
  if (!r) return toast("La partida no está creada en la base de datos", true);
  await enterRun(r);
}

function resetToAuth() {
  channel?.unsubscribe(); rsChannel?.unsubscribe(); pfChannel?.unsubscribe();
  stopPresence();
  presence = new Map();
  user = profile = run = myPlayer = null; isAdmin = false; payoUid = null; players = []; entries = [];
  showAuth();
}

async function enterRun(r) {
  run = r;
  $("runName").textContent = r.name;
  // unirse (insert idempotente): el upsert ON CONFLICT falla con RLS cuando aún no eres miembro
  // (la policy SELECT de players es is_member()); el insert normal pasa y el duplicado (23505) se ignora.
  if (!isAdmin) {
    const { error: joinErr } = await db.from("players").insert({ run_id: r.id, user_id: user.id });
    if (joinErr && joinErr.code !== "23505") return toast("No se pudo entrar en la partida", true);
    const { data: mine } = await db.from("players").select().eq("run_id", r.id).eq("user_id", user.id).maybeSingle();
    if (!mine) return toast("No se pudo entrar en la partida", true);
    myPlayer = mine;
  }
  document.querySelectorAll('.tab[data-tab="seg"],.tab[data-tab="perfil"]').forEach((b) => b.classList.toggle("hidden", isAdmin));
  if (isAdmin) selectTab("rutas");
  show("app");
  showSkeletons();
  await reload();
  subscribe();
  startPresence();
}

// ===================== misiones =====================
// La recompensa vive en otra tabla (mission_rewards) con RLS: el servidor solo la entrega al completar la misión.
const REWARD_ITEMS = [["poke-ball", "Poké Ball"], ["great-ball", "Super Ball"], ["ultra-ball", "Ultra Ball"], ["master-ball", "Master Ball"], ["premier-ball", "Honor Ball"], ["potion", "Poción"], ["revive", "Revivir"], ["rare-candy", "Caramelo Raro"], ["exp-share", "Repartir Exp."], ["lucky-egg", "Huevo Suerte"], ["tm-normal", "MT"], ["escape-rope", "Cuerda Huida"], ["sun-stone", "Piedra Solar"], ["old-amber", "Ámbar Viejo"], ["town-map", "Mapa"]];
const LOCK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>`;
let missions = [], rewards = new Map(), completions = [], missionId = null;
async function loadMissions() {
  const [m, r, c] = await Promise.all([
    db.from("missions").select("id,title,description").order("created_at"),
    db.from("mission_rewards").select("mission_id,reward_text,reward_item"),
    db.from("mission_completions").select("mission_id,user_id"),
  ]);
  if (!user) return;
  if (m.error) return toast("No se pudieron cargar las misiones", true);
  missions = m.data || []; rewards = new Map((r.data || []).map((x) => [x.mission_id, x])); completions = c.data || [];
  renderMissions();
}
function renderMissions() {
  const mine = new Set(completions.filter((c) => c.user_id === user.id).map((c) => c.mission_id));
  const total = missions.length;
  $("missionsHead").innerHTML = isAdmin
    ? `<button class="btn primary" id="newMissionBtn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span>Nueva misión</span></button>`
    : `<div class="mprogress"><span><b>${mine.size}</b>/${total} completadas</span><div class="bar"><i style="width:${total ? (mine.size / total) * 100 : 0}%"></i></div></div>`;
  $("missionList").innerHTML = missions.map((m) => {
    const done = mine.has(m.id), rw = rewards.get(m.id);
    const n = completions.filter((c) => c.mission_id === m.id).length;
    const reward = rw
      ? `<div class="reward open">${rw.reward_item ? itemTag(rw.reward_item) : ""}<div><small>Recompensa</small><b>${esc(rw.reward_text)}</b></div></div>`
      : `<div class="reward locked">${LOCK}<div><small>Recompensa</small><b>Oculta hasta completar</b></div></div>`;
    const action = isAdmin ? `<button class="btn ghost" data-edit="${esc(m.id)}">Editar</button>`
      : done ? `<span class="done-tag">Completada</span>`
      : `<button class="btn primary" data-done="${esc(m.id)}">Marcar completada</button>`;
    return `<article class="card mission${done ? " done" : ""}">
      <h3>${esc(m.title)}</h3>
      ${m.description ? `<p class="muted">${esc(m.description)}</p>` : ""}
      ${reward}
      <footer><span class="muted">${n} jugador${n === 1 ? "" : "es"} la ${n === 1 ? "completó" : "completaron"}</span>${action}</footer>
    </article>`;
  }).join("") || `<div class="empty-state">${itemTag("tm-normal")}<span>${isAdmin ? "Aún no hay misiones. Crea la primera." : "No hay misiones por ahora."}</span></div>`;
}
async function completeMission(id) {
  const m = missions.find((x) => x.id === id);
  if (!m || !confirm(`¿Marcar «${m.title}» como completada? Se revelará la recompensa y no se puede deshacer.`)) return;
  const { error } = await db.from("mission_completions").insert({ mission_id: id, user_id: user.id });
  if (error && error.code !== "23505") return toast(error.message, true);
  await loadMissions();
  confetti(); toast("¡Misión completada!", false, true);
}
function openMission(m = null) {
  missionId = m?.id || null;
  const rw = m && rewards.get(m.id);
  $("missionTitle").textContent = m ? "Editar misión" : "Nueva misión";
  $("mTitle").value = m?.title || ""; $("mDesc").value = m?.description || "";
  $("mReward").value = rw?.reward_text || ""; $("mItem").value = rw?.reward_item || "";
  $("mDelete").classList.toggle("hidden", !m);
  $("missionDialog").showModal();
}
async function saveMission() {
  const title = $("mTitle").value.trim(), reward = $("mReward").value.trim();
  if (!title || !reward) return toast("Título y recompensa son obligatorios", true);
  const row = { title, description: $("mDesc").value.trim() || null };
  let id = missionId;
  if (id) { const { error } = await db.from("missions").update(row).eq("id", id); if (error) return toast(error.message, true); }
  else { const { data, error } = await db.from("missions").insert(row).select("id").single(); if (error) return toast(error.message, true); id = data.id; }
  const { error } = await db.from("mission_rewards").upsert({ mission_id: id, reward_text: reward, reward_item: $("mItem").value || null });
  if (error) return toast(error.message, true);
  $("missionDialog").close(); toast("Misión guardada", false, true);
  await loadMissions();
}
async function deleteMission() {
  if (!missionId || !confirm("¿Borrar esta misión? Se pierden también las completadas.")) return;
  const { error } = await db.from("missions").delete().eq("id", missionId);
  if (error) return toast(error.message, true);
  $("missionDialog").close(); await loadMissions();
}

// ===================== fichaje =====================
// latido cada 30 s (clock_ping); 90 s sin latido = desconectado. Ver supabase/presence.sql
let presence = new Map(), lastConn = new Map(), pingT, pollT, tickT;
const p2 = (n) => String(n).padStart(2, "0");
function fmtClock(s) { s = Math.max(0, Math.floor(s)); return `${p2(Math.floor(s / 3600))}:${p2(Math.floor((s % 3600) / 60))}:${p2(s % 60)}`; }
function fmtAgo(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 1) return "un momento";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h} h` : `${Math.floor(h / 24)} d`;
}
const hhmm = (d) => new Date(d).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
const clockSpan = (start) => `<span data-clock="${esc(start)}">${fmtClock((Date.now() - new Date(start)) / 1000)}</span>`;
function fmtDur(s) {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min`;
}
async function startPresence() {
  stopPresence();
  pingT = setInterval(ping, 30000);
  await loadPresence();
  pollT = setInterval(loadPresence, 30000);
  tickT = setInterval(() => document.querySelectorAll("[data-clock]").forEach((el) => {
    el.textContent = fmtClock((Date.now() - new Date(el.dataset.clock)) / 1000);
  }), 1000);
}
async function stopPresence(out = false) {
  clearInterval(pingT); clearInterval(pollT); clearInterval(tickT);
  if (out && !isAdmin) await db.rpc("clock_out");
}
async function loadPresence() {
  const [{ data, error }, { data: ses }] = await Promise.all([
    db.rpc("presence_summary"),
    db.from("sessions").select("user_id,started_at,last_seen,ended_at").order("last_seen", { ascending: false }).limit(300),
  ]);
  if (error) return toast("No se pudo leer el fichaje: " + error.message, true);   // sin tocar el estado local
  if (!user) return;
  presence = new Map((data || []).map((r) => [r.user_id, r]));
  lastConn = new Map();
  for (const s of ses || []) if (!lastConn.has(s.user_id)) lastConn.set(s.user_id, s);   // la más reciente de cada uno
  clocked = !isAdmin && !!presence.get(user?.id)?.online;   // la verdad la tiene el servidor
  renderConectados(); renderPayos(); fillHours(); updateClockUI();
}

// fichaje manual: sin fichar no cuentas horas ni sales como conectado
let clocked = false, localStart = null;   // localStart: entrada según este navegador, por si la lectura falla
async function ping() {
  if (!clocked) return;
  const { data, error } = await db.rpc("clock_ping");
  if (!error && data === false) { clocked = false; updateClockUI(); toast("Tu fichaje caducó, ficha de nuevo", true); }
}
async function toggleClock() {
  if (isAdmin) return;
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
function updateClockUI() {
  const on = clocked, start = presence.get(user?.id)?.session_start || (on ? localStart : null), live = on && start;
  document.querySelectorAll(".clock-toggle").forEach((b) => {
    b.classList.toggle("on", on); b.classList.toggle("hidden", isAdmin); b.setAttribute("aria-pressed", on);
    if (b.dataset.full) { b.classList.toggle("danger", on); b.classList.toggle("primary", !on); }
    // barra superior: al fichar pasa de «Fichar» a un cronómetro en marcha
    b.querySelector(".clock-label").innerHTML = b.dataset.full ? (on ? "Fichar salida" : "Fichar entrada") : (on ? `<span class="lbl">Fichar salida</span>${live ? `<span class="clock-mini">${clockSpan(start)}</span>` : ""}` : "Fichar entrada");
  });
  const card = $("clockCard");
  card.classList.toggle("hidden", isAdmin); card.classList.toggle("on", on);
  $("clockDot").classList.toggle("on", on);
  $("clockState").textContent = live ? `Fichado · entrada a las ${hhmm(start)}` : on ? "Fichado" : "Sin fichar";
  $("clockBig").classList.toggle("hidden", !live);
  $("clockBig").innerHTML = live ? clockSpan(start) : "";
  const total = presence.get(user?.id)?.total_seconds;
  $("clockTotal").textContent = total ? `Horas jugadas: ${fmtDur(total)}` : "Aún sin horas";
}
function fillHours() {
  if (user && $("pHours")) $("pHours").textContent = fmtDur(presence.get(user.id)?.total_seconds || 0);
}
const lastTs = (p) => { const s = lastConn.get(p.user_id); return s ? new Date(s.ended_at || s.last_seen).getTime() : 0; };
function renderConectados() {
  const others = players.filter((p) => p.user_id !== user?.id);   // lo tuyo va aparte, arriba
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

// ===================== datos + render =====================
async function reload() {
  const qPlayers = (withBanner) => db.from("players").select(`id, user_id, badges, profiles(display_name, color, avatar${withBanner ? ", banner" : ""})`).eq("run_id", run.id).order("created_at");
  let [plr, { data: en }, { data: rs }] = await Promise.all([
    qPlayers(hasBanner),
    db.from("entries").select().eq("run_id", run.id).order("created_at"),
    db.from("route_status").select("user_id,route,status"),   // si routes.sql aún no está aplicado, error → vacío
  ]);
  if (plr.error && hasBanner) { hasBanner = false; plr = await qPlayers(false); }   // banners.sql aún no aplicado
  if (!user || !run) return;   // se cerró sesión mientras cargaba
  const pl = plr.data;
  players = pl || []; entries = en || []; routeStatus = rs || [];
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
  rsChannel?.unsubscribe();
  pfChannel?.unsubscribe();
  pfChannel = db.channel("profiles-ch").on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, onRealtime).subscribe();
  rsChannel = db.channel("route-status").on("postgres_changes", { event: "*", schema: "public", table: "route_status" }, onRealtime).subscribe();
}

// cambio en vivo: destello del punto rojo + recarga
function onRealtime() {
  const dot = $("liveDot");
  if (dot) { dot.classList.remove("on"); void dot.offsetWidth; dot.classList.add("on"); }
  reload();
}

function render() {
  $("userChip").innerHTML = `${playerIcon(profile)}<span class="uname">${esc(profile.display_name)}</span>`;
  $("menuProfile").classList.toggle("hidden", isAdmin);
  $("meChip").innerHTML = `${playerIcon(profile)}${esc(profile.display_name)}`;
  renderRoutes();
  renderMyColumns();
  renderPayos();
  renderConectados();
  renderGraveyard();
  renderMedalsEdit();
  renderBannerGrid();
  refreshPayo();
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
    const mine = e.user_id === user.id || isAdmin;
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
  wireMons($("myColumns"));
}
function wireMons(root) {
  root.querySelectorAll(".movebtn").forEach((b) =>
    (b.onclick = (ev) => { ev.stopPropagation(); updateStatus(b.dataset.id, b.dataset.move); }));
  root.querySelectorAll(".mon:not(.ro)").forEach((el) =>
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

// ---- Rutas: estados por casilla (pendiente / sin encuentro / fallido / capturado), zonas, progreso, filtros ----
const ST_LABEL = { pending: "Pendiente", none: "Sin encuentro", failed: "Fallido", captured: "Capturado" };
const ST_ICON = {
  pending: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`,
  none: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M6.5 17.5l11-11"/></svg>`,
  failed: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
};
let routeFilter = "all", onlyMine = false;
const collapsedZones = new Set();
function cellState(uid, route) {
  const es = entries.filter((e) => e.user_id === uid && normLoc(e.location) === normLoc(route));
  if (es.length) return { st: "captured", es };
  const r = routeStatus.find((x) => x.user_id === uid && normLoc(x.route) === normLoc(route));
  return { st: r?.status || "pending", es };
}
const routesDone = (uid, list = ROUTES) => list.filter((r) => cellState(uid, r).st !== "pending").length;

function renderRoutes() {
  const cols = onlyMine && !isAdmin ? players.filter((p) => p.user_id === user.id) : players;
  const extras = [];
  const seen = new Set();
  for (const e of entries) {
    const n = normLoc(e.location);
    if (e.location && !ROUTE_NORMS.has(n) && !seen.has(n)) { seen.add(n); extras.push(e.location.trim()); }
  }
  if (entries.some((e) => !e.location)) extras.push("");   // registrados sin zona (botón «Registrar»)
  const zones = [...ROUTE_ZONES, ...(extras.length ? [["Otras zonas", extras]] : [])];

  // progreso del grupo + filtros
  const total = ROUTES.length, done = players.reduce((n, p) => n + routesDone(p.user_id), 0), max = players.length * total;
  const pct = max ? Math.round((done / max) * 100) : 0;
  const chip = (k, l) => `<button class="chip${routeFilter === k ? " on" : ""}" data-rf="${k}">${l}</button>`;
  $("routesBar").innerHTML = `<div class="rprogress"><span>Progreso del grupo <b>${pct}%</b></span><div class="bar"><i style="width:${pct}%"></i></div></div>
    <div class="rfilters" role="group" aria-label="Filtros">${chip("all", "Todas")}${chip("pending", "Pendientes")}${chip("failed", "Fallidas")}
    ${isAdmin ? "" : `<button class="chip${onlyMine ? " on" : ""}" data-mine="1">Solo mías</button>`}</div>`;
  $("routesBar").querySelectorAll("[data-rf]").forEach((b) => (b.onclick = () => { routeFilter = b.dataset.rf; renderRoutes(); }));
  $("routesBar").querySelector("[data-mine]")?.addEventListener("click", () => { onlyMine = !onlyMine; renderRoutes(); });

  const head = `<thead><tr><th class="rcorner">Ruta</th>${cols.map((pl) => {
    const prof = pl.profiles || {};
    const mine = pl.user_id === user.id, d = routesDone(pl.user_id);
    return `<th class="${mine ? "mine" : ""}" style="--me-col:${BRAND}">
      <div class="rhead"><span class="band"></span><div class="rhead-inner">${playerIcon(prof)}<span>${esc(prof.display_name || "???")}</span></div>
      <small class="rprog">${d}/${total}</small><div class="bar mini"><i style="width:${total ? (d / total) * 100 : 0}%"></i></div></div></th>`;
  }).join("")}</tr></thead>`;

  const keep = (r) => {
    if (routeFilter === "pending") return isAdmin ? cols.some((p) => cellState(p.user_id, r).st === "pending") : cellState(user.id, r).st === "pending";
    if (routeFilter === "failed") return cols.some((p) => cellState(p.user_id, r).st === "failed");
    return true;
  };
  const current = isAdmin ? null : ROUTES.find((r) => cellState(user.id, r).st === "pending");   // tu siguiente ruta
  const subject = isAdmin ? null : user.id;

  const body = zones.map(([zname, zroutes]) => {
    const rows = zroutes.filter(keep);
    if (!rows.length) return "";
    const open = !collapsedZones.has(zname);
    const zd = subject ? `<span class="zprog">${routesDone(subject, zroutes)}/${zroutes.length}</span>` : "";
    const zhead = `<tr class="zone"><th colspan="${cols.length + 1}"><button type="button" class="zbtn" data-zone="${esc(zname)}" aria-expanded="${open}"><span class="caret">${open ? "▾" : "▸"}</span>${esc(zname)}${zd}</button></th></tr>`;
    if (!open) return zhead;
    return zhead + rows.map((route) => {
      const cells = cols.map((pl) => {
        const mine = pl.user_id === user.id;
        const { st, es } = cellState(pl.user_id, route);
        const content = st === "captured" ? es.map((e) => {
          const nm = e.nickname || byId.get(e.pokemon_id)?.es || "";
          return `<span class="rmon ${e.status}" data-id="${e.id}" title="${esc(nm)}">
            <img src="${sprite(e.pokemon_id)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'"><em>${esc(nm)}</em></span>`;
        }).join("") : `<span class="cs ${st}" title="${ST_LABEL[st]}">${ST_ICON[st]}<em>${ST_LABEL[st]}</em></span>`;
        return `<td class="c-${st} ${mine || isAdmin ? "addable" : ""}" data-route="${esc(route)}" data-user="${pl.user_id}">${content}</td>`;
      }).join("");
      return `<tr><th class="rlabel${route === current ? " current" : ""}">${route === current ? '<span class="here" title="Tu siguiente ruta">›</span>' : ""}${esc(route) || "Sin zona"}</th>${cells}</tr>`;
    }).join("");
  }).join("");

  $("routesTable").innerHTML = head + `<tbody>${body || `<tr><td class="empty-row" colspan="${cols.length + 1}">No hay rutas con este filtro.</td></tr>`}</tbody>`;

  $("routesTable").querySelectorAll(".zbtn").forEach((b) => (b.onclick = () => {
    collapsedZones.has(b.dataset.zone) ? collapsedZones.delete(b.dataset.zone) : collapsedZones.add(b.dataset.zone);
    renderRoutes();
  }));
  // editar un Pokémon propio desde su celda
  $("routesTable").querySelectorAll(".rmon").forEach((el) => (el.onclick = (ev) => {
    ev.stopPropagation(); openDialog(entries.find((e) => e.id === el.dataset.id));
  }));
  // clic en una casilla propia → elegir estado o registrar captura
  $("routesTable").querySelectorAll("td.addable").forEach((td) => (td.onclick = (ev) => {
    if (ev.target.closest(".rmon")) return;
    td.dataset.route ? openCell(td.dataset.route, td.dataset.user)
      : openDialog(null, "", players.find((p) => p.user_id === td.dataset.user));
  }));
}

let cellCtx = null;
function openCell(route, uid) {
  const pl = players.find((p) => p.user_id === uid);
  if (!pl) return;
  const { st, es } = cellState(uid, route);
  cellCtx = { route, uid, pl };
  $("cellTitle").textContent = route;
  $("cellWho").textContent = `${uid === user.id ? "Tu casilla" : "Casilla de " + (pl.profiles?.display_name || "???")} · ${ST_LABEL[st]}`;
  document.querySelectorAll("#cellDialog [data-act]").forEach((b) => {
    const act = b.dataset.act;
    b.disabled = es.length > 0 && (act === "none" || act === "failed");   // con captura no tiene sentido marcarla sin encuentro/fallida
    b.classList.toggle("sel", act === st);
  });
  $("cellDialog").showModal();
}
async function cellAction(act) {
  const { route, uid, pl } = cellCtx;
  if (act === "capture") { $("cellDialog").close(); return openDialog(null, route, pl); }
  const { error } = act === "pending"
    ? await db.from("route_status").delete().eq("user_id", uid).eq("route", route)
    : await db.from("route_status").upsert({ user_id: uid, route, status: act }, { onConflict: "user_id,route" });
  if (error) return toast(/route_status|schema cache/i.test(error.message) ? "Falta aplicar supabase/routes.sql en Supabase" : error.message, true);
  $("cellDialog").close();
  await reload();
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
      ? `<img class="favatar${isPhoto(prof.avatar) ? " photo" : ""}" src="${av}" alt="" loading="lazy" onerror="this.outerHTML='<span class=&quot;favatar dot-av&quot; style=&quot;background:${BRAND}&quot;></span>'">`
      : `<span class="favatar dot-av" style="background:${BRAND}"></span>`;
    return `<div class="friend ${pl.user_id === user.id ? "me-card" : ""}" data-user="${pl.user_id}" style="--fc:${BRAND}">
      ${bannerHTML(prof)}
      ${bigAv}
      <div class="fname"><span class="online-dot${presence.get(pl.user_id)?.online ? " on" : ""}" title="${presence.get(pl.user_id)?.online ? "Conectado" : "Desconectado"}"></span>${esc(prof.display_name)}</div>
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
  payoUid = uid;
  const admin = $("payoAdmin");
  admin.classList.toggle("hidden", !isAdmin);
  if (isAdmin) {
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
function refreshPayo() {
  if (!$("payoDialog").open || !payoUid) return;
  const pl = players.find((p) => p.user_id === payoUid);
  if (!pl) return $("payoDialog").close();   // la cuenta ya no existe
  fillPayo(pl);
}
function fillPayo(pl) {
  const prof = pl.profiles || { display_name: "???" };
  const es = entries.filter((e) => e.user_id === pl.user_id);
  const sect = (icon, title, st) => {
    const arr = es.filter((e) => e.status === st);
    return `<h4>${icon} ${title} <span class="count">${arr.length}</span></h4>
      <div class="list">${arr.map(isAdmin ? monCard : monCardRO).join("") || emptyState(st)}</div>`;
  };
  $("payoName").innerHTML = `${playerIcon(prof)}${esc(prof.display_name)}`;
  $("payoBanner").innerHTML = bannerHTML(prof, "payo-banner");
  if (isAdmin) { $("payoMedals").innerHTML = medalTilesHTML(pl.badges); wireMedalTiles($("payoMedals"), pl); }
  else $("payoMedals").innerHTML = medalsHTML(pl.badges);
  $("payoBody").innerHTML = sect(SVG.team, "Equipo", "team") + sect(SVG.box, "Caja", "box") + sect(SVG.dead, "Cementerio", "dead");
  if (isAdmin) wireMons($("payoBody"));
}
async function renamePlayer(uid) {
  const name = $("payoRename").value.trim();
  if (!name) return toast("Escribe un nombre", true);
  const { error } = await db.from("profiles").update({ display_name: name }).eq("id", uid);
  if (error) return toast(error.message, true);
  toast("Nombre cambiado", false, true);
  await reload();
}
async function deletePlayer(uid) {
  const name = players.find((p) => p.user_id === uid)?.profiles?.display_name || "este usuario";
  if (!confirm(`¿Eliminar a ${name}? Se borran su cuenta y todos sus Pokémon. No se puede deshacer.`)) return;
  const { error } = await db.rpc("admin_delete_user", { uid });
  if (error) return toast(error.message, true);
  $("payoDialog").close();
  toast("Usuario eliminado", false, true);
  await reload();
}

// fichas de medalla seleccionables una a una (Perfil propio y, para el admin, las de cualquier payo)
function medalTilesHTML(mask) {
  const tiles = MEDALS.map((m, k) => {
    const on = hasMedal(mask, k + 1);
    return `<button type="button" class="medal-tile ${on ? "on" : ""}" data-n="${k + 1}" aria-pressed="${on}" title="Medalla ${esc(m.name)}">
      <img src="${medalImg(m)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'"><span>${esc(m.name)}</span></button>`;
  }).join("");
  return `<div class="medals-head"><span class="medals-count"><b>${countMedals(mask)}</b>/${MEDALS.length}</span></div><div class="medal-grid">${tiles}</div>`;
}
function wireMedalTiles(root, pl) {
  root.querySelectorAll(".medal-tile").forEach((b) => (b.onclick = () => toggleMedal(pl, +b.dataset.n, root)));
}
function renderMedalsEdit() {
  if (!myPlayer) return;
  $("medalsEdit").innerHTML = `<h3>Medallas</h3>` + medalTilesHTML(myPlayer.badges);
  wireMedalTiles($("medalsEdit"), myPlayer);
}

async function toggleMedal(pl, i, root) {
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

// ===================== banners =====================
function renderBannerGrid() {
  const grid = $("bannerGrid");
  if (!grid || !profile || isAdmin) return;
  const cur = bannerOf(profile).id;
  grid.innerHTML = BANNERS.map((b) => `<button type="button" role="radio" aria-checked="${b.id === cur}" class="btile banner${b.id === cur ? " on" : ""}" data-b="${b.id}" style="${bannerVars(b)}" title="${esc(b.title)}">
    <img class="bart" src="${bannerArt(b)}" alt="" loading="lazy" onerror="this.style.display='none'">
    <span class="bname">${esc(b.name)}</span><span class="btitle">${esc(b.title)}</span></button>`).join("");
  grid.querySelectorAll(".btile").forEach((t) => (t.onclick = () => setBanner(user.id, t.dataset.b)));
}
async function setBanner(uid, id) {
  const banner = id === BANNERS[0].id ? null : id;
  const { error } = await db.from("profiles").update({ banner }).eq("id", uid);
  if (error) return toast(/banner|schema cache/i.test(error.message) ? "Falta aplicar supabase/banners.sql en Supabase" : error.message, true);
  if (uid === user.id) profile = { ...profile, banner };
  toast(`Banner: ${BANNERS.find((b) => b.id === id)?.name || "Clásico"}`, false, true);
  await reload();
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
  fillHours();
}
function updateAvatarPreview() {
  const url = $("pAvatarUrl").value.trim();
  const id = byName.get($("pAvatar").value.trim().toLowerCase());
  if (url) $("avatarPreview").innerHTML = `<img class="photo" src="${esc(url)}" alt="" onerror="this.style.display='none'"><span>Avatar por URL</span>`;
  else if (id) $("avatarPreview").innerHTML = `<img src="${sprite(id)}" alt=""><span>${esc(byId.get(id).es)}</span>`;
  else $("avatarPreview").innerHTML = `<span>Sin avatar (se usará un punto rojo)</span>`;
}
async function saveProfile() {
  const name = $("pName").value.trim();
  if (!name) return toast("Escribe un nombre", true);
  const url = $("pAvatarUrl").value.trim();
  const pid = byName.get($("pAvatar").value.trim().toLowerCase());
  const avatar = url || (pid ? String(pid) : null);
  const { error } = await db.from("profiles").update({ display_name: name, color: BRAND, avatar }).eq("id", user.id);
  if (error) return toast(error.message, true);
  profile = { ...profile, display_name: name, color: BRAND, avatar };
  toast("Perfil guardado", false, true);
  await reload();
}

// ===================== diálogo Pokémon =====================
function openDialog(entry = null, presetRoute = null, owner = null) {
  if (entry && entry.user_id !== user.id && !isAdmin) return;   // no se editan Pokémon de otros
  $("entryTitle").textContent = entry ? "Editar Pokémon" : "Registrar Pokémon";
  $("fId").value = entry?.id || "";
  $("fPokemon").value = entry ? byId.get(entry.pokemon_id)?.es || "" : "";
  $("fNickname").value = entry?.nickname || "";
  dialogOwner = owner || myPlayer;   // dueño del Pokémon nuevo (el admin puede crearlo en cualquier columna)
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
    pokemon_id: pid,
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
    : await db.from("entries").insert({ ...row, run_id: run.id, player_id: dialogOwner.id, user_id: dialogOwner.user_id, status: "box" });
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
