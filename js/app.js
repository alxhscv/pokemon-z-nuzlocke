import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.0/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY, LOCATIONS } from "./config.js";

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const sprite = (id) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
const $ = (id) => document.getElementById(id);

// ---- estado ----
let POKE = [];                 // [{id, es, en}]
const byId = new Map();        // id -> pokemon
const byName = new Map();      // nombre(minúsculas) -> id
let run = null, me = null, players = [], entries = [], channel = null;

const STATUS = { team: "Equipo", box: "Caja", dead: "Muerto" };

// ===================== arranque =====================
init();
async function init() {
  POKE = await fetch("data/pokemon.json").then((r) => r.json());
  for (const p of POKE) { byId.set(p.id, p); byName.set(p.es.toLowerCase(), p.id); byName.set(p.en.toLowerCase(), p.id); }
  $("pokeList").innerHTML = POKE.map((p) => `<option value="${p.es}">`).join("");
  $("locList").innerHTML = LOCATIONS.map((l) => `<option value="${l}">`).join("");
  wireEvents();
  await resume();
}

function wireEvents() {
  $("createRunBtn").onclick = createRun;
  $("joinRunBtn").onclick = () => joinByCode($("joinCode").value);
  $("createPlayerBtn").onclick = createPlayer;
  $("leaveBtn").onclick = leave;
  $("copyCodeBtn").onclick = () => { navigator.clipboard?.writeText(run.code); toast("Código copiado"); };
  $("addBtn").onclick = () => openDialog();
  $("badgePlus").onclick = () => setBadges(me.badges + 1);
  $("badgeMinus").onclick = () => setBadges(me.badges - 1);
  $("cancelBtn").onclick = () => $("entryDialog").close();
  $("deleteBtn").onclick = deleteEntry;
  $("entryForm").onsubmit = (e) => { e.preventDefault(); saveEntry(); };
  $("fPokemon").oninput = updatePreview;
}

// ===================== partidas =====================
async function createRun() {
  const name = $("newRunName").value.trim();
  if (!name) return toast("Ponle nombre a la partida", true);
  const mode = $("newRunMode").value;
  for (let i = 0; i < 5; i++) {                       // reintenta si el código choca
    const code = randomCode();
    const { data, error } = await db.from("runs").insert({ code, name, mode }).select().single();
    if (!error) return enterRun(data);
    if (error.code !== "23505") return toast(error.message, true);   // 23505 = código duplicado
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

async function enterRun(r) {
  run = r;
  localStorage.setItem("pz_run_code", r.code);
  $("runCodeLabel").textContent = r.code;
  $("runInfo").classList.remove("hidden");
  $("setupRunName").textContent = r.name;
  players = await listPlayers();
  renderPlayerPicker();
  show("setup");
}

async function resume() {
  const code = localStorage.getItem("pz_run_code");
  if (!code) return;
  const { data } = await db.from("runs").select().eq("code", code).maybeSingle();
  if (!data) { localStorage.clear(); return; }
  await enterRun(data);
  const pid = localStorage.getItem("pz_player_id");
  const mine = players.find((p) => p.id === pid);
  if (mine) startApp(mine);
}

function leave() {
  localStorage.removeItem("pz_run_code");
  localStorage.removeItem("pz_player_id");
  channel?.unsubscribe();
  run = me = null; players = []; entries = [];
  $("runInfo").classList.add("hidden");
  show("gate");
}

// ===================== jugadores =====================
const listPlayers = async () =>
  (await db.from("players").select().eq("run_id", run.id).order("created_at")).data || [];

function renderPlayerPicker() {
  $("playerPicker").innerHTML = players.length
    ? players.map((p) => `<button class="player-pick" data-id="${p.id}">
        <span class="dot" style="background:${p.color}"></span>${esc(p.name)}</button>`).join("")
    : `<span class="muted">Aún no hay entrenadores. Crea el primero 👇</span>`;
  $("playerPicker").querySelectorAll(".player-pick").forEach((b) =>
    (b.onclick = () => startApp(players.find((p) => p.id === b.dataset.id))));
}

async function createPlayer() {
  const name = $("newPlayerName").value.trim();
  if (!name) return toast("Escribe tu nombre", true);
  const color = $("newPlayerColor").value;
  const { data, error } = await db.from("players").insert({ run_id: run.id, name, color }).select().single();
  if (error) return toast(error.code === "23505" ? "Ese nombre ya existe en la partida" : error.message, true);
  players.push(data);
  startApp(data);
}

// ===================== app principal =====================
async function startApp(player) {
  me = player;
  localStorage.setItem("pz_player_id", player.id);
  $("meChip").innerHTML = `<span class="dot" style="background:${me.color}"></span>${esc(me.name)}`;
  show("app");
  await reload();
  subscribe();
}

async function reload() {
  players = await listPlayers();
  me = players.find((p) => p.id === me.id) || me;
  entries = (await db.from("entries").select().eq("run_id", run.id).order("created_at")).data || [];
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
  $("badgeCount").textContent = me.badges;
  const mine = entries.filter((e) => e.player_id === me.id);
  for (const st of ["team", "box", "dead"]) {
    const items = mine.filter((e) => e.status === st);
    $("cnt-" + st).textContent = items.length;
    $("list-" + st).innerHTML = items.map(monCard).join("") ||
      `<span class="muted" style="font-size:.8rem">Vacío</span>`;
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
    const es = entries.filter((e) => e.player_id === pl.id);
    const alive = es.filter((e) => e.status !== "dead");
    const dead = es.filter((e) => e.status === "dead");
    const team = es.filter((e) => e.status === "team");
    const chips = team.map((e) => `<img src="${sprite(e.pokemon_id)}" title="${esc(e.nickname || byId.get(e.pokemon_id)?.es || "")}" loading="lazy" onerror="this.style.display='none'">`).join("")
      || `<span class="muted" style="font-size:.8rem">Sin equipo</span>`;
    return `<div class="friend ${pl.id === me.id ? "me-card" : ""}" style="border-top-color:${pl.color}">
      <div class="fname"><span class="dot" style="background:${pl.color}"></span>${esc(pl.name)}</div>
      <div class="stats">
        <span><b>${alive.length}</b> vivos</span>
        <span><b>${dead.length}</b> muertos</span>
        <span><b>${pl.badges}</b>/12 medallas</span>
      </div>
      <div class="team">${chips}</div>
    </div>`;
  }).join("");
}

async function setBadges(n) {
  n = Math.max(0, Math.min(12, n));
  if (n === me.badges) return;
  const prev = me.badges; me.badges = n; $("badgeCount").textContent = n;   // optimista
  const { error } = await db.from("players").update({ badges: n }).eq("id", me.id);
  if (error) { me.badges = prev; $("badgeCount").textContent = prev; toast(error.message, true); }
}

// ===================== diálogo registrar/editar =====================
function openDialog(entry = null) {
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
    run_id: run.id, player_id: me.id, pokemon_id: pid,
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
  await reload();                 // realtime también refresca; esto da respuesta inmediata
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
function show(id) { for (const s of ["gate", "setup", "app"]) $(s).classList.toggle("hidden", s !== id); }
function randomCode() { const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; return Array.from({ length: 4 }, () => a[Math.floor(Math.random() * a.length)]).join(""); }
function esc(s) { return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
let toastT;
function toast(msg, err = false) {
  const t = $("toast"); t.textContent = msg; t.className = "toast" + (err ? " err" : "");
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.add("hidden"), 2600);
}
