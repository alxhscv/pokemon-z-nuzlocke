import { S, db } from "./core.js";
import { GACHA_COST } from "./config.js";
export { GACHA_COST };
export { computeRanking } from "./ranking-calc.js";

// las funciones lanzan Error si fallan; no recargan: lo decide la vista
const rpc = async (fn, args) => { const { data, error } = await db.rpc(fn, args); if (error) throw new Error(error.message); return data; };

export async function pullGacha(n) {
  const { data, error } = await rpc("gacha_pull", { n });
  if (error) throw new Error(/insuficientes/.test(error.message) ? "Monedas insuficientes" : error.message);
  return data;
}
export const adminGiveCoins = (uid, amount) => rpc("admin_give_coins", { uid, amount });
export const adminRecordBattle = (winnerUid, loserUid, note) => rpc("admin_record_battle", { winner: winnerUid, loser: loserUid, note: note || null });
export const adminDeleteBattle = (id) => rpc("admin_delete_battle", { bid: id });
export async function saveMotto(motto) {
  const m = (motto || "").trim().slice(0, 40) || null;
  const { error } = await db.from("profiles").update({ motto: m }).eq("id", S.user.id);
  if (error) throw new Error(/motto|schema cache/i.test(error.message) ? "Falta aplicar supabase/gacha_ranking.sql en Supabase" : error.message);
}
