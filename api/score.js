// POST /api/score  { id, nick, country, score, duration, level }
// Saves a player's best score. Abuse limits: 20 submissions per minute per IP,
// scores must be possible for the time played, nicknames are cleaned.
const { pipeline } = require("./_redis");
const COUNTRIES = new Set(require("./_countries"));

const BLOCKED = ["fuck", "shit", "bitch", "cunt", "nigg", "fag", "rape", "porn", "dick", "pussy", "whore", "slut", "nazi"];
const MAX_POINTS_PER_SECOND = 2000; // the game cannot score faster than this
const MAX_DURATION = 60 * 60; // one hour

function cleanNick(raw) {
  if (typeof raw !== "string") return null;
  const nick = raw.normalize("NFKC").replace(/[^\p{L}\p{N} _.-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 16);
  if (nick.length < 2) return null;
  const flat = nick.toLowerCase().replace(/[^a-z]/g, "");
  if (BLOCKED.some((w) => flat.includes(w))) return null;
  return nick;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  if (!body || typeof body !== "object") return res.status(400).json({ error: "Bad request" });

  const id = typeof body.id === "string" && /^[a-z0-9-]{8,40}$/i.test(body.id) ? body.id : null;
  const nick = cleanNick(body.nick);
  const country = typeof body.country === "string" && COUNTRIES.has(body.country) ? body.country : null;
  const score = Number.isInteger(body.score) ? body.score : -1;
  const duration = typeof body.duration === "number" ? body.duration : -1;
  if (!id) return res.status(400).json({ error: "Bad player id" });
  if (!nick) return res.status(400).json({ error: "Pick another nickname (2-16 letters or numbers)." });
  if (!country) return res.status(400).json({ error: "Pick your country." });
  if (score < 0 || duration <= 0 || duration > MAX_DURATION || score > MAX_POINTS_PER_SECOND * duration + 5000) {
    return res.status(400).json({ error: "That score could not be accepted." });
  }

  const ip = String(req.headers["x-forwarded-for"] || "unknown").split(",")[0].trim();
  try {
    const [hits] = await pipeline([["INCR", "c54:rate:" + ip], ["EXPIRE", "c54:rate:" + ip, "60", "NX"]]);
    if (hits > 20) return res.status(429).json({ error: "Too many scores. Wait a minute." });

    const [prevRaw, prevPlayer] = await pipeline([
      ["ZSCORE", "c54:players", id],
      ["HGET", "c54:player:" + id, "country"],
    ]);
    const prev = prevRaw == null ? 0 : Number(prevRaw);
    const cmds = [["HSET", "c54:player:" + id, "nick", nick, "country", country]];
    let improved = false;
    if (score > prev) {
      improved = true;
      cmds.push(["ZADD", "c54:players", String(score), id]);
      // A country's total is the sum of its players' best scores.
      if (prevPlayer && prevPlayer !== country && prev > 0) {
        cmds.push(["ZINCRBY", "c54:countries", String(-prev), prevPlayer]);
        cmds.push(["ZINCRBY", "c54:countries", String(score), country]);
      } else {
        cmds.push(["ZINCRBY", "c54:countries", String(score - prev), country]);
      }
    } else if (prevPlayer && prevPlayer !== country && prev > 0) {
      cmds.push(["ZINCRBY", "c54:countries", String(-prev), prevPlayer]);
      cmds.push(["ZINCRBY", "c54:countries", String(prev), country]);
    }
    cmds.push(["ZREVRANK", "c54:players", id]);
    const out = await pipeline(cmds);
    const rank = out[out.length - 1];
    return res.status(200).json({ ok: true, best: Math.max(prev, score), improved, rank: rank == null ? null : rank + 1 });
  } catch (err) {
    console.error("score save failed:", err.message);
    return res.status(503).json({ error: "Ranking unavailable. Your score is kept on this device." });
  }
};
