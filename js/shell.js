import { fillProfile } from "./perfil.js";
import { loadMissions } from "./misiones.js";
import { renderRanking } from "./ranking.js";
import { renderGacha } from "./gacha.js";
import { $ } from "./core.js";

// pestañas
export function selectTab(name) {
  document.querySelectorAll(".tab").forEach((b) => {
    const on = b.dataset.tab === name;
    b.classList.toggle("active", on);
    b.setAttribute("aria-selected", on ? "true" : "false");
  });
  document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", p.id === "panel-" + name));
  if (name === "perfil") fillProfile();
  if (name === "misiones") loadMissions();
  if (name === "ranking") renderRanking();
  if (name === "gacha") renderGacha();
}

// tema claro/oscuro (botón + prefers-color-scheme por defecto)
export function currentTheme() {
  const set = document.documentElement.getAttribute("data-theme");
  if (set) return set;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
export function toggleTheme() {
  const next = currentTheme() === "dark" ? "light" : "dark";
  const apply = () => { document.documentElement.setAttribute("data-theme", next); applyThemeIcon(); };
  try { localStorage.setItem("theme", next); } catch (e) {}
  // crossfade único de toda la página (evita que cada elemento transicione por su cuenta); sin él o con reduced-motion, cambio directo
  if (document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) document.startViewTransition(apply);
  else apply();
}
export function toggleMenu() { const o = $("userMenu").classList.toggle("hidden"); $("userChip").setAttribute("aria-expanded", String(!o)); }
export function closeMenu() { $("userMenu")?.classList.add("hidden"); $("userChip")?.setAttribute("aria-expanded", "false"); }
export function applyThemeIcon() {
  const dark = currentTheme() === "dark";
  // el icono y el texto muestran el tema ACTUAL
  document.querySelector(".icon-moon")?.classList.toggle("hidden", !dark);
  document.querySelector(".icon-sun")?.classList.toggle("hidden", dark);
  $("themeName").textContent = $("menuThemeName").textContent = dark ? "Oscuro" : "Claro";
  $("themeToggle")?.setAttribute("aria-label", dark ? "Cambiar a tema claro" : "Cambiar a tema oscuro");
}

// skeletons mientras carga Supabase
export function showSkeletons() {
  const sk = `<div class="skel skel-mon"></div>`.repeat(3);
  for (const st of ["team", "box", "dead"]) $("list-" + st).innerHTML = sk;
}
