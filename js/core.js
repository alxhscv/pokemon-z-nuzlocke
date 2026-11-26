import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.0/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY, ROUTES, MEDALS, BANNERS } from "./config.js";

// estado compartido entre módulos (los `let` importados no se pueden reasignar desde fuera)
export const S = { user: null, profile: null, run: null, myPlayer: null, players: [], entries: [], routeStatus: [], isAdmin: false, payoUid: null, battles: [], wallets: {}, pulls: [], myPulls: [] };
export const byId = new Map(), byName = new Map();

export const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export const sprite = (id) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
export const $ = (id) => document.getElementById(id);

// iconos SVG (presentación; sustituyen a los emojis)
export const itemImg = (n) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${n}.png`;
export const itemTag = (n) => `<img class="iimg" src="${itemImg(n)}" alt="" width="30" height="30" onerror="this.style.visibility='hidden'">`;
export const SVG = { box: itemTag("great-ball"), team: itemTag("poke-ball"), dead: itemTag("old-amber") };
// estados de vacío con ilustración + texto con gracia
export const EMPTY = {
  team: ["M5 3l4 4M19 3l-4 4M4 8h16l-1.5 11a2 2 0 01-2 1.7H7.5a2 2 0 01-2-1.7z", "Tu equipo está vacío. ¡A la hierba alta!"],
  box: ["M3 4h18v5H3zM3 9h18v11H3zM10 13h4", "La caja está vacía. De momento."],
  dead: ["M6 21V10a6 6 0 0112 0v11z|M12 7v5M9.5 9.5h5", "El cementerio está vacío. Que siga así."],
};
export function emptyState(st) {
  const [d, txt] = EMPTY[st] || ["", "Nada por aquí."];
  return `<div class="empty-state">${{ team: SVG.team, box: SVG.box, dead: SVG.dead }[st] || ""}<span>${txt}</span></div>`;
}

// banners de perfil
export const bannerOf = (prof) => BANNERS.find((b) => b.id === prof?.banner) || BANNERS[0];
export const bannerArt = (b) => b.item ? itemImg(b.item)
  : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${b.shiny ? "shiny/" : ""}${b.pk}.png`;
export const bannerVars = (b) => `--b1:${b.c1};--b2:${b.c2}`;
export function bannerHTML(prof, cls = "fhead") {
  const b = bannerOf(prof);
  return `<div class="${cls} banner" style="${bannerVars(b)}"><img class="bart" src="${bannerArt(b)}" alt="" loading="lazy" onerror="this.style.display='none'">${prof?.motto ? `<span class="btitle">${esc(prof.motto)}</span>` : ""}</div>`;
}

// color de jugador: ahora fijo (rojo) para todos
export const BRAND = "#E3350D";
// medallas: `players.badges` es una máscara de bits (bit i-1 = medalla i), así se marcan sueltas
export const medalImg = (m) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/${m.img}.png`;
export const hasMedal = (mask, i) => ((mask || 0) >> (i - 1)) & 1;
export const countMedals = (mask) => MEDALS.reduce((n, _, k) => n + hasMedal(mask, k + 1), 0);
// avatar: un número = Pokémon por id; cualquier otra cosa = URL de imagen
export function avatarSrc(av) { if (av == null || av === "") return null; av = String(av); return /^\d+$/.test(av) ? sprite(av) : esc(av); }  // URL escapada: se interpola en atributos HTML
export function isPhoto(av) { return av != null && av !== "" && !/^\d+$/.test(String(av)); }
export const uname2email = (u) => u.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "") + "@users.pokez";
export const ADMIN_EMAIL = "admin@users.pokez";   // la seguridad real está en RLS (supabase/admin.sql); esto solo adapta la interfaz
export const normLoc = (s) => (s || "").trim().toLowerCase();
export const ROUTE_NORMS = new Set(ROUTES.map(normLoc));

// confeti dorado (medalla nueva)
export function confetti() {
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

// avatar del jugador: sprite/imagen si tiene avatar, si no un punto rojo
export function playerIcon(prof) {
  const src = avatarSrc(prof?.avatar);
  const dot = `<span class="dot" style="background:${BRAND}"></span>`;
  if (src) return `<img class="avatar${isPhoto(prof.avatar) ? " photo" : ""}" src="${src}" alt="" loading="lazy" onerror="this.outerHTML='<span class=&quot;dot&quot; style=&quot;background:${BRAND}&quot;></span>'">`;
  return dot;
}

// ===================== utilidades =====================
export function show(id) { for (const s of ["auth", "app"]) $(s).classList.toggle("hidden", s !== id); }
export function esc(s) { return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
export let toastT;
export function toast(msg, err = false, ok = false) {
  const t = $("toast"); t.textContent = msg; t.className = "toast" + (err ? " err" : ok ? " ok" : "");
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.add("hidden"), 2800);
}
