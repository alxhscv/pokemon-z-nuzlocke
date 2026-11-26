// Sin dependencias (testeable en node). Incluye a todos los players con 0/0.
export function computeRanking(players, battles) {
  const m = new Map(players.map((p) => [p.user_id, { user_id: p.user_id, wins: 0, losses: 0, name: p.profiles?.display_name || "" }]));
  for (const b of battles) { const w = m.get(b.winner_id), l = m.get(b.loser_id); if (w) w.wins++; if (l) l.losses++; }
  return [...m.values()]
    .sort((a, b) => b.wins - a.wins || a.losses - b.losses || a.name.localeCompare(b.name))
    .map(({ user_id, wins, losses }) => ({ user_id, wins, losses, played: wins + losses, winrate: wins + losses ? wins / (wins + losses) : 0 }));
}
