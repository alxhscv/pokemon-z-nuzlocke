import { BANNERS, SKINS } from "./config.js";
import { $, BRAND, S, bannerArt, bannerOf, bannerVars, byId, byName, db, esc, isPhoto, sprite, toast } from "./core.js";
import { reload } from "./data.js";
import { saveMotto } from "./api.js";
import { renderMedalsEdit } from "./payos.js";
import { fillHours } from "./presence.js";
import { applyThemeIcon } from "./shell.js";

// ===================== banners =====================
export function renderBannerGrid() {
  const grid = $("bannerGrid");
  if (!grid || !S.profile || S.isAdmin) return;
  const cur = bannerOf(S.profile).id;
  grid.innerHTML = BANNERS.map((b) => `<button type="button" role="radio" aria-checked="${b.id === cur}" class="btile banner${b.id === cur ? " on" : ""}" data-b="${b.id}" style="${bannerVars(b)}" title="${esc(b.name)}">
    <img class="bart" src="${bannerArt(b)}" alt="" loading="lazy" onerror="this.style.display='none'">
    <span class="bname">${esc(b.name)}</span></button>`).join("");
  grid.querySelectorAll(".btile").forEach((t) => (t.onclick = () => setBanner(S.user.id, t.dataset.b)));
}
export async function setBanner(uid, id) {
  const banner = id === BANNERS[0].id ? null : id;
  const { error } = await db.from("profiles").update({ banner }).eq("id", uid);
  if (error) return toast(/banner|schema cache/i.test(error.message) ? "Falta aplicar supabase/banners.sql en Supabase" : error.message, true);
  if (uid === S.user.id) S.profile = { ...S.profile, banner };
  toast(`Banner: ${BANNERS.find((b) => b.id === id)?.name || "Clásico"}`, false, true);
  await reload();
}

// ===================== temas de la web =====================
const skinOf = () => document.documentElement.dataset.skin || "clasico";
export function applySkin(id) {
  const sk = SKINS.find((s) => s.id === id) || SKINS[0], d = document.documentElement;
  try {
    if (sk.id === "clasico") {
      localStorage.removeItem("skin"); localStorage.removeItem("skinMode");
      d.removeAttribute("data-skin"); d.setAttribute("data-theme", localStorage.getItem("theme") === "light" ? "light" : "dark");
    } else {
      localStorage.setItem("skin", sk.id); localStorage.setItem("skinMode", sk.mode);
      d.setAttribute("data-skin", sk.id); d.setAttribute("data-theme", sk.mode);
    }
  } catch (e) {}
  applyThemeIcon();
  renderSkinGrid();
}
export function renderSkinGrid() {
  const grid = $("skinGrid");
  if (!grid) return;
  const cur = skinOf();
  grid.innerHTML = SKINS.map((s) => `<button type="button" role="radio" aria-checked="${s.id === cur}" class="stile${s.id === cur ? " on" : ""}" data-s="${esc(s.id)}" style="--p-bg:${s.bg};--p-sf:${s.surface};--p-ac:${s.accent}">
    <span class="sprev" aria-hidden="true"><i></i><b></b></span>
    <span class="sname">${esc(s.name)}</span><span class="smode">${s.mode === "light" ? "Claro" : s.mode === "dark" ? "Oscuro" : "Claro u oscuro"}</span></button>`).join("");
  grid.querySelectorAll(".stile").forEach((t) => (t.onclick = () => applySkin(t.dataset.s)));
}

// ===================== perfil =====================
export function fillProfile() {
  if (!S.profile) return;
  $("pName").value = S.profile.display_name;
  const av = S.profile.avatar;
  if (isPhoto(av)) { $("pAvatarUrl").value = av; $("pAvatar").value = ""; }
  else { $("pAvatar").value = av ? byId.get(+av)?.es || "" : ""; $("pAvatarUrl").value = ""; }
  $("pMotto").value = S.profile.motto || "";
  updateAvatarPreview();
  renderMedalsEdit();
  fillHours();
}
export function updateAvatarPreview() {
  const url = $("pAvatarUrl").value.trim();
  const id = byName.get($("pAvatar").value.trim().toLowerCase());
  if (url) $("avatarPreview").innerHTML = `<img class="photo" src="${esc(url)}" alt="" onerror="this.style.display='none'"><span>Avatar por URL</span>`;
  else if (id) $("avatarPreview").innerHTML = `<img src="${sprite(id)}" alt=""><span>${esc(byId.get(id).es)}</span>`;
  else $("avatarPreview").innerHTML = `<span>Sin avatar (se usará un punto rojo)</span>`;
}
export async function saveProfile() {
  const name = $("pName").value.trim();
  if (!name) return toast("Escribe un nombre", true);
  const url = $("pAvatarUrl").value.trim();
  const pid = byName.get($("pAvatar").value.trim().toLowerCase());
  const avatar = url || (pid ? String(pid) : null);
  const { error } = await db.from("profiles").update({ display_name: name, color: BRAND, avatar }).eq("id", S.user.id);
  if (error) return toast(error.message, true);
  const motto = $("pMotto").value.trim().slice(0, 40);
  if (motto !== (S.profile.motto || "")) {
    try { await saveMotto(motto); } catch (e) { return toast(e.message || "No se pudo guardar la frase", true); }
  }
  S.profile = { ...S.profile, display_name: name, color: BRAND, avatar, motto };
  toast("Perfil guardado", false, true);
  await reload();
}
