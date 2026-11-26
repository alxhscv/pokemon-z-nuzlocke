import { $, S, confetti, db, esc, itemTag, toast } from "./core.js";

// ===================== misiones =====================
// La recompensa vive en otra tabla (mission_rewards) con RLS: el servidor solo la entrega al completar la misión.
export const REWARD_ITEMS = [["poke-ball", "Poké Ball"], ["great-ball", "Super Ball"], ["ultra-ball", "Ultra Ball"], ["master-ball", "Master Ball"], ["premier-ball", "Honor Ball"], ["potion", "Poción"], ["revive", "Revivir"], ["rare-candy", "Caramelo Raro"], ["exp-share", "Repartir Exp."], ["lucky-egg", "Huevo Suerte"], ["tm-normal", "MT"], ["escape-rope", "Cuerda Huida"], ["sun-stone", "Piedra Solar"], ["old-amber", "Ámbar Viejo"], ["town-map", "Mapa"]];
export const LOCK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>`;
export let missions = [], rewards = new Map(), completions = [], missionId = null;
export async function loadMissions() {
  const [m, r, c] = await Promise.all([
    db.from("missions").select("id,title,description").order("created_at"),
    db.from("mission_rewards").select("mission_id,reward_text,reward_item"),
    db.from("mission_completions").select("mission_id,user_id"),
  ]);
  if (!S.user) return;
  if (m.error) return toast("No se pudieron cargar las misiones", true);
  missions = m.data || []; rewards = new Map((r.data || []).map((x) => [x.mission_id, x])); completions = c.data || [];
  renderMissions();
}
export function renderMissions() {
  const mine = new Set(completions.filter((c) => c.user_id === S.user.id).map((c) => c.mission_id));
  const total = missions.length;
  $("missionsHead").innerHTML = S.isAdmin
    ? `<button type="button" class="btn primary" id="newMissionBtn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span>Nueva misión</span></button>`
    : `<div class="mprogress"><span><b>${mine.size}</b>/${total} completadas</span><div class="bar" role="progressbar" aria-label="Misiones completadas" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${mine.size}"><i style="width:${total ? (mine.size / total) * 100 : 0}%"></i></div></div>`;
  $("missionList").innerHTML = missions.map((m) => {
    const done = mine.has(m.id), rw = rewards.get(m.id);
    const n = completions.filter((c) => c.mission_id === m.id).length;
    const reward = rw
      ? `<div class="reward open">${rw.reward_item ? itemTag(rw.reward_item) : ""}<div><small>Recompensa</small><b>${esc(rw.reward_text)}</b></div></div>`
      : `<div class="reward locked">${LOCK}<div><small>Recompensa</small><b>Oculta hasta completar</b></div></div>`;
    const action = S.isAdmin ? `<button type="button" class="btn ghost" data-edit="${esc(m.id)}">Editar</button>`
      : done ? `<span class="done-tag">Completada</span>`
      : `<button type="button" class="btn primary" data-done="${esc(m.id)}">Marcar completada</button>`;
    return `<article class="card mission${done ? " done" : ""}">
      <h3>${esc(m.title)}</h3>
      ${m.description ? `<p class="muted">${esc(m.description)}</p>` : ""}
      ${reward}
      <footer><span class="muted">${n} jugador${n === 1 ? "" : "es"} la ${n === 1 ? "completó" : "completaron"}</span>${action}</footer>
    </article>`;
  }).join("") || `<div class="empty-state">${itemTag("tm-normal")}<span>${S.isAdmin ? "Aún no hay misiones. Crea la primera." : "No hay misiones por ahora."}</span></div>`;
}
export async function completeMission(id) {
  const m = missions.find((x) => x.id === id);
  if (!m || !confirm(`¿Marcar «${m.title}» como completada? Se revelará la recompensa y no se puede deshacer.`)) return;
  const { error } = await db.from("mission_completions").insert({ mission_id: id, user_id: S.user.id });
  if (error && error.code !== "23505") return toast(error.message, true);
  await loadMissions();
  confetti(); toast("¡Misión completada!", false, true);
}
export function openMission(m = null) {
  missionId = m?.id || null;
  const rw = m && rewards.get(m.id);
  $("missionTitle").textContent = m ? "Editar misión" : "Nueva misión";
  $("mTitle").value = m?.title || ""; $("mDesc").value = m?.description || "";
  $("mReward").value = rw?.reward_text || ""; $("mItem").value = rw?.reward_item || "";
  $("mDelete").classList.toggle("hidden", !m);
  $("missionDialog").showModal();
}
export async function saveMission() {
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
export async function deleteMission() {
  if (!missionId || !confirm("¿Borrar esta misión? Se pierden también las completadas.")) return;
  const { error } = await db.from("missions").delete().eq("id", missionId);
  if (error) return toast(error.message, true);
  $("missionDialog").close(); await loadMissions();
}

export function wireMissions() {
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

