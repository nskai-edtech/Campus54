// GET /api/leaderboard  ->  { players: [{nick, score}] }  (top 50)
// Cached at Vercel's edge for 30 seconds, so many viewers cost almost nothing.
const { pipeline } = require("./_redis");

module.exports = async function handler(req, res) {
  try {
    const [players] = await pipeline([["ZREVRANGE", "c54:players", "0", "49", "WITHSCORES"]]);
    const ids = [];
    for (let i = 0; i < players.length; i += 2) ids.push(players[i]);
    const names = ids.length ? await pipeline(ids.map((id) => ["HGET", "c54:player:" + id, "nick"])) : [];
    const top = ids.map((id, i) => ({ nick: names[i] || "Player", score: Number(players[i * 2 + 1]) }));
    res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");
    return res.status(200).json({ players: top });
  } catch (err) {
    console.error("leaderboard read failed:", err.message);
    res.setHeader("Cache-Control", "no-store");
    return res.status(503).json({ error: "Ranking unavailable right now." });
  }
};
