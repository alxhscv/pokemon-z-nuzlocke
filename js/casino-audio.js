// Sonido sintetizado con Web Audio (sin archivos). Compartido por Gacha y Blackjack.
let ac = null, muted = false;
try { muted = localStorage.getItem("casinoMute") === "1"; } catch (e) {}

export const isMuted = () => muted;
export function setMuted(m) { muted = !!m; try { localStorage.setItem("casinoMute", m ? "1" : "0"); } catch (e) {} }
// el AudioContext solo puede crearse tras un gesto del usuario; las llamadas antes simplemente no suenan
export function ctx() {
  if (!ac) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; ac = new A(); }
  if (ac.state === "suspended") ac.resume();
  return ac;
}
// tono: f Hz, dur s, type (sine|square|sawtooth|triangle), vol 0..1, at = retraso en s, to = frecuencia final (glissando)
export function tone({ f = 440, dur = .2, type = "sine", vol = .15, at = 0, to } = {}) {
  const c = muted ? null : ctx(); if (!c) return;
  const t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(.02, dur / 4));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + .02);
}
// ruido filtrado (golpes, cartas, fichas): hz = frecuencia central del filtro
export function noise({ dur = .1, vol = .2, at = 0, hz = 2000, q = 1 } = {}) {
  const c = muted ? null : ctx(); if (!c) return;
  const t = c.currentTime + at, n = Math.max(1, Math.floor(c.sampleRate * dur)), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
  s.buffer = buf; fl.type = "bandpass"; fl.frequency.value = hz; fl.Q.value = q; g.gain.value = vol;
  s.connect(fl).connect(g).connect(c.destination); s.start(t);
}
