// Monedas del Casino: ficticias, solo en este navegador (localStorage). No tocan Supabase ni el gacha clásico.
export const START = 1000, RECHARGE = 500, KEY = "casinoCoins";
const subs = new Set();
let bal = START;
try { const v = parseInt(localStorage.getItem(KEY), 10); if (Number.isFinite(v) && v >= 0) bal = v; } catch (e) {}

function set(n) {
  bal = Math.max(0, Math.round(n));
  try { localStorage.setItem(KEY, String(bal)); } catch (e) {}
  subs.forEach((f) => f(bal));
}
export const getBalance = () => bal;
export const addCoins = (n) => set(bal + n);                    // n puede ser negativo
export const spend = (n) => (n > 0 && n <= bal ? (set(bal - n), true) : false);   // false si no alcanza
export const resetWallet = () => set(START);
export const recharge = () => { if (bal === 0) set(RECHARGE); };   // recarga gratis solo con saldo 0
export const onBalance = (f) => (subs.add(f), () => subs.delete(f));   // devuelve la función para desuscribir
