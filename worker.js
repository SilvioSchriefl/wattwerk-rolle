// Wattwerk Ride – Strava-Vermittler für Cloudflare Workers
// Bewahrt den geheimen Strava-Schlüssel auf und reicht Anmeldung und Upload weiter.
// Benötigte Variablen (Settings → Variables and Secrets):
//   STRAVA_CLIENT_ID      – Client-ID deiner Strava-App
//   STRAVA_CLIENT_SECRET  – Client-Secret deiner Strava-App (als "Secret" anlegen)
//   ALLOWED_ORIGIN        – optional, Standard: https://silvioschriefl.github.io

const STRAVA = "https://www.strava.com";

// Strava vergibt ab 1. Juni 2027 64-Bit-IDs für Aktivitäten und Athleten. Solche Zahlen
// kann JavaScript nicht exakt darstellen. Deshalb werden IDs vor dem Einlesen in Text
// umgewandelt, und wo Strava ein *_str-Feld mitliefert, wird dieses verwendet.
async function readJson(r) {
  const t = await r.text();
  try {
    const d = JSON.parse(t.replace(/("(?:id|activity_id|upload_id|athlete_id)"\s*:\s*)(-?\d+)(?=\s*[,}\]])/g, '$1"$2"'));
    return fixIds(d);
  } catch (e) {
    return {};
  }
}
function fixIds(o) {
  if (!o || typeof o !== "object") return o;
  for (const k of Object.keys(o)) {
    if (k.endsWith("_str") && typeof o[k] === "string" && /^-?\d+$/.test(o[k])) o[k.slice(0, -4)] = o[k];
    else if (o[k] && typeof o[k] === "object") fixIds(o[k]);
  }
  return o;
}

export default {
  async fetch(req, env) {
    const origin = env.ALLOWED_ORIGIN || "https://silvioschriefl.github.io";
    const reqOrigin = req.headers.get("Origin") || "";
    const cors = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
    };
    const json = (obj, status = 200) =>
      new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const url = new URL(req.url);
    if (url.pathname === "/" || url.pathname === "/health") {
      return json({ ok: true, app: "wattwerk-strava", configured: !!(env.STRAVA_CLIENT_ID && env.STRAVA_CLIENT_SECRET) });
    }
    if (reqOrigin && reqOrigin !== origin) return json({ error: "origin_not_allowed" }, 403);
    if (!env.STRAVA_CLIENT_ID || !env.STRAVA_CLIENT_SECRET) return json({ error: "not_configured" }, 500);

    try {
      if (url.pathname === "/token" || url.pathname === "/refresh") {
        if (req.method !== "POST") return json({ error: "method" }, 405);
        const body = await req.json().catch(() => ({}));
        const form = new URLSearchParams({ client_id: env.STRAVA_CLIENT_ID, client_secret: env.STRAVA_CLIENT_SECRET });
        if (url.pathname === "/token") {
          if (!body.code) return json({ error: "missing_code" }, 400);
          form.set("code", String(body.code));
          form.set("grant_type", "authorization_code");
        } else {
          if (!body.refresh_token) return json({ error: "missing_refresh_token" }, 400);
          form.set("refresh_token", String(body.refresh_token));
          form.set("grant_type", "refresh_token");
        }
        const r = await fetch(STRAVA + "/oauth/token", { method: "POST", body: form });
        const d = await readJson(r);
        if (!r.ok) return json({ error: "strava_auth", status: r.status, detail: d.message || null }, r.status === 400 || r.status === 401 ? 401 : 502);
        return json({
          access_token: d.access_token,
          refresh_token: d.refresh_token,
          expires_at: d.expires_at,
          scope: body.scope || null,
          athlete: d.athlete ? { id: d.athlete.id != null ? String(d.athlete.id) : null, firstname: d.athlete.firstname || "" } : null,
        });
      }

      const auth = req.headers.get("Authorization") || "";
      if (!/^Bearer \S+$/.test(auth)) return json({ error: "missing_token" }, 401);

      if (url.pathname === "/upload") {
        if (req.method !== "POST") return json({ error: "method" }, 405);
        const ct = req.headers.get("Content-Type") || "";
        if (!ct.startsWith("multipart/form-data")) return json({ error: "expected_multipart" }, 400);
        const r = await fetch(STRAVA + "/api/v3/uploads", { method: "POST", headers: { Authorization: auth, "Content-Type": ct }, body: await req.arrayBuffer() });
        const d = await readJson(r);
        return json({ status_code: r.status, ...d }, r.ok ? 200 : r.status === 401 ? 401 : 502);
      }

      if (url.pathname === "/status") {
        const id = url.searchParams.get("id") || "";
        if (!/^\d+$/.test(id)) return json({ error: "bad_id" }, 400);
        const r = await fetch(STRAVA + "/api/v3/uploads/" + id, { headers: { Authorization: auth } });
        const d = await readJson(r);
        return json({ status_code: r.status, ...d }, r.ok ? 200 : r.status === 401 ? 401 : 502);
      }

      return json({ error: "not_found" }, 404);
    } catch (e) {
      return json({ error: "worker_error", detail: String(e && e.message || e) }, 502);
    }
  },
};
