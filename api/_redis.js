// Minimal Upstash Redis REST client (no npm packages, so the site keeps no build step).
// Needs UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in the Vercel project.
// Every key the game uses starts with "c54:" so it can share a database safely.

async function pipeline(commands) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("not-configured");
  const res = await fetch(url.replace(/\/$/, "") + "/pipeline", {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error("redis-" + res.status);
  const out = await res.json();
  return out.map((r) => {
    if (r.error) throw new Error("redis: " + r.error);
    return r.result;
  });
}

module.exports = { pipeline };
