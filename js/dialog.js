import { $, S, byId, byName, db, esc, sprite, toast } from "./core.js";
import { reload } from "./data.js";

let dialogOwner = null, currentLoc = null;

// ===================== diálogo Pokémon =====================
export function openDialog(entry = null, presetRoute = null, owner = null) {
  if (entry && entry.user_id !== S.user.id && !S.isAdmin) return;   // no se editan Pokémon de otros
  $("entryTitle").textContent = entry ? "Editar Pokémon" : "Registrar Pokémon";
  $("fId").value = entry?.id || "";
  $("fPokemon").value = entry ? byId.get(entry.pokemon_id)?.es || "" : "";
  $("fNickname").value = entry?.nickname || "";
  dialogOwner = owner || S.myPlayer;   // dueño del Pokémon nuevo (el admin puede crearlo en cualquier columna)
  currentLoc = entry?.location || presetRoute || null;   // zona: de la ruta clicada o la que ya tenía
  $("fLevel").value = entry?.level || "";
  $("fNotes").value = entry?.notes || "";
  $("deleteBtn").classList.toggle("hidden", !entry);
  updatePreview();
  $("entryDialog").showModal();
}

export function updatePreview() {
  const id = byName.get($("fPokemon").value.trim().toLowerCase());
  $("pokePreview").innerHTML = id
    ? `<img src="${sprite(id)}" alt=""><span>${esc(byId.get(id).es)} · Nº ${id}</span>`
    : `<span>Escribe un nombre de Pokémon válido</span>`;
}

export async function saveEntry() {
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
    : await db.from("entries").insert({ ...row, run_id: S.run.id, player_id: dialogOwner.id, user_id: dialogOwner.user_id, status: "box" });
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

export async function deleteEntry() {
  const id = $("fId").value;
  if (!id || !confirm("¿Borrar este Pokémon?")) return;
  const { error } = await db.from("entries").delete().eq("id", id);
  if (error) return toast(error.message, true);
  $("entryDialog").close();
  await reload();
}
