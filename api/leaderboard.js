// GET /api/leaderboard  ->  { players: [{nick, country, score}], countries: [{country, score}] }
// Cached at Vercel's edge for 30 seconds, so many viewers cost almost nothing.
const { pipeline } = require("./_redis");

module.exports = async function handler(req, res) {
  try {
    const [players, countries] = await pipeline([
      ["ZREVRANGE", "c54:players", "0", "49", "WITHSCORES"],
      ["ZREVRANGE", "c54:countries", "0", "54", "WITHSCORES"],
    ]);
    const ids = [];
    for (let i = 0; i < players.length; i += 2) ids.push(players[i]);
    const details = ids.length ? await pipeline(ids.map((id) => ["HMGET", "c54:player:" + id, "nick", "country"])) : [];
    const top = ids.map((id, i) => ({
      nick: (details[i] && details[i][0]) || "Player",
      country: (details[i] && details[i][1]) || "XX",
      score: Number(players[i * 2 + 1]),
    }));
    const byCountry = [];
    for (let i = 0; i < countries.length; i += 2) {
      const score = Number(countries[i + 1]);
      if (score > 0) byCountry.push({ country: countries[i], score });
    }
    res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");
    return res.status(200).json({ players: top, countries: byCountry });
  } catch (err) {
    console.error("leaderboard read failed:", err.message);
    res.setHeader("Cache-Control", "no-store");
    return res.status(503).json({ error: "Ranking unavailable right now." });
  }
};
