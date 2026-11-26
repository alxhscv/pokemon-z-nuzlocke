import assert from "node:assert/strict";
import { computeRanking } from "../js/ranking-calc.js";
const P = (id, n) => ({ user_id: id, profiles: { display_name: n } });
const r = computeRanking([P("a", "Zed"), P("b", "Ana"), P("c", "Bob"), P("d", "Cid")],
  [{ winner_id: "a", loser_id: "b" }, { winner_id: "a", loser_id: "c" }, { winner_id: "c", loser_id: "b" }]);
assert.deepEqual(r.map((x) => x.user_id), ["a", "c", "d", "b"]);
assert.equal(r[0].winrate, 1); assert.equal(r[2].played, 0); assert.equal(r[3].losses, 2);
console.log("ok");
