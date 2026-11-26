import { $, ADMIN_EMAIL, BRAND, S, byId, byName, db, esc, show, sprite, toast, uname2email } from "./core.js";
import { reload, subscribe, unsubscribeAll } from "./data.js";
import { resetPresence, startPresence, stopPresence } from "./presence.js";
import { selectTab, showSkeletons } from "./shell.js";

let signupMode = false;

// ===================== auth =====================
export function showAuth() { signupMode = false; applyAuthMode(); $("userInfo").classList.add("hidden"); show("auth"); }
export function toggleAuthMode() { signupMode = !signupMode; applyAuthMode(); }
export function applyAuthMode() {
  $("authTitle").textContent = signupMode ? "Nueva partida" : "Continuar partida";
  $("authSub").textContent = signupMode ? "Elige tu nombre, tu clave y tu avatar." : "Escribe tu nombre y tu clave.";
  $("authSubmit").textContent = signupMode ? "¡Empezar aventura!" : "Continuar";
  $("switchText").textContent = signupMode ? "¿Ya tienes partida?" : "¿Primera vez por aquí?";
  $("switchMode").textContent = signupMode ? "Continuar" : "Nueva partida";
  $("avatarField").classList.toggle("hidden", !signupMode);
  $("authAvatarPreview").classList.toggle("hidden", !signupMode);
  if (signupMode) updateAuthAvatarPreview();
}
export function updateAuthAvatarPreview() {
  const id = byName.get($("authAvatar").value.trim().toLowerCase());
  $("authAvatarPreview").innerHTML = id
    ? `<img src="${sprite(id)}" alt=""><span>${esc(byId.get(id).es)}</span>`
    : `<span>Elige un Pokémon como avatar (opcional)</span>`;
}

export async function doAuth() {
  const uname = $("authUser").value.trim();
  const pass = $("authPass").value;
  if (!uname) return toast("¡Dime tu nombre, entrenador!", true);
  if (pass.length < 6) return toast("La clave necesita al menos 6 caracteres.", true);
  const email = uname2email(uname);
  $("authSubmit").disabled = true;
  try {
    if (signupMode) {
      const { data, error } = await db.auth.signUp({ email, password: pass });
      if (error) return toast(traduceAuth(error.message), true);
      if (!data.session) return toast("¡Cuenta creada! Ahora continúa tu partida.", true);
      const pid = byName.get($("authAvatar").value.trim().toLowerCase());
      await db.from("profiles").upsert({ id: data.user.id, display_name: uname, color: BRAND, avatar: pid ? String(pid) : null });
    } else {
      const { error } = await db.auth.signInWithPassword({ email, password: pass });
      if (error) return toast(traduceAuth(error.message), true);
    }
    await afterLogin();
  } finally { $("authSubmit").disabled = false; }
}

export function traduceAuth(m) {
  if (/already registered/i.test(m)) return "Ese nombre ya lo tiene otro entrenador.";
  if (/Invalid login/i.test(m)) return "Nombre o clave incorrectos.";
  if (/at least/i.test(m)) return "La clave es demasiado corta.";
  return m;
}

export async function afterLogin() {
  const { data } = await db.auth.getUser();
  S.user = data.user;
  if (!S.user) { await db.auth.signOut(); return showAuth(); }   // sesión caducada/ inválida → al login
  S.isAdmin = S.user.email === ADMIN_EMAIL;
  if (S.isAdmin) S.profile = { display_name: "Admin", avatar: null };   // sin perfil ni fila en S.players: invisible para el resto
  else {
    let { data: prof } = await db.from("profiles").select().eq("id", S.user.id).maybeSingle();
    if (!prof) ({ data: prof } = await db.from("profiles").insert({ id: S.user.id, display_name: S.user.email.split("@")[0] }).select().single());
    S.profile = prof;
  }
  $("userInfo").classList.remove("hidden");
  // S.run única compartida
  const { data: r } = await db.from("runs").select().limit(1).maybeSingle();
  if (!r) return toast("La partida no está creada en la base de datos", true);
  await enterRun(r);
}

export function resetToAuth() {
  unsubscribeAll();
  stopPresence();
  resetPresence();
  S.user = S.profile = S.run = S.myPlayer = null; S.isAdmin = false; S.payoUid = null; S.players = []; S.entries = [];
  showAuth();
}

export async function enterRun(r) {
  S.run = r;
  $("runName").textContent = r.name;
  // unirse (insert idempotente): el upsert ON CONFLICT falla con RLS cuando aún no eres miembro
  // (la policy SELECT de S.players es is_member()); el insert normal pasa y el duplicado (23505) se ignora.
  if (!S.isAdmin) {
    const { error: joinErr } = await db.from("players").insert({ run_id: r.id, user_id: S.user.id });
    if (joinErr && joinErr.code !== "23505") return toast("No se pudo entrar en la partida", true);
    const { data: mine } = await db.from("players").select().eq("run_id", r.id).eq("user_id", S.user.id).maybeSingle();
    if (!mine) return toast("No se pudo entrar en la partida", true);
    S.myPlayer = mine;
  }
  document.querySelectorAll('.tab[data-tab="seg"],.tab[data-tab="perfil"]').forEach((b) => b.classList.toggle("hidden", S.isAdmin));
  if (S.isAdmin) selectTab("rutas");
  show("app");
  showSkeletons();
  await reload();
  subscribe();
  startPresence();
}
