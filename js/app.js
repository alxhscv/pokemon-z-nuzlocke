import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.0/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY, LOCATIONS } from "./config.js";

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const sprite = (id) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
const $ = (id) => document.getElementById(id);
// El "usuario" es local: internamente se mapea a un email sintético (sin verificación).
const uname2email = (u) => u.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "") + "@users.pokez";

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
  $("locList").innerHTML = LOCATIONS.map((l) => `<option value="${l}">`).join("");
  wireEvents();
  db.auth.onAuthStateChange((event) => { if (event === "SIGNED_OUT") resetToAuth(); });
  const { data } = await db.auth.getSession();
  data.session ? afterLogin() : showAuth();
}

function wireEvents() {
  $("authSubmit").onclick = doAuth;
  $("authPass").onkeydown = (e) => { if (e.key === "Enter") doAuth(); };
  $("switchMode").onclick = (e) => { e.preventDefault(); toggleAuthMode(); };
  $("logoutBtn").onclick = () => db.auth.signOut();
  $("createRunBtn").onclick = createRun;
  $("joinRunBtn").onclick = () => joinByCode($("joinCode").value);
  $("leaveBtn").onclick = backToGate;
  $("copyCodeBtn").onclick = () => { navigator.clipboard?.writeText(run.code); toast("Código copiado"); };
  $("addBtn").onclick = () => openDialog();
  $("badgePlus").onclick = () => setBadges(myPlayer.badges + 1);
  $("badgeMinus").onclick = () => setBadges(myPlayer.badges - 1);
  $("cancelBtn").onclick = () => $("entryDialog").close();
  $("deleteBtn").onclick = deleteEntry;
  $("entryForm").onsubmit = (e) => { e.preventDefault(); saveEntry(); };
  $("fPokemon").oninput = updatePreview;
}

// ===================== auth =====================
function showAuth() { signupMode = false; applyAuthMode(); $("userInfo").classList.add("hidden"); show("auth"); }
function toggleAuthMode() { signupMode = !signupMode; applyAuthMode(); }
function applyAuthMode() {
  $("authTitle").textContent = signupMode ? "Crear cuenta" : "Iniciar sesión";
  $("authSub").textContent = signupMode ? "Elige usuario, contraseña y color." : "Entra con tu usuario y contraseña.";
  $("authSubmit").textContent = signupMode ? "Crear cuenta" : "Entrar";
  $("switchText").textContent = signupMode ? "¿Ya tienes cuenta?" : "¿No tienes cuenta?";
  $("switchMode").textContent = signupMode ? "Inicia sesión" : "Crear una";
  $("colorField").classList.toggle("hidden", !signupMode);
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
      await db.from("profiles").upsert({ id: data.user.id, display_name: uname, color: $("authColor").value });
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
  // garantiza perfil (por si se creó la cuenta sin él)
  let { data: prof } = await db.from("profiles").select().eq("id", user.id).maybeSingle();
  if (!prof) {
    const name = user.email.split("@")[0];
    ({ data: prof } = await db.from("profiles").insert({ id: user.id, display_name: name }).select().single());
  }
  profile = prof;
  $("userChip").innerHTML = `<span class="dot" style="background:${profile.color}"></span>${esc(profile.display_name)}`;
  $("userInfo").classList.remove("hidden");
  await routeAfterLogin();
}

async function routeAfterLogin() {
  const code = localStorage.getItem("pz_run_code");
  if (code) {
    const { data } = await db.from("runs").select().eq("code", code).maybeSingle();
    if (data) return enterRun(data, false);
    localStorage.removeItem("pz_run_code");
  }
  backToGate();
}

function resetToAuth() {
  channel?.unsubscribe();
  user = profile = run = myPlayer = null; players = []; entries = [];
  localStorage.removeItem("pz_run_code");
  showAuth();
}

// ===================== partidas =====================
async function backToGate() {
  channel?.unsubscribe(); channel = null;
  run = myPlayer = null;
  localStorage.removeItem("pz_run_code");
  $("runCodeWrap").classList.add("hidden");
  await loadMyRuns();
  show("gate");
}

async function loadMyRuns() {
  const { data } = await db.from("players").select("badges, runs(*)").eq("user_id", user.id);
  const runs = (data || []).map((r) => r.runs).filter(Boolean);
  $("myRunsCard").classList.toggle("hidden", runs.length === 0);
  $("myRuns").innerHTML = runs.map((r) =>
    `<button class="player-pick" data-code="${r.code}">${esc(r.name)} <span class="muted">· ${r.code}</span></button>`).join("");
  $("myRuns").querySelectorAll(".player-pick").forEach((b) =>
    (b.onclick = async () => {
      const { data } = await db.from("runs").select().eq("code", b.dataset.code).maybeSingle();
      if (data) enterRun(data);
    }));
}

async function createRun() {
  const name = $("newRunName").value.trim();
  if (!name) return toast("Ponle nombre a la partida", true);
  const mode = $("newRunMode").value;
  for (let i = 0; i < 5; i++) {
    const code = randomCode();
    const { data, error } = await db.from("runs").insert({ code, name, mode, owner_id: user.id }).select().single();
    if (!error) return enterRun(data);
    if (error.code !== "23505") return toast(error.message, true);
  }
  toast("No se pudo generar un código, reintenta", true);
}

async function joinByCode(raw) {
  const code = (raw || "").trim().toUpperCase();
  if (!code) return toast("Escribe un código", true);
  const { data, error } = await db.from("runs").select().eq("code", code).maybeSingle();
  if (error) return toast(error.message, true);
  if (!data) return toast("No existe ninguna partida con ese código", true);
  enterRun(data);
}

async function enterRun(r, join = true) {
  run = r;
  // asegura que soy miembro (me añado a mí mismo)
  await db.from("players").upsert({ run_id: r.id, user_id: user.id }, { onConflict: "run_id,user_id", ignoreDuplicates: true });
  const { data: mine } = await db.from("players").select().eq("run_id", r.id).eq("user_id", user.id).maybeSingle();
  if (!mine) return toast("No se pudo entrar en la partida", true);
  myPlayer = mine;
  localStorage.setItem("pz_run_code", r.code);
  $("runCodeLabel").textContent = r.code;
  $("runCodeWrap").classList.remove("hidden");
  show("app");
  await reload();
  subscribe();
}

// ===================== datos + render =====================
async function reload() {
  const [{ data: pl }, { data: en }] = await Promise.all([
    db.from("players").select("id, user_id, badges, profiles(display_name, color)").eq("run_id", run.id).order("created_at"),
    db.from("entries").select().eq("run_id", run.id).order("created_at"),
  ]);
  players = pl || []; entries = en || [];
  myPlayer = players.find((p) => p.user_id === user.id) || myPlayer;
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
  $("meChip").innerHTML = `<span class="dot" style="background:${profile.color}"></span>${esc(profile.display_name)}`;
  $("badgeCount").textContent = myPlayer?.badges ?? 0;
  const mine = entries.filter((e) => e.user_id === user.id);
  for (const st of ["team", "box", "dead"]) {
    const items = mine.filter((e) => e.status === st);
    $("cnt-" + st).textContent = items.length;
    $("list-" + st).innerHTML = items.map(monCard).join("") || `<span class="muted" style="font-size:.8rem">Vacío</span>`;
  }
  $("myColumns").querySelectorAll(".mon").forEach((el) =>
    (el.onclick = () => openDialog(entries.find((e) => e.id === el.dataset.id))));
  renderFriends();
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
      <div class="fname"><span class="dot" style="background:${prof.color}"></span>${esc(prof.display_name)}</div>
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

// ===================== diálogo =====================
function openDialog(entry = null) {
  const own = !entry || entry.user_id === user.id;
  if (entry && !own) return;                       // no se editan Pokémon de otros
  $("entryTitle").textContent = entry ? "Editar Pokémon" : "Registrar Pokémon";
  $("fId").value = entry?.id || "";
  $("fPokemon").value = entry ? byId.get(entry.pokemon_id)?.es || "" : "";
  $("fNickname").value = entry?.nickname || "";
  $("fLocation").value = entry?.location || "";
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
function show(id) { for (const s of ["auth", "gate", "app"]) $(s).classList.toggle("hidden", s !== id); }
function randomCode() { const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; return Array.from({ length: 4 }, () => a[Math.floor(Math.random() * a.length)]).join(""); }
function esc(s) { return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
let toastT;
function toast(msg, err = false) {
  const t = $("toast"); t.textContent = msg; t.className = "toast" + (err ? " err" : "");
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.add("hidden"), 2800);
}
