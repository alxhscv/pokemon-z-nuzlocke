import { $, S, byId, byName, db, toast } from "./core.js";
import { afterLogin, doAuth, resetToAuth, showAuth, toggleAuthMode, updateAuthAvatarPreview } from "./auth.js";
import { stopPresence, toggleClock } from "./presence.js";
import { applyThemeIcon, closeMenu, selectTab, toggleMenu, toggleTheme } from "./shell.js";
import { cellAction } from "./rutas.js";
import { deleteEntry, openDialog, saveEntry, updatePreview } from "./dialog.js";
import { saveProfile, updateAvatarPreview } from "./perfil.js";
import { wireMissions } from "./misiones.js";

let POKE = [];

window.addEventListener("unhandledrejection", (e) => { e.preventDefault(); console.error(e.reason); toast("Algo ha fallado. Si se repite, recarga la página.", true); });
init().catch((e) => { console.error(e); toast("No se pudo iniciar la web", true); });
function showIntroState() { $("menuIntroName").textContent = localStorage.getItem("intro") === "0" ? "Desactivada" : "Activada"; }

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
  showIntroState();
  db.from("app_settings").select("value").eq("key", "intro_enabled").maybeSingle().then(({ data }) => { if (data) { localStorage.setItem("intro", data.value ? "1" : "0"); showIntroState(); } });
  $("logoutBtn").onclick = async () => { await stopPresence(true); db.auth.signOut(); };
  $("meChip").onclick = () => { if (!S.isAdmin) selectTab("perfil"); };
  $("userChip").onclick = (e) => { e.stopPropagation(); toggleMenu(); };
  $("menuProfile").onclick = () => { closeMenu(); selectTab("perfil"); };
  $("menuIntro").onclick = async () => {
    const on = localStorage.getItem("intro") === "0";   // el nuevo valor es el contrario del actual
    const { error } = await db.from("app_settings").upsert({ key: "intro_enabled", value: on });
    if (error) return toast("No se pudo cambiar la intro (¿ejecutaste supabase/intro.sql?)", true);
    localStorage.setItem("intro", on ? "1" : "0"); showIntroState(); closeMenu();
  };
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
  wireMissions();
}
