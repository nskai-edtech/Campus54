// POST /api/score  { id, nick, score, duration }
// Saves a player's best score under a unique nickname. The first player to use a
// name owns it; anyone else gets 409 and is asked for another. Abuse limits:
// 20 submissions per minute per IP, scores must be possible for the time played,
// nicknames are cleaned.
const { pipeline } = require("./_redis");

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

// "Ada", "ada" and "A.D.A" count as the same name.
const nameKey = (nick) => "c54:name:" + nick.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

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
  const score = Number.isInteger(body.score) ? body.score : -1;
  const duration = typeof body.duration === "number" ? body.duration : -1;
  if (!id) return res.status(400).json({ error: "Bad player id" });
  if (!nick) return res.status(400).json({ error: "Pick another name (2-16 letters or numbers).", code: "bad-name" });
  if (score < 0 || duration <= 0 || duration > MAX_DURATION || score > MAX_POINTS_PER_SECOND * duration + 5000) {
    return res.status(400).json({ error: "That score could not be accepted." });
  }

  const ip = String(req.headers["x-forwarded-for"] || "unknown").split(",")[0].trim();
  try {
    const [hits] = await pipeline([["INCR", "c54:rate:" + ip], ["EXPIRE", "c54:rate:" + ip, "60", "NX"]]);
    if (hits > 20) return res.status(429).json({ error: "Too many scores. Wait a minute." });

    // Claim the name if it is free; refuse if another player owns it.
    const key = nameKey(nick);
    const [claimed, owner, oldNick] = await pipeline([
      ["SET", key, id, "NX"],
      ["GET", key],
      ["HGET", "c54:player:" + id, "nick"],
    ]);
    if (owner !== id) {
      return res.status(409).json({ error: "That name is taken. Pick another one.", code: "name-taken" });
    }

    const cmds = [];
    // Changed name: free the old one so someone else can use it.
    if (oldNick && nameKey(oldNick) !== key) cmds.push(["DEL", nameKey(oldNick)]);
    cmds.push(["HSET", "c54:player:" + id, "nick", nick]);
    cmds.push(["ZADD", "c54:players", "GT", String(score), id]);
    cmds.push(["ZSCORE", "c54:players", id]);
    cmds.push(["ZREVRANK", "c54:players", id]);
    const out = await pipeline(cmds);
    const best = Number(out[out.length - 2]);
    const rank = out[out.length - 1];
    return res.status(200).json({ ok: true, best, improved: best === score, rank: rank == null ? null : rank + 1, newName: claimed === "OK" });
  } catch (err) {
    console.error("score save failed:", err.message);
    return res.status(503).json({ error: "Ranking unavailable. Your score is kept on this device." });
  }
};
